# Rezepti

Rezept-Extraktor: URL rein, Rezept in Notion raus.

## Tech-Stack
- TypeScript + Node.js (ESM)
- Express (Server + Static Files)
- Playwright (Web-Scraping)
- Claude API via @anthropic-ai/sdk (Rezept-Analyse)
- Notion API via @notionhq/client (Export)
- yt-dlp (Video-Extraktion)
- WhisperFlow/Whisper (Audio-Transkription)

## Commands
- `npm run dev` - Dev-Server mit Hot-Reload (tsx watch)
- `npm run build` - TypeScript kompilieren
- `npm start` - Production-Server

## Architektur
```
URL -> source-detector -> web-scraper / video-extractor
    -> transcriber (falls Audio) -> recipe-analyzer (Claude)
    -> notion-exporter -> Notion DB
```

## Umgebungsvariablen (.env)
- ANTHROPIC_API_KEY
- NOTION_TOKEN
- NOTION_DATABASE_ID
- PORT (default: 3000)

## Notion DB Properties
Name (Title), Link (URL), Foto (URL), Kochdauer (Select), Tags (Multi-select), Ausprobiert (Checkbox), Kalorien (Number), Quelle (Select)
