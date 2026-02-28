FROM node:22-bookworm

# System-Dependencies fuer Playwright, yt-dlp, Whisper
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Python-Tools in venv (Debian erfordert das)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir yt-dlp openai-whisper

WORKDIR /app

# Dependencies installieren
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Playwright Chromium installieren (mit System-Deps)
RUN npx playwright install --with-deps chromium

# TypeScript-Build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run build && npm prune --omit=dev

# Frontend
COPY public/ ./public/

EXPOSE 3000
CMD ["node", "dist/server.js"]
