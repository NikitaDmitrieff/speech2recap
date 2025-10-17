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

