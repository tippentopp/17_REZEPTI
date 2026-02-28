# Rezepti

Rezept-Extraktor: URL, Foto oder Text rein → Rezept in Notion raus.

## Tech-Stack
- TypeScript + Node.js (ESM)
- Express (Server + Static Files)
- Playwright (Web-Scraping)
- Claude API via @anthropic-ai/sdk (Rezept-Analyse + Vision)
- Notion API via @notionhq/client (Export)
- yt-dlp (Video-Extraktion)
- WhisperFlow/Whisper (Audio-Transkription)

## Commands
- `npm run dev` - Dev-Server mit Hot-Reload (tsx watch)
- `npm run build` - TypeScript kompilieren
- `npm start` - Production-Server

## Architektur
```
URL/Foto/Text -> source-detector -> web-scraper / video-extractor / claude-vision
    -> transcriber (falls Audio) -> recipe-analyzer (Claude)
    -> Vorschau (User kann editieren) -> notion-exporter -> Notion DB
```

## API Endpoints
- POST /api/import - URL-Import
- POST /api/import-photo - Foto-Upload (base64)
- POST /api/import-text - Freitext-Import
- POST /api/confirm/:jobId - Vorschau bestaetigen + nach Notion exportieren
- GET /api/status/:jobId - Job-Status abfragen

## Features
- 3 Import-Wege: URL, Foto (Claude Vision), Freitext
- Vorschau + Bearbeiten vor Notion-Export
- Portionen-Dropdown (2-10 Personen, Default 4, client-seitige Umrechnung)
- Eigene Anmerkungen (landen als Abschnitt in Notion)
- Token-Logging (Kosten pro Import im UI + Terminal)
- Rezepte immer auf 4 Portionen normiert (Referenz: 80kg/180cm)

## Deployment
- Docker auf Synology DS918+
- Reverse Proxy: extraplus.synology.me:8443 -> localhost:3000
- Details: siehe memory/synology-docker-deployment.md

## Umgebungsvariablen (.env)
- ANTHROPIC_API_KEY
- NOTION_TOKEN
- NOTION_DATABASE_ID
- PORT (default: 3000)

## Notion DB
- Database ID: 315b98cc851f808cb78af12847b8f619
- Properties: Name (Title), Link (URL), Foto (URL), Kochdauer (Select), Tags (Multi-select), Ausprobiert (Checkbox), Kalorien (Number), Quelle (Select)
