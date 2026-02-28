import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { ExtractedContent, ParsedRecipe } from '../types.js';

const SYSTEM_PROMPT = `Du bist ein Rezept-Extraktor. Analysiere den folgenden Text und extrahiere das Kochrezept.

WICHTIG: Rechne das Rezept IMMER auf 4 Portionen um (fuer eine Person: ca. 80kg, 180cm).

Antworte AUSSCHLIESSLICH mit validem JSON in diesem Format:
{
  "name": "Rezeptname auf Deutsch",
  "emoji": "passendes einzelnes Emoji",
  "cookingTime": "kurz (<20min)" | "mittel (20-45min)" | "lang (>45min)",
  "tags": ["tag1", "tag2"],
  "imageUrl": "",
  "calories": 450,
  "servings": 4,
  "ingredients": "- 200g Mehl\\n- 3 Eier\\n...",
  "instructions": "1. Mehl sieben...\\n2. ..."
}

Regeln:
- Alle Mengenangaben in metrischen Einheiten (g, ml, l, cm)
- Cups/Ounces/Fahrenheit in metrisch umrechnen
- Rezept auf Deutsch schreiben (auch wenn Quelle englisch)
- Kalorien PRO PORTION schaetzen (Referenz: 80kg, 180cm Person)
- servings ist immer 4 (Basis fuer Umrechnung)
- Mengenangaben IMMER als Zahl am Anfang der Zeile (z.B. "- 200g Mehl", "- 3 Eier", "- 0.5l Milch")
- Tags aus: vegetarisch, vegan, glutenfrei, Alltag, Wochenende, Meal Prep, Dessert, Fruehstueck, Asiatisch, Italienisch, Mexikanisch, Indisch, Deutsch, Schnell
- Wenn ein Bild-Link im Text vorkommt, in imageUrl uebernehmen
- Kein Markdown in name, nur im ingredients/instructions Feld`;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

export interface AnalyzeResult {
  recipe: ParsedRecipe;
  usage: TokenUsage;
}

// Sonnet 4 pricing: $3/1M input, $15/1M output
const PRICE_INPUT_PER_TOKEN = 3 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 15 / 1_000_000;

export async function analyzeRecipeFromImage(base64Image: string): Promise<AnalyzeResult> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  // Strip data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const mediaType = base64Image.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64Data } },
        { type: 'text', text: 'Extrahiere das Rezept aus diesem Bild.' },
      ],
    }],
  });

  const { input_tokens, output_tokens } = response.usage;
  const costCents = (input_tokens * PRICE_INPUT_PER_TOKEN + output_tokens * PRICE_OUTPUT_PER_TOKEN) * 100;
  const usage: TokenUsage = { inputTokens: input_tokens, outputTokens: output_tokens, costCents };

  console.log(`📸 Foto-Analyse | Tokens: ${input_tokens} in / ${output_tokens} out | Kosten: ${costCents.toFixed(2)}¢`);

  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude konnte kein Rezept im Bild erkennen');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedRecipe;
  return { recipe: parsed, usage };
}

export async function analyzeRecipe(content: ExtractedContent): Promise<AnalyzeResult> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const text = [
    content.title ? `Titel: ${content.title}` : '',
    content.textContent || '',
    content.transcript ? `\nTranskript:\n${content.transcript}` : '',
  ].filter(Boolean).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text.slice(0, 15000) }],
  });

  const { input_tokens, output_tokens } = response.usage;
  const costCents = (input_tokens * PRICE_INPUT_PER_TOKEN + output_tokens * PRICE_OUTPUT_PER_TOKEN) * 100;
  const usage: TokenUsage = { inputTokens: input_tokens, outputTokens: output_tokens, costCents };

  console.log(`💰 Tokens: ${input_tokens} in / ${output_tokens} out | Kosten: ${costCents.toFixed(2)}¢`);

  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude hat kein valides JSON zurueckgegeben');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedRecipe;

  // Use image from scraping if Claude didn't find one
  if (!parsed.imageUrl && content.imageUrl) {
    parsed.imageUrl = content.imageUrl;
  }

  // Attach transcript if available
  if (content.transcript) {
    parsed.transcript = content.transcript;
  }

  return { recipe: parsed, usage };
}
