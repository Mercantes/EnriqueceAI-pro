import { TEMPLATE_VARIABLE_REGEX } from '../cadence.schemas';

/**
 * Extracts variable names from a template string.
 * Variables use {{variable_name}} syntax.
 */
export function extractVariables(template: string): string[] {
  const matches = [...template.matchAll(TEMPLATE_VARIABLE_REGEX)].map((m) => m[1]).filter((v): v is string => v != null);
  return [...new Set(matches)];
}

/**
 * Renders a template by replacing {{variable}} placeholders with values.
 * Unknown variables are left as-is.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | null | undefined>,
): string {
  return template.replace(TEMPLATE_VARIABLE_REGEX, (match, varName: string) => {
    const value = variables[varName];
    return value != null ? value : match;
  });
}
