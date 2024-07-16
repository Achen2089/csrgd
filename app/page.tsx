// File: app/page.tsx
'use client';

import React, { useState, ChangeEvent, useRef } from 'react';
import { AlertCircle, Upload, FileText, X, Brain } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface AnalysisResult {
  summaries: string[];
  unifiedAnalysis: string;
}

export default function ResearchPaperAnalyzer() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scientificProcess, setScientificProcess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
      setScientificProcess(`Files selected: ${newFiles.map(f => f.name).join(', ')}`);
    }
  };

  const removeFile = (fileToRemove: File) => {
    setFiles((prevFiles) => prevFiles.filter(file => file !== fileToRemove));
    setScientificProcess(`File removed: ${fileToRemove.name}`);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const generateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setScientificProcess('');
    setResults(null);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    setScientificProcess(`Initiating analysis of ${files.length} files...`);

    try {
      const response = await fetch('/api/process-pdfs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let currentSummary = '';
      const summaries: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        accumulatedText += chunk;
        setScientificProcess(prev => `${prev}${chunk}`);

        if (chunk.includes('Summary for')) {
          if (currentSummary) {
            summaries.push(currentSummary.trim());
            currentSummary = '';
          }
          currentSummary = chunk.split('Summary for')[1];
        } else if (currentSummary) {
          currentSummary += chunk;
        }

        if (chunk.includes('Unified Analysis:')) {
          if (currentSummary) {
            summaries.push(currentSummary.trim());
          }
          const unifiedAnalysis = accumulatedText.split('Unified Analysis:')[1].trim();
          setResults({ summaries, unifiedAnalysis });
        }
      }

      setScientificProcess(prev => `${prev}\nAnalysis completed successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error);
        setError(`An error occurred: ${error.message}`);
        setScientificProcess(prev => `${prev}\nError occurred: ${error.message}`);
      } else {
        console.log('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Scientific Thinking Model</h1>
      <div className="mb-6">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf"
          multiple
          className="hidden"
        />
        <Button onClick={handleUploadClick} className="mr-4">
          <Upload className="mr-2 h-4 w-4" /> Upload PDF(s)
        </Button>
        <Button onClick={generateAnalysis} disabled={files.length === 0 || isLoading}>
          {isLoading ? 'Analyzing...' : 'Generate Scientific Analysis'}
        </Button>
        <div className="space-y-2 mt-4">
          {files.map((file, index) => (
            <div key={index} className="flex items-center space-x-2 bg-gray-100 p-2 rounded">
              <FileText className="h-4 w-4" />
              <span className="flex-grow truncate">{file.name}</span>
              <Button variant="ghost" size="sm" onClick={() => removeFile(file)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      {isLoading && (
        <div className="mt-6 flex items-center justify-center p-4 bg-blue-50 rounded-lg">
          <Brain className="h-8 w-8 animate-pulse text-blue-500" />
          <span className="ml-2 text-lg font-semibold">Scientific thinking in progress...</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {scientificProcess && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scientific Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap overflow-auto max-h-96 text-sm">{scientificProcess}</pre>
            </CardContent>
          </Card>
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-6">
          <Card className="bg-green-50">
            <CardHeader>
              <CardTitle className="text-2xl text-green-700">Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {results.summaries.map((summary, index) => (
                  <AccordionItem value={`summary-${index}`} key={index}>
                    <AccordionTrigger className="text-lg font-semibold">
                      Summary for Paper {index + 1}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="whitespace-pre-wrap text-green-800">{summary}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                <AccordionItem value="unified-analysis">
                  <AccordionTrigger className="text-lg font-semibold">
                    Unified Analysis
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap text-green-800 font-medium text-lg">{results.unifiedAnalysis}</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Note</AlertTitle>
        <AlertDescription>
          This analyzer uses AI to process your PDFs and conducts scientific analyses to generate novel hypotheses and experiments. Results should be reviewed and validated by human experts.
        </AlertDescription>
      </Alert>
    </div>
  );
}