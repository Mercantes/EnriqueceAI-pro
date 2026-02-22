/**
 * Fit Score Engine — calculates lead quality score based on configured rules.
 * Pure function: no DB access, receives lead data and rules as input.
 */

export interface FitScoreRule {
  points: number;
  field: string;
  operator: 'contains' | 'equals' | 'not_empty' | 'starts_with';
  value: string | null;
}

export interface LeadData {
  [key: string]: string | number | null | undefined;
}

function getFieldValue(lead: LeadData, field: string): string | null {
  const val = lead[field];
  if (val === undefined || val === null) return null;
  return String(val);
}

function matchRule(
  fieldValue: string | null,
  operator: string,
  ruleValue: string | null,
): boolean {
  switch (operator) {
    case 'not_empty':
      return fieldValue !== null && fieldValue.trim().length > 0;
    case 'contains':
      if (!fieldValue || !ruleValue) return false;
      return fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    case 'equals':
      if (!fieldValue || !ruleValue) return false;
      return fieldValue.toLowerCase() === ruleValue.toLowerCase();
    case 'starts_with':
      if (!fieldValue || !ruleValue) return false;
      return fieldValue.toLowerCase().startsWith(ruleValue.toLowerCase());
    default:
      return false;
  }
}

/**
 * Calculate the fit score for a lead based on the given rules.
 * Returns null if there are no rules (score is undefined, not zero).
 */
export function calculateFitScore(
  lead: LeadData,
  rules: FitScoreRule[],
): number | null {
  if (rules.length === 0) return null;

  let score = 0;
  for (const rule of rules) {
    const value = getFieldValue(lead, rule.field);
    if (matchRule(value, rule.operator, rule.value)) {
      score += rule.points;
    }
  }
  return score;
}
