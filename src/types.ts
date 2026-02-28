export type SourceType = 'youtube' | 'instagram' | 'tiktok' | 'web';

export interface ExtractedContent {
  sourceType: SourceType;
  url: string;
  title?: string;
  imageUrl?: string;
  textContent?: string;
  transcript?: string;
}

export interface ParsedRecipe {
  name: string;
  emoji: string;
  cookingTime: 'kurz (<20min)' | 'mittel (20-45min)' | 'lang (>45min)';
  tags: string[];
  imageUrl: string;
  calories: number;
  servings: number;
  ingredients: string;
  instructions: string;
  transcript?: string;
}

export interface ImportJob {
  id: string;
  url: string;
  step: string;
  progress: number;
  message: string;
  notionUrl?: string;
  error?: string;
  sourceType?: SourceType;
  recipe?: ParsedRecipe;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costCents: number;
  };
}
