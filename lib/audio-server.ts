/**
 * Server-only audio processing utilities
 * 
 * ⚠️ WARNING: This module uses Node.js-only dependencies (fs, ffmpeg)
 * DO NOT import this in client components - use audio-client.ts instead
 */

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
    console.log('[Audio] ffmpeg-static raw value:', ffmpegStatic);
    
    if (ffmpegStatic && typeof ffmpegStatic === 'string') {
      // Replace /ROOT/ placeholder with actual project root
      if (ffmpegStatic.includes('/ROOT/')) {
        ffmpegStatic = ffmpegStatic.replace('/ROOT/', process.cwd() + '/');
      }
      
      if (existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
        console.log('[Audio] ✅ ffmpeg found:', ffmpegPath);
      } else {
        // Try alternative path
        const altPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
        if (existsSync(altPath)) {
          ffmpegPath = altPath;
          console.log('[Audio] ✅ ffmpeg found (alt):', ffmpegPath);
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
    
    console.log('[Audio] ffprobe-installer raw value:', ffprobePathRaw);
    
    if (ffprobePathRaw && typeof ffprobePathRaw === 'string') {
      let processedPath = ffprobePathRaw;
      
      // Replace /ROOT/ placeholder with actual project root
      if (processedPath.includes('/ROOT/')) {
        processedPath = processedPath.replace('/ROOT/', process.cwd() + '/');
      }
      
      if (existsSync(processedPath)) {
        ffprobePath = processedPath;
        console.log('[Audio] ✅ ffprobe found:', ffprobePath);
      } else {
        console.error('[Audio] ❌ ffprobe path does not exist:', processedPath);
      }
    }
  } catch (error) {
    console.error('[Audio] ❌ Error loading @ffprobe-installer/ffprobe:', error);
  }

  if (!ffmpegPath) {
    console.warn('[Audio] ⚠️ FFmpeg not found - audio processing will fail');
  }
  if (!ffprobePath) {
    console.warn('[Audio] ⚠️ FFprobe not found - duration detection will fail');
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

