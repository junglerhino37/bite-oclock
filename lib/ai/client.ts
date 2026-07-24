import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Server-side Anthropic client. The API key must NEVER reach the browser:
 * only route handlers import this module ("server-only" enforces it at build time). */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Menu photos are hard OCR (rotated boards, glare, dense type) — worth the
// bigger model. Haiku stays fine for the NL-query side.
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL ?? "claude-sonnet-5";
export const QUERY_MODEL = process.env.QUERY_MODEL ?? "claude-haiku-4-5-20251001";

/** Pull the first JSON object out of a model reply and return it raw.
 * Callers MUST validate with a zod schema before using it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON in model reply");
  return JSON.parse(text.slice(start, end + 1));
}
