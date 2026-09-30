/** Format a stored E.164 Philippine mobile number for display: +639171234567 → +63 917 123 4567. */
export function formatPhMobile(e164: string): string {
  const match = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(e164);
  return match ? `+63 ${match[1]} ${match[2]} ${match[3]}` : e164;
}
