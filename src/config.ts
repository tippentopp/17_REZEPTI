import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  notionToken: process.env.NOTION_TOKEN || '',
  notionDatabaseId: process.env.NOTION_DATABASE_ID || '',
};

export function validateConfig(): string[] {
  const missing: string[] = [];
  if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
  if (!config.notionToken) missing.push('NOTION_TOKEN');
  if (!config.notionDatabaseId) missing.push('NOTION_DATABASE_ID');
  return missing;
}
