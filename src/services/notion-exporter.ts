import { Client } from '@notionhq/client';
import { config } from '../config.js';
import type { ParsedRecipe, SourceType } from '../types.js';

const notion = new Client({ auth: config.notionToken });

export async function exportToNotion(
  recipe: ParsedRecipe,
  originalUrl: string,
  sourceType: SourceType,
  notes?: string,
): Promise<string> {
  const children: any[] = [];

  // Zutaten
  children.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Zutaten' } }] },
  });

  for (const line of recipe.ingredients.split('\n')) {
    const text = line.replace(/^[-*•]\s*/, '').trim();
    if (!text) continue;
    children.push({
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: [{ text: { content: text } }] },
    });
  }

  // Zubereitung
  children.push({
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Zubereitung' } }] },
  });

  for (const line of recipe.instructions.split('\n')) {
    const text = line.replace(/^\d+[.)]\s*/, '').trim();
    if (!text) continue;
    children.push({
      type: 'numbered_list_item',
      numbered_list_item: { rich_text: [{ text: { content: text } }] },
    });
  }

  // Eigene Anmerkungen
  if (notes?.trim()) {
    children.push({ type: 'divider', divider: {} });
    children.push({
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: 'Anmerkungen' } }] },
    });
    for (const line of notes.split('\n')) {
      if (!line.trim()) continue;
      children.push({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: line } }] },
      });
    }
  }

  // Transkript als Toggle (nur bei Video-Quellen)
  if (recipe.transcript) {
    children.push({ type: 'divider', divider: {} });
    children.push({
      type: 'toggle',
      toggle: {
        rich_text: [{ text: { content: 'Original-Transkript' } }],
        children: splitTextIntoBlocks(recipe.transcript),
      },
    });
  }

  const response = await notion.pages.create({
    parent: { database_id: config.notionDatabaseId },
    icon: { type: 'emoji', emoji: recipe.emoji as any },
    properties: {
      Name: { title: [{ text: { content: recipe.name } }] },
      Link: { url: originalUrl },
      Kochdauer: { select: { name: recipe.cookingTime } },
      Tags: { multi_select: recipe.tags.map((t) => ({ name: t })) },
      Ausprobiert: { checkbox: false },
      Kalorien: { number: recipe.calories },
      Quelle: { select: { name: sourceType.charAt(0).toUpperCase() + sourceType.slice(1) } },
      ...(recipe.imageUrl ? { Foto: { url: recipe.imageUrl } } : {}),
    },
    children: children.slice(0, 100), // Notion API limit
  });

  return (response as any).url;
}

function splitTextIntoBlocks(text: string): any[] {
  // Notion block text limit is 2000 chars
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 1900) {
    chunks.push(text.slice(i, i + 1900));
  }
  return chunks.map((chunk) => ({
    type: 'paragraph',
    paragraph: { rich_text: [{ text: { content: chunk } }] },
  }));
}
