// File: app/api/process-pdfs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("OpenAI API key not found in environment variables");
}

const summarizationPrompt = PromptTemplate.fromTemplate(`
Provide a brief summary (maximum 300 words) of the key points from this research paper section:

{paper_content}

Summary:
`);

const unifiedAnalysisPrompt = PromptTemplate.fromTemplate(`
Based on the following research paper summaries:

{summaries}

In no more than 500 words:
1. Identify one common theme or potential connection between the papers.
2. Generate 1 - 3 novel hypothesis that addresses a gap or builds upon the collective findings.
3. Propose one experiment to test each of the hypothesises.

Provide your concise analysis:
`);

async function* processFile(file: File, model: OpenAI, embeddings: OpenAIEmbeddings) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-upload-'));
  const tempFilePath = path.join(tempDir, file.name);
  await fs.writeFile(tempFilePath, buffer);

  yield `Processing ${file.name}...\n`;

  try {
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();
    
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 5000,  // Increased from 3000 to 5000
      chunkOverlap: 500,  // Increased from 200 to 500
    });

    const chunks = await textSplitter.splitDocuments(docs);
    const summarizationChain = new LLMChain({ llm: model, prompt: summarizationPrompt });

    let fullSummary = '';
    for (let i = 0; i < Math.min(chunks.length, 5); i++) {  // Increased from 3 to 5 chunks
      const chunkSummary = await summarizationChain.call({ paper_content: chunks[i].pageContent });
      fullSummary += chunkSummary.text + ' ';
      yield `🧠 Analyzing section ${i + 1} of ${Math.min(chunks.length, 5)} for ${file.name}\n`;
    }

    fullSummary = fullSummary.trim();
    yield `Summary for ${file.name}:\n${fullSummary}\n\n`;

    return fullSummary;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const files = data.getAll('files') as File[];

  if (files.length === 0) {
    return new Response('No files uploaded', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const model = new OpenAI({ openAIApiKey: OPENAI_API_KEY, temperature: 0.3, maxTokens: 500 });
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });

  (async () => {
    try {
      const summaries = [];
      for (const file of files) {
        for await (const chunk of processFile(file, model, embeddings)) {
          await writer.write(encoder.encode(chunk));
          if (typeof chunk === 'string' && chunk.startsWith('Summary for')) {
            summaries.push(chunk);
          }
        }
      }

      await writer.write(encoder.encode('🧪 Synthesizing findings...\n'));

      const unifiedAnalysisChain = new LLMChain({ llm: model, prompt: unifiedAnalysisPrompt });
      const unifiedAnalysis = await unifiedAnalysisChain.call({ summaries: summaries.join('\n') });

      await writer.write(encoder.encode(`Unified Analysis:\n${unifiedAnalysis.text}\n`));
    } catch (e) {
      await writer.write(encoder.encode(`Error: ${(e as Error).message}\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}