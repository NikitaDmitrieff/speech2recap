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

