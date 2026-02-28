import express from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config.js';
import type { ImportJob } from './types.js';
import { detectSource } from './services/source-detector.js';
import { scrapeWebRecipe } from './services/web-scraper.js';
import { analyzeRecipe, analyzeRecipeFromImage } from './services/recipe-analyzer.js';
import { exportToNotion } from './services/notion-exporter.js';
import { extractVideo, cleanupAudio } from './services/video-extractor.js';
import { transcribeAudio } from './services/transcriber.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory job store
const jobs = new Map<string, ImportJob>();

app.post('/api/import', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL ist erforderlich' });
    return;
  }

  const jobId = randomUUID();
  const job: ImportJob = {
    id: jobId,
    url,
    step: 'queued',
    progress: 0,
    message: 'Import gestartet...',
  };
  jobs.set(jobId, job);

  // Start pipeline async
  processImport(job).catch((err) => {
    job.step = 'error';
    job.progress = 0;
    job.error = err instanceof Error ? err.message : 'Unbekannter Fehler';
    job.message = `Fehler: ${job.error}`;
  });

  res.json({ jobId });
});

app.post('/api/import-text', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Text ist erforderlich' });
    return;
  }

  const jobId = randomUUID();
  const job: ImportJob = {
    id: jobId,
    url: 'freitext',
    step: 'analyzing',
    progress: 30,
    message: 'Text wird mit Claude analysiert...',
  };
  jobs.set(jobId, job);

  (async () => {
    try {
      const content: import('./types.js').ExtractedContent = {
        sourceType: 'web',
        url: 'freitext',
        textContent: text,
      };
      const { recipe, usage } = await analyzeRecipe(content);
      job.usage = usage;
      job.recipe = recipe;
      job.sourceType = 'web';
      job.step = 'preview';
      job.progress = 75;
      job.message = 'Rezept analysiert - bitte pruefen und bestaetigen';
    } catch (err) {
      job.step = 'error';
      job.error = err instanceof Error ? err.message : 'Analyse fehlgeschlagen';
      job.message = `Fehler: ${job.error}`;
    }
  })();

  res.json({ jobId });
});

app.post('/api/import-photo', async (req, res) => {
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    res.status(400).json({ error: 'Bild ist erforderlich' });
    return;
  }

  const jobId = randomUUID();
  const job: ImportJob = {
    id: jobId,
    url: 'foto-upload',
    step: 'analyzing',
    progress: 30,
    message: 'Foto wird mit Claude analysiert...',
  };
  jobs.set(jobId, job);

  // Async verarbeiten
  (async () => {
    try {
      const { recipe, usage } = await analyzeRecipeFromImage(image);
      job.usage = usage;
      job.recipe = recipe;
      job.sourceType = 'web';
      job.step = 'preview';
      job.progress = 75;
      job.message = 'Rezept analysiert - bitte pruefen und bestaetigen';
    } catch (err) {
      job.step = 'error';
      job.error = err instanceof Error ? err.message : 'Analyse fehlgeschlagen';
      job.message = `Fehler: ${job.error}`;
    }
  })();

  res.json({ jobId });
});

app.post('/api/confirm/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.step !== 'preview') {
    res.status(400).json({ error: 'Job nicht bereit zur Bestaetigung' });
    return;
  }

  // Uebernehme Aenderungen vom User
  const { recipe: editedRecipe, notes } = req.body;
  if (editedRecipe) {
    job.recipe = { ...job.recipe!, ...editedRecipe };
  }

  job.step = 'exporting';
  job.progress = 85;
  job.message = 'Wird in Notion gespeichert...';

  try {
    const notionUrl = await exportToNotion(job.recipe!, job.url, job.sourceType!, notes);
    job.notionUrl = notionUrl;
    job.step = 'done';
    job.progress = 100;
    job.message = 'Rezept erfolgreich importiert!';
    res.json({ notionUrl });
  } catch (err) {
    job.step = 'error';
    job.error = err instanceof Error ? err.message : 'Export fehlgeschlagen';
    job.message = `Fehler: ${job.error}`;
    res.status(500).json({ error: job.error });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job nicht gefunden' });
    return;
  }
  res.json(job);
});

async function processImport(job: ImportJob): Promise<void> {
  // Step 1: Quelle erkennen
  job.step = 'detecting';
  job.progress = 5;
  job.message = 'Quelle wird erkannt...';
  const sourceType = detectSource(job.url);

  // Step 2: Inhalt extrahieren
  job.step = 'extracting';
  job.progress = 15;
  job.message = `Inhalt wird von ${sourceType} extrahiert...`;

  let content;
  if (sourceType === 'web') {
    content = await scrapeWebRecipe(job.url);
  } else {
    // Video-Quellen: yt-dlp fuer Untertitel/Audio
    content = await extractVideo(job.url, sourceType);

    // Falls Audio heruntergeladen, transkribieren
    const audioPath = (content as any).audioPath;
    if (audioPath && !content.transcript) {
      job.step = 'transcribing';
      job.progress = 40;
      job.message = 'Audio wird transkribiert...';
      try {
        content.transcript = await transcribeAudio(audioPath);
        content.textContent = content.transcript;
      } catch (err) {
        console.error('Transkription fehlgeschlagen:', err);
      } finally {
        cleanupAudio(audioPath);
      }
    }
  }

  // Step 3: Rezept analysieren
  job.step = 'analyzing';
  job.progress = 60;
  job.message = 'Rezept wird mit Claude analysiert...';
  const { recipe, usage } = await analyzeRecipe(content);
  job.usage = usage;
  job.recipe = recipe;
  job.sourceType = sourceType;

  // Pause: Warte auf User-Bestaetigung/Bearbeitung
  job.step = 'preview';
  job.progress = 75;
  job.message = 'Rezept analysiert - bitte pruefen und bestaetigen';
}

const missing = validateConfig();
if (missing.length > 0) {
  console.warn(`\n⚠️  Fehlende Umgebungsvariablen: ${missing.join(', ')}`);
  console.warn('   Kopiere .env.example nach .env und fuege deine Keys ein.\n');
}

app.listen(config.port, () => {
  console.log(`\n🍳 Rezepti laeuft auf http://localhost:${config.port}\n`);
});
