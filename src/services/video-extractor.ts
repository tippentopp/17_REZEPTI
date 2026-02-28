import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { ExtractedContent, SourceType } from '../types.js';

const execFileAsync = promisify(execFile);

export async function extractVideo(url: string, sourceType: SourceType): Promise<ExtractedContent> {
  const id = `rezepti-${Date.now()}`;
  const tmpBase = path.join(tmpdir(), id);

  const content: ExtractedContent = { sourceType, url };

  try {
    // Get title and thumbnail
    try {
      const { stdout } = await execFileAsync('yt-dlp', [
        '--print', 'title',
        '--print', 'thumbnail',
        '--no-download',
        url,
      ], { timeout: 30000 });

      const lines = stdout.trim().split('\n');
      content.title = lines[0] || undefined;
      content.imageUrl = lines[1] || undefined;
    } catch { /* non-critical */ }

    // Try subtitles first (free, fast)
    const subtitleText = await trySubtitles(url, tmpBase);
    if (subtitleText) {
      content.textContent = subtitleText;
      content.transcript = subtitleText;
      return content;
    }

    // Fallback: download audio for transcription
    const audioPath = await downloadAudio(url, tmpBase);
    if (audioPath) {
      content.textContent = `[Audio heruntergeladen: ${audioPath}]`;
      // transcriber.ts handles the actual transcription
      (content as any).audioPath = audioPath;
    }

    return content;
  } catch (err) {
    console.error('Video-Extraktion fehlgeschlagen:', err);
    return content;
  }
}

async function trySubtitles(url: string, tmpBase: string): Promise<string | null> {
  try {
    await execFileAsync('yt-dlp', [
      '--write-sub', '--write-auto-sub',
      '--sub-lang', 'de,en',
      '--sub-format', 'vtt',
      '--skip-download',
      '-o', tmpBase,
      url,
    ], { timeout: 30000 });

    // Look for subtitle files
    for (const lang of ['de', 'en']) {
      for (const suffix of [`.${lang}.vtt`, `.${lang}.auto.vtt`]) {
        const subFile = tmpBase + suffix;
        if (existsSync(subFile)) {
          const raw = readFileSync(subFile, 'utf-8');
          const cleaned = cleanVtt(raw);
          unlinkSync(subFile);
          if (cleaned.length > 50) return cleaned;
        }
      }
    }
  } catch { /* no subtitles available */ }
  return null;
}

async function downloadAudio(url: string, tmpBase: string): Promise<string | null> {
  const audioPath = `${tmpBase}.mp3`;
  try {
    await execFileAsync('yt-dlp', [
      '-x', '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', audioPath,
      url,
    ], { timeout: 120000 });

    if (existsSync(audioPath)) return audioPath;
  } catch (err) {
    console.error('Audio-Download fehlgeschlagen:', err);
  }
  return null;
}

function cleanVtt(vtt: string): string {
  // Remove VTT headers, timestamps, and duplicate lines
  const lines = vtt.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headers, timestamps, empty lines
    if (!trimmed || trimmed.startsWith('WEBVTT') || trimmed.startsWith('Kind:') ||
        trimmed.startsWith('Language:') || /^\d{2}:\d{2}/.test(trimmed) ||
        /^[\d]+$/.test(trimmed) || trimmed.startsWith('NOTE')) {
      continue;
    }
    // Remove HTML tags
    const clean = trimmed.replace(/<[^>]+>/g, '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result.join(' ');
}

export function cleanupAudio(audioPath: string): void {
  try {
    if (existsSync(audioPath)) unlinkSync(audioPath);
  } catch { /* ignore */ }
}
