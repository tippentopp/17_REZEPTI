import { chromium, type Browser } from 'playwright';
import type { ExtractedContent } from '../types.js';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function scrapeWebRecipe(url: string): Promise<ExtractedContent> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try JSON-LD schema first (most recipe sites have this)
    const jsonLd = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          // Could be an array or single object
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Recipe') return item;
            // Check @graph array
            if (item['@graph']) {
              const recipe = item['@graph'].find((g: any) => g['@type'] === 'Recipe');
              if (recipe) return recipe;
            }
          }
        } catch { /* ignore parse errors */ }
      }
      return null;
    });

    if (jsonLd) {
      return {
        sourceType: 'web',
        url,
        title: jsonLd.name || undefined,
        imageUrl: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image || undefined,
        textContent: formatJsonLdRecipe(jsonLd),
      };
    }

    // Fallback: extract main text content
    const textContent = await page.evaluate(() => {
      const main = document.querySelector('main, article, [role="main"], .recipe, .post-content');
      return ((main || document.body) as HTMLElement).innerText.slice(0, 10000);
    });

    const title = await page.title();
    const imageUrl = await page.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"]');
      return og?.getAttribute('content') || undefined;
    });

    return { sourceType: 'web', url, title, imageUrl, textContent };
  } finally {
    await page.close();
  }
}

function formatJsonLdRecipe(data: any): string {
  const parts: string[] = [];
  if (data.name) parts.push(`Rezept: ${data.name}`);
  if (data.description) parts.push(`Beschreibung: ${data.description}`);
  if (data.prepTime) parts.push(`Vorbereitungszeit: ${data.prepTime}`);
  if (data.cookTime) parts.push(`Kochzeit: ${data.cookTime}`);
  if (data.totalTime) parts.push(`Gesamtzeit: ${data.totalTime}`);
  if (data.recipeYield) parts.push(`Portionen: ${data.recipeYield}`);

  if (data.recipeIngredient) {
    parts.push('\nZutaten:');
    for (const ing of data.recipeIngredient) {
      parts.push(`- ${ing}`);
    }
  }

  if (data.recipeInstructions) {
    parts.push('\nZubereitung:');
    if (Array.isArray(data.recipeInstructions)) {
      for (const step of data.recipeInstructions) {
        const text = typeof step === 'string' ? step : step.text || step.name || '';
        if (text) parts.push(`- ${text}`);
      }
    } else {
      parts.push(data.recipeInstructions);
    }
  }

  if (data.nutrition) {
    parts.push('\nNaehrwerte:');
    if (data.nutrition.calories) parts.push(`Kalorien: ${data.nutrition.calories}`);
  }

  return parts.join('\n');
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
