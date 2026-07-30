/**
 * Default daily AI-generation cap per org, applied when the org's `ai_usage`
 * row for the day is first created. Single source of truth for both writers:
 * AIService.incrementUsage (message generation) and the call-transcription
 * BANT usage tracker. `daily_limit` is NOT NULL with no DB default, so every
 * `ai_usage` insert MUST provide it.
 */
export const DEFAULT_DAILY_LIMIT = 50;
