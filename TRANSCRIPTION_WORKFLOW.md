# Speech2Recap - Complete Transcription Workflow Documentation

This document provides a complete, copy-paste ready description of the transcription workflow from file upload to final results.

## Architecture Overview

```
User Upload → File Validation → Processing Mode Selection → API Request
    ↓
Backend: Audio Processing (Trim/Split) → Whisper Transcription → GPT-4o Summarization
    ↓
Frontend: Display Results (Transcription + Summary + Key Points)
```

---

## 1. Frontend: File Upload & Processing Mode Selection

**File:** `app/page.tsx`

### 1.1 File Dropzone Setup

```typescript
import { useDropzone } from 'react-dropzone';
import { formatFileSize, isFileSizeOverLimit, estimateAudioDuration } from '@/lib/audio-client';

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
```

### 1.2 Processing Mode Selection UI (for files > 25MB)

```typescript
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
```

### 1.3 API Request Handler

```typescript
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
```

### 1.4 Results Display

```typescript
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
```

---

## 2. Backend: API Route Handler

**File:** `app/api/transcribe/route.ts`

### 2.1 Complete Route Handler

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildSummaryPrompt, PromptConfig } from '@/lib/prompts';
import { trimAudioFile, splitAudioFile, getAudioDuration, calculateRequiredParts } from '@/lib/audio-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    let file = formData.get('file') as File;
    const language = formData.get('language') as string;
    const context = formData.get('context') as string | null;
    const summaryLength = formData.get('summaryLength') as PromptConfig['summaryLength'] || 'moderate';
    const outputLanguage = formData.get('outputLanguage') as string || 'same';
    const trimDuration = formData.get('trimDuration') as string | null;
    const splitAudio = formData.get('splitAudio') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!language) {
      return NextResponse.json(
        { error: 'No language provided' },
        { status: 400 }
      );
    }

    let transcribedText = '';

    // Handle split audio mode (for complete transcription of large files)
    if (splitAudio === 'true') {
      console.log('[Split Mode] Getting actual audio duration...');
      
      let actualDurationSeconds: number;
      try {
        actualDurationSeconds = await getAudioDuration(file);
      } catch (durationError) {
        console.error('[Split Mode] Failed to get exact duration:', durationError);
        return NextResponse.json(
          { 
            error: 'Could not determine audio duration. FFprobe may not be properly installed. Please try the "trim" option instead or check your server configuration.' 
          },
          { status: 500 }
        );
      }
      
      // Calculate how many parts we need
      const numParts = calculateRequiredParts(actualDurationSeconds);
      const durationMinutes = actualDurationSeconds / 60;
      console.log(`[Split Mode] Splitting audio into ${numParts} parts (${durationMinutes.toFixed(2)} minutes total)...`);
      
      const partBuffers = await splitAudioFile(file, actualDurationSeconds, numParts);
      
      // Create File objects from buffers and verify all are under 25MB
      const partFiles: File[] = [];
      const maxSize = 25 * 1024 * 1024;
      
      for (let i = 0; i < partBuffers.length; i++) {
        const partFile = new File(
          [new Blob([partBuffers[i] as unknown as ArrayBuffer])], 
          `part${i + 1}.mp3`, 
          { type: 'audio/mp3' }
        );
        partFiles.push(partFile);
        
        if (partFile.size > maxSize) {
          const msg = `Part ${i + 1}: ${(partFile.size / 1024 / 1024).toFixed(2)}MB exceeds 25MB limit.`;
          console.error('[Split Mode] ERROR:', msg);
          return NextResponse.json(
            { error: `Split failed: ${msg} File may require more than ${numParts} parts.` },
            { status: 400 }
          );
        }
      }
      
      console.log('[Split Mode] All parts verified under 25MB.');
      
      // Transcribe all parts
      const transcriptions: string[] = [];
      for (let i = 0; i < partFiles.length; i++) {
        console.log(`[Split Mode] Transcribing part ${i + 1}/${partFiles.length}...`);
        const transcription = await openai.audio.transcriptions.create({
          file: partFiles[i],
          model: 'whisper-1',
          language: language === 'french' ? 'fr' : 'en',
        });
        transcriptions.push(transcription.text);
      }
      
      // Combine all transcriptions
      transcribedText = transcriptions.join(' ');
      console.log(`[Split Mode] Combined ${numParts} transcriptions. Total length: ${transcribedText.length} characters`);
    }
    // Handle trim mode (for partial transcription)
    else if (trimDuration) {
      const durationMinutes = parseInt(trimDuration, 10);
      if (durationMinutes > 0) {
        console.log(`[Trim Mode] Trimming audio to ${durationMinutes} minutes...`);
        const trimmedBuffer = await trimAudioFile(file, durationMinutes);
        const blob = new Blob([trimmedBuffer as unknown as ArrayBuffer], { type: 'audio/mp3' });
        file = new File([blob], `trimmed-${file.name}`, { type: 'audio/mp3' });
        console.log(`[Trim Mode] Trimmed file size: ${(trimmedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Transcribe using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language === 'french' ? 'fr' : 'en',
      });
      
      transcribedText = transcription.text;
    }
    // Handle normal mode (file under 25MB)
    else {
      console.log('[Normal Mode] Transcribing audio...');
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: language === 'french' ? 'fr' : 'en',
      });
      
      transcribedText = transcription.text;
    }

    // Build prompt using configuration
    const promptConfig: PromptConfig = {
      context: context || undefined,
      summaryLength,
      outputLanguage,
    };
    
    const systemPrompt = buildSummaryPrompt(promptConfig);

    // Generate summary and key points using GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Please summarize this transcription and extract the key points:\n\n${transcribedText}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json({
      transcription: transcribedText,
      summary: analysis.summary || 'No summary available',
      keyPoints: analysis.keyPoints || [],
    });
  } catch (error) {
    console.error('Transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
```

---

## 3. Backend: Audio Processing Utilities

**File:** `lib/audio-server.ts`

### 3.1 FFmpeg & FFprobe Configuration

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

// Get ffmpeg and ffprobe paths at runtime using require to avoid Next.js path replacement
function getFfmpegBinaries(): { ffmpegPath: string | null; ffprobePath: string | null } {
  let ffmpegPath: string | null = null;
  let ffprobePath: string | null = null;

  // Get ffmpeg path
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let ffmpegStatic = require('ffmpeg-static');
    
    if (ffmpegStatic && typeof ffmpegStatic === 'string') {
      // Replace /ROOT/ placeholder with actual project root
      if (ffmpegStatic.includes('/ROOT/')) {
        ffmpegStatic = ffmpegStatic.replace('/ROOT/', process.cwd() + '/');
      }
      
      if (existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
      } else {
        // Try alternative path
        const altPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
        if (existsSync(altPath)) {
          ffmpegPath = altPath;
        }
      }
    }
  } catch (error) {
    console.error('[Audio] ❌ Error loading ffmpeg-static:', error);
  }

  // Get ffprobe path
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require('@ffprobe-installer/ffprobe');
    const ffprobePathRaw = ffprobeStatic.path;
    
    if (ffprobePathRaw && typeof ffprobePathRaw === 'string') {
      let processedPath = ffprobePathRaw;
      
      // Replace /ROOT/ placeholder with actual project root
      if (processedPath.includes('/ROOT/')) {
        processedPath = processedPath.replace('/ROOT/', process.cwd() + '/');
      }
      
      if (existsSync(processedPath)) {
        ffprobePath = processedPath;
      }
    }
  } catch (error) {
    console.error('[Audio] ❌ Error loading @ffprobe-installer/ffprobe:', error);
  }

  return { ffmpegPath, ffprobePath };
}

// Configure ffmpeg and ffprobe
const { ffmpegPath: ffmpegBinaryPath, ffprobePath: ffprobeBinaryPath } = getFfmpegBinaries();

if (ffmpegBinaryPath) {
  ffmpeg.setFfmpegPath(ffmpegBinaryPath);
}

if (ffprobeBinaryPath) {
  ffmpeg.setFfprobePath(ffprobeBinaryPath);
}
```

### 3.2 Get Actual Audio Duration

```typescript
/**
 * Get the actual duration of an audio file in seconds using ffprobe
 * @param file - The input audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(file: File): Promise<number> {
  // Check if ffprobe is configured
  if (!ffprobeBinaryPath) {
    throw new Error('FFprobe not configured. Cannot get audio duration. Please ensure @ffprobe-installer/ffprobe is installed.');
  }

  const tempInputPath = path.join(tmpdir(), `probe-${Date.now()}-${file.name}`);
  
  try {
    // Write file to temporary location
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempInputPath, Buffer.from(arrayBuffer));

    console.log('[Audio] Probing file for duration...');

    // Get duration using ffprobe
    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
        if (err) {
          console.error('[Audio] FFprobe error:', err);
          reject(err);
        } else {
          const durationInSeconds = metadata.format.duration || 0;
          console.log('[Audio] Metadata retrieved:', {
            duration: durationInSeconds,
            format: metadata.format.format_name,
            size: metadata.format.size,
          });
          resolve(durationInSeconds);
        }
      });
    });

    // Cleanup
    await fs.unlink(tempInputPath).catch(() => {});

    console.log(`[Audio] ✅ Actual duration: ${(duration / 60).toFixed(2)} minutes (${duration.toFixed(1)} seconds)`);
    return duration;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(tempInputPath).catch(() => {});
    console.error('[Audio] Failed to get audio duration:', error);
    throw error;
  }
}
```

### 3.3 Calculate Required Parts

```typescript
/**
 * Calculate how many parts are needed to keep each part under 25MB when encoded at 128kbps
 * @param totalDurationSeconds - Total duration of audio in seconds
 * @returns Number of parts needed
 */
export function calculateRequiredParts(totalDurationSeconds: number): number {
  // At 128kbps, we get approximately 1MB per minute
  // To stay safely under 25MB, we use 24 minutes per part
  const MAX_MINUTES_PER_PART = 24;
  const totalMinutes = totalDurationSeconds / 60;
  const requiredParts = Math.ceil(totalMinutes / MAX_MINUTES_PER_PART);
  
  console.log(`[Audio] Duration: ${totalMinutes.toFixed(2)} minutes, Required parts: ${requiredParts}`);
  
  return Math.max(requiredParts, 2); // Minimum 2 parts for split mode
}
```

### 3.4 Split Audio into N Parts

```typescript
/**
 * Split an audio file into N equal parts
 * @param file - The input audio file
 * @param totalDurationSeconds - Actual total duration of the audio in seconds
 * @param numParts - Number of parts to split into
 * @returns Array of audio buffers
 */
export async function splitAudioFile(
  file: File,
  totalDurationSeconds: number,
  numParts: number
): Promise<Buffer[]> {
  const tempInputPath = path.join(tmpdir(), `input-${Date.now()}-${file.name}`);
  const tempPartPaths: string[] = [];
  
  // Generate temp paths for all parts
  for (let i = 0; i < numParts; i++) {
    tempPartPaths.push(path.join(tmpdir(), `part${i + 1}-${Date.now()}.mp3`));
  }

  try {
    // Write file to temporary location
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempInputPath, Buffer.from(arrayBuffer));

    const partDuration = totalDurationSeconds / numParts;
    console.log(`[Audio] Splitting into ${numParts} parts of ~${(partDuration / 60).toFixed(2)} minutes each`);

    // Create all parts
    for (let i = 0; i < numParts; i++) {
      const startTime = i * partDuration;
      const duration = (i === numParts - 1) ? undefined : partDuration; // Last part goes to end
      
      console.log(`[Audio] Creating part ${i + 1}/${numParts} (start: ${(startTime / 60).toFixed(2)}min)...`);
      
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(tempInputPath)
          .setStartTime(startTime)
          .audioBitrate('128k')
          .audioCodec('libmp3lame')
          .format('mp3');
        
        if (duration) {
          command.setDuration(duration);
        }
        
        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(tempPartPaths[i]);
      });

      console.log(`[Audio] Part ${i + 1} created successfully`);
    }

    // Read all parts
    const partBuffers: Buffer[] = [];
    for (let i = 0; i < numParts; i++) {
      const buffer = await fs.readFile(tempPartPaths[i]);
      partBuffers.push(buffer);
      console.log(`[Audio] Part ${i + 1} size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Cleanup temporary files
    await fs.unlink(tempInputPath).catch(() => {});
    for (const partPath of tempPartPaths) {
      await fs.unlink(partPath).catch(() => {});
    }

    return partBuffers;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(tempInputPath).catch(() => {});
    for (const partPath of tempPartPaths) {
      await fs.unlink(partPath).catch(() => {});
    }
    throw error;
  }
}
```

### 3.5 Trim Audio File

```typescript
/**
 * Trim an audio file to a specified duration in minutes
 * @param file - The input audio file
 * @param durationMinutes - How many minutes to keep from the start
 * @returns Buffer containing the trimmed audio file
 */
export async function trimAudioFile(
  file: File,
  durationMinutes: number
): Promise<Buffer> {
  const tempInputPath = path.join(tmpdir(), `input-${Date.now()}-${file.name}`);
  const tempOutputPath = path.join(tmpdir(), `output-${Date.now()}.mp3`);

  try {
    // Write file to temporary location
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempInputPath, Buffer.from(arrayBuffer));

    // Trim audio using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInputPath)
        .setDuration(durationMinutes * 60) // Convert minutes to seconds
        .audioBitrate('128k') // Use reasonable bitrate to keep size down
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(tempOutputPath);
    });

    // Read the trimmed file
    const trimmedBuffer = await fs.readFile(tempOutputPath);

    // Cleanup temporary files
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});

    return trimmedBuffer;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});
    throw error;
  }
}
```

---

## 4. Backend: Prompt Configuration

**File:** `lib/prompts.ts`

### 4.1 Complete Prompt Builder

```typescript
/**
 * Prompt templates for audio transcription summarization
 * 
 * This file contains the system prompts used to generate summaries
 * and key points from transcribed audio. You can customize these
 * prompts to change how the AI analyzes your transcriptions.
 */

export interface PromptConfig {
  context?: string;
  summaryLength: 'brief' | 'moderate' | 'detailed' | 'comprehensive' | 'extensive';
  outputLanguage: string;
}

const SUMMARY_LENGTH_INSTRUCTIONS = {
  brief: 'Keep the summary very concise (2-3 sentences) and extract only the 3 most important key points.',
  moderate: 'Provide a moderate summary (4-5 sentences) and extract 5-7 key points.',
  detailed: 'Write a detailed summary (6-8 sentences) and extract 8-10 key points with additional context.',
  comprehensive: 'Create a comprehensive summary (10-12 sentences) covering all major topics and extract 10-15 key points.',
  extensive: 'Generate an extensive summary (15+ sentences) with thorough coverage and extract 15+ key points with detailed explanations.',
};

export function buildSummaryPrompt(config: PromptConfig): string {
  const { context, summaryLength, outputLanguage } = config;
  
  const lengthInstruction = SUMMARY_LENGTH_INSTRUCTIONS[summaryLength];
  const contextSection = context 
    ? `\n\nAdditional Context:\n${context}\n\nUse this context to better understand and analyze the transcription.`
    : '';
  
  return `You are a helpful assistant that summarizes transcribed audio.

${lengthInstruction}

${outputLanguage !== 'same' 
  ? `IMPORTANT: Write your entire response (summary and key points) in ${outputLanguage}.` 
  : 'Write your response in the same language as the transcription.'}
${contextSection}

Format your response as JSON with two fields:
- "summary" (string): The summary of the transcription
- "keyPoints" (array of strings): The key points extracted from the transcription

Ensure all text is in the specified language.`;
}
```

---

## 5. Frontend: Client-Safe Utilities

**File:** `lib/audio-client.ts`

### 5.1 Complete Client Utilities

```typescript
/**
 * Client-safe audio utilities
 * These functions contain no Node.js dependencies and can be used in browser/client components
 */

/**
 * Calculate estimated duration of an audio file based on its size and format
 * This is a rough estimation
 * @param fileSizeBytes - Size of the file in bytes
 * @param format - File format (m4a or mp3)
 * @returns Estimated duration in minutes
 */
export function estimateAudioDuration(
  fileSizeBytes: number,
  format: string
): number {
  // Average bitrates for different formats (in kbps)
  const averageBitrates: Record<string, number> = {
    mp3: 128, // Average MP3 bitrate
    m4a: 256, // Average M4A/AAC bitrate
  };

  const bitrate = averageBitrates[format.toLowerCase()] || 128;
  
  // Calculate duration: (file size in bytes * 8 bits) / (bitrate * 1000) / 60 seconds
  const durationMinutes = (fileSizeBytes * 8) / (bitrate * 1000 * 60);
  
  return Math.round(durationMinutes);
}

/**
 * Format file size to human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "25.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Check if a file size exceeds the OpenAI Whisper limit (25MB)
 * @param bytes - Size in bytes
 * @returns true if file is over the limit
 */
export function isFileSizeOverLimit(bytes: number): boolean {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB in bytes
  return bytes > MAX_SIZE;
}
```

---

## Complete Data Flow Summary

### Step-by-Step Execution Flow

1. **User uploads file** → `onDrop` callback triggered in `app/page.tsx`
2. **File size check** → `isFileSizeOverLimit()` determines if file > 25MB
3. **Mode selection** → User chooses "split" or "trim" if file is large (radio buttons)
4. **FormData creation** → Includes file, language, and processing parameters
5. **API POST request** → `/api/transcribe` endpoint in `app/api/transcribe/route.ts`
6. **Backend processing**:
   - **Split mode**: 
     - Get actual duration via `getAudioDuration()` (ffprobe)
     - Calculate required parts via `calculateRequiredParts()`
     - Split audio via `splitAudioFile()` (creates N mp3 files)
     - Transcribe each part sequentially with Whisper
     - Combine all transcriptions: `transcriptions.join(' ')`
   - **Trim mode**: 
     - Trim to X minutes via `trimAudioFile()`
     - Transcribe single trimmed file
   - **Normal mode**: 
     - Direct transcription (file already < 25MB)
7. **Whisper transcription** → OpenAI Whisper API returns text for each part
8. **GPT-4o summarization** → 
   - Build prompt via `buildSummaryPrompt()` with user config
   - Send combined transcription to GPT-4o
   - Parse JSON response: `{ summary, keyPoints }`
9. **Response** → JSON with `{ transcription, summary, keyPoints }`
10. **Frontend display** → Show results in UI cards

### Key Files & Their Roles

| File | Purpose |
|------|---------|
| `app/page.tsx` | Frontend UI, file upload, mode selection, results display |
| `app/api/transcribe/route.ts` | Backend API handler, orchestrates entire transcription flow |
| `lib/audio-server.ts` | Server-only audio processing (ffmpeg/ffprobe, trim/split) |
| `lib/audio-client.ts` | Client-safe utilities (file size, duration estimation) |
| `lib/prompts.ts` | GPT prompt configuration and builder |

### Required Dependencies

```json
{
  "dependencies": {
    "@ffprobe-installer/ffprobe": "^2.1.2",
    "ffmpeg-static": "^5.2.0",
    "fluent-ffmpeg": "^2.1.3",
    "openai": "^6.3.0",
    "react-dropzone": "^14.3.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-collapsible": "^1.1.12"
  }
}
```

### Environment Variables

```bash
# .env.local
OPENAI_API_KEY=your_openai_api_key_here
```

### Important Constants

- **25MB limit**: OpenAI Whisper API hard limit per file
- **128kbps encoding**: Used for trimmed/split files to keep size down
- **24 minutes per part**: Safe limit to stay under 25MB at 128kbps (~1MB per minute)
- **FFprobe required**: For accurate duration detection (not estimates)

### Processing Modes Explained

1. **Normal Mode** (file < 25MB):
   - Direct upload to Whisper
   - Single transcription call
   - Fastest processing

2. **Trim Mode** (file > 25MB, user chooses):
   - Trim to first X minutes
   - Single transcription call
   - Partial transcription only
   - Faster than split mode

3. **Split Mode** (file > 25MB, user chooses):
   - Get actual duration (ffprobe)
   - Calculate N parts needed (2-4+)
   - Split into N equal parts
   - Transcribe each part sequentially
   - Combine all transcriptions
   - Complete transcription guaranteed
   - Slower (N × transcription time)

---

## Example: 55-Minute M4A File (28MB)

### Flow:

1. **Upload**: 28MB m4a file detected
2. **Size check**: `isFileSizeOverLimit(28MB)` → `true`
3. **Mode selection**: User selects "Split and transcribe entire audio"
4. **API call**: `splitAudio: 'true'` sent to backend
5. **Backend**:
   - `getAudioDuration()` → 3350 seconds (55.84 minutes)
   - `calculateRequiredParts(3350)` → `Math.ceil(55.84 / 24)` → **3 parts**
   - `splitAudioFile(file, 3350, 3)` → Creates 3 parts:
     - Part 1: 0-18.6 min (~18MB)
     - Part 2: 18.6-37.3 min (~18MB)
     - Part 3: 37.3-55.84 min (~18MB)
   - Transcribe part 1 → "text1"
   - Transcribe part 2 → "text2"
   - Transcribe part 3 → "text3"
   - Combine: `"text1 text2 text3"`
6. **GPT-4o**: Summarize combined text → `{ summary, keyPoints }`
7. **Response**: Complete transcription + summary

---

## Notes for Implementation

- All code snippets above are **copy-paste ready** from actual source files
- FFmpeg/FFprobe paths are resolved at runtime to handle Next.js `/ROOT/` placeholder
- Temporary files are always cleaned up (try/catch with cleanup)
- Error handling is comprehensive at each step
- Multi-part processing ensures complete transcription for any file size
- Prompt configuration is centralized in `lib/prompts.ts` for easy customization
