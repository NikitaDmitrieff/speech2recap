import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildSummaryPrompt, PromptConfig } from '@/lib/prompts';
import { trimAudioFile, splitAudioFile, getAudioDuration, calculateRequiredParts } from '@/lib/audio-server';

export async function POST(request: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
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

