'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { formatFileSize, isFileSizeOverLimit, estimateAudioDuration } from '@/lib/audio-client';

type SummaryLength = 'brief' | 'moderate' | 'detailed' | 'comprehensive' | 'extensive';

const SUMMARY_LENGTH_MAP: Record<number, SummaryLength> = {
  1: 'brief',
  2: 'moderate',
  3: 'detailed',
  4: 'comprehensive',
  5: 'extensive',
};

const SUMMARY_LENGTH_LABELS: Record<SummaryLength, string> = {
  brief: 'Brief',
  moderate: 'Moderate',
  detailed: 'Detailed',
  comprehensive: 'Comprehensive',
  extensive: 'Extensive',
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('english');
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  
  // Advanced options
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [context, setContext] = useState<string>('');
  const [summaryLengthValue, setSummaryLengthValue] = useState<number>(2);
  const [outputLanguage, setOutputLanguage] = useState<string>('same');
  
  // File size and trimming
  const [fileSize, setFileSize] = useState<number>(0);
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);
  const [trimDuration, setTrimDuration] = useState<number>(15);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [processingMode, setProcessingMode] = useState<'trim' | 'split'>('split');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const droppedFile = acceptedFiles[0];
      setFile(droppedFile);
      setFileSize(droppedFile.size);
      setError('');
      
      // Check if file is too large
      const isTooLarge = isFileSizeOverLimit(droppedFile.size);
      setIsFileTooLarge(isTooLarge);
      
      // Estimate duration for trim slider
      if (isTooLarge) {
        const ext = droppedFile.name.split('.').pop() || 'mp3';
        const estimated = estimateAudioDuration(droppedFile.size, ext);
        setEstimatedDuration(estimated);
        // Default to half the duration or 15 minutes, whichever is smaller
        setTrimDuration(Math.min(Math.floor(estimated / 2), 15));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mp4': ['.m4a'],
      'audio/mpeg': ['.mp3'],
    },
    multiple: false,
  });

  const handleTranscribe = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError('');
    setTranscription('');
    setSummary('');
    setKeyPoints([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      
      // Add advanced options
      if (context.trim()) {
        formData.append('context', context.trim());
      }
      formData.append('summaryLength', SUMMARY_LENGTH_MAP[summaryLengthValue]);
      formData.append('outputLanguage', outputLanguage);
      
      // Add processing mode parameters if file is too large
      if (isFileTooLarge) {
        if (processingMode === 'split') {
          formData.append('splitAudio', 'true');
          // Backend will get actual duration using ffprobe
        } else {
          formData.append('trimDuration', trimDuration.toString());
        }
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe');
      }

      const data = await response.json();
      setTranscription(data.transcription);
      setSummary(data.summary);
      setKeyPoints(data.keyPoints);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during transcription';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Brand new Speech2Recap</h1>
          <p className="text-gray-400">Transcribe and summarize your audio files</p>
        </div>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Upload Audio</CardTitle>
            <CardDescription>Select an .m4a or .mp3 file to transcribe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-white bg-white/5'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-2">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-white">{file.name}</p>
                    <p className="text-sm text-gray-400">{formatFileSize(fileSize)}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-white">
                      {isDragActive ? 'Drop your file here' : 'Drag & drop or click to select'}
                    </p>
                    <p className="text-sm text-gray-400">m4a or mp3 files only</p>
                  </>
                )}
              </div>
            </div>

            {isFileTooLarge && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-yellow-500">
                      File size exceeds 25MB limit
                    </p>
                    <p className="text-xs text-gray-400">
                      Your file is {formatFileSize(fileSize)} (estimated ~{estimatedDuration} minutes).
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Label>Choose how to proceed:</Label>
                  <RadioGroup value={processingMode} onValueChange={(value: string) => setProcessingMode(value as 'trim' | 'split')}>
                    <div className="flex items-start space-x-3 space-y-0">
                      <RadioGroupItem value="split" id="split" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="split" className="cursor-pointer font-normal">
                          Split and transcribe entire audio (recommended)
                        </Label>
                        <p className="text-xs text-gray-400">
                          Will split into multiple parts (2-4 depending on length) and transcribe all. Gives complete transcription.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0">
                      <RadioGroupItem value="trim" id="trim" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="trim" className="cursor-pointer font-normal">
                          Transcribe first X minutes only (faster)
                        </Label>
                        <p className="text-xs text-gray-400">
                          Faster processing but you&apos;ll only get a partial transcription.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {processingMode === 'trim' && (
                  <div className="space-y-2">
                    <Label htmlFor="trim-duration">
                      Transcribe first: {trimDuration} {trimDuration === 1 ? 'minute' : 'minutes'}
                    </Label>
                    <Slider
                      id="trim-duration"
                      min={1}
                      max={Math.min(estimatedDuration || 60, 60)}
                      step={1}
                      value={[trimDuration]}
                      onValueChange={(value) => setTrimDuration(value[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1 min</span>
                      <span>{Math.min(estimatedDuration || 60, 60)} min</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between hover:bg-white/5"
                  type="button"
                >
                  <span>Advanced Prompting</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isAdvancedOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="context">Context</Label>
                  <Textarea
                    id="context"
                    placeholder="Provide additional context to help the AI understand the transcription better..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-gray-400">
                    Optional: Add background information or specific instructions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary-length">
                    Summary Length: {SUMMARY_LENGTH_LABELS[SUMMARY_LENGTH_MAP[summaryLengthValue]]}
                  </Label>
                  <Slider
                    id="summary-length"
                    min={1}
                    max={5}
                    step={1}
                    value={[summaryLengthValue]}
                    onValueChange={(value) => setSummaryLengthValue(value[0])}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Brief</span>
                    <span>Extensive</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="output-language">Output Language</Label>
                  <Select value={outputLanguage} onValueChange={setOutputLanguage}>
                    <SelectTrigger id="output-language">
                      <SelectValue placeholder="Select output language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same">Same as transcription</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                      <SelectItem value="German">German</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Portuguese">Portuguese</SelectItem>
                      <SelectItem value="Chinese">Chinese</SelectItem>
                      <SelectItem value="Japanese">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">
                    Language for the summary and key points
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button
              onClick={handleTranscribe}
              disabled={!file || isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-5 w-5" />
                  {isFileTooLarge && processingMode === 'split' 
                    ? 'Processing multi-part transcription...' 
                    : 'Transcribing...'}
                </span>
              ) : (
                'Transcribe'
              )}
            </Button>

            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}
          </CardContent>
        </Card>

        {(transcription || summary) && (
          <div className="space-y-6">
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle>Summary & Key Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary && (
                  <div className="space-y-2">
                    <Label>Summary</Label>
                    <p className="text-gray-300 leading-relaxed">{summary}</p>
                  </div>
                )}
                {keyPoints.length > 0 && (
                  <div className="space-y-2">
                    <Label>Key Points</Label>
                    <ul className="space-y-2 list-disc list-inside text-gray-300">
                      {keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10">
              <CardHeader>
                <CardTitle>Full Transcription</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={transcription}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
