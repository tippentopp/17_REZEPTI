import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function transcribeAudio(audioPath: string): Promise<string> {
  // Try WhisperFlow first (locally installed)
  try {
    const { stdout } = await execFileAsync('whisperflow', [
      '--model', 'base',
      '--language', 'de',
      '--output-format', 'txt',
      audioPath,
    ], { timeout: 300000 }); // 5 min timeout

    if (stdout.trim().length > 50) return stdout.trim();
  } catch {
    console.log('WhisperFlow nicht verfuegbar, versuche whisper CLI...');
  }

  // Try whisper CLI
  try {
    const { stdout } = await execFileAsync('whisper', [
      audioPath,
      '--model', 'base',
      '--language', 'de',
      '--output_format', 'txt',
    ], { timeout: 300000 });

    if (stdout.trim().length > 50) return stdout.trim();
  } catch {
    console.log('Whisper CLI nicht verfuegbar');
  }

  throw new Error('Keine Transkriptions-Engine verfuegbar. Installiere WhisperFlow oder Whisper.');
}
