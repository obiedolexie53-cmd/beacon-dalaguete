/** Report reference numbers look like BEA-2026-000123. Generated server-side only. */
export const REFERENCE_NUMBER_PATTERN = /^BEA-\d{4}-\d{6}$/;

export function isReferenceNumber(value: string): boolean {
  return REFERENCE_NUMBER_PATTERN.test(value);
}
