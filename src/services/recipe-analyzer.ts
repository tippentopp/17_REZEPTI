import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { ExtractedContent, ParsedRecipe } from '../types.js';

const SYSTEM_PROMPT = `Du bist ein Rezept-Extraktor. Analysiere den folgenden Text und extrahiere das Kochrezept.

Antworte AUSSCHLIESSLICH mit validem JSON in diesem Format:
{
  "name": "Rezeptname auf Deutsch",
  "emoji": "passendes einzelnes Emoji",
  "cookingTime": "kurz (<20min)" | "mittel (20-45min)" | "lang (>45min)",
  "tags": ["tag1", "tag2"],
  "imageUrl": "",
  "calories": 450,
  "ingredients": "- 200g Mehl\\n- 3 Eier\\n...",
  "instructions": "1. Mehl sieben...\\n2. ..."
}

Regeln:
- Alle Mengenangaben in metrischen Einheiten (g, ml, l, cm)
- Cups/Ounces/Fahrenheit in metrisch umrechnen
- Rezept auf Deutsch schreiben (auch wenn Quelle englisch)
- Kalorien pro Portion schaetzen
- Tags aus: vegetarisch, vegan, glutenfrei, Alltag, Wochenende, Meal Prep, Dessert, Fruehstueck, Asiatisch, Italienisch, Mexikanisch, Indisch, Deutsch, Schnell
- Wenn ein Bild-Link im Text vorkommt, in imageUrl uebernehmen
- Kein Markdown in name, nur im ingredients/instructions Feld`;

export async function analyzeRecipe(content: ExtractedContent): Promise<ParsedRecipe> {
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

  return parsed;
}
