import type { SourceType } from '../types.js';

export function detectSource(url: string): SourceType {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
  if (hostname.includes('instagram.com')) return 'instagram';
  if (hostname.includes('tiktok.com')) return 'tiktok';
  return 'web';
}
