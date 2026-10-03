/** Small helpers for the API endpoints. */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Trimmed text from a form field, or '' if missing. */
export function text(form: FormData, name: string, max = 10000): string {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Like text(), but '' becomes null (for optional database columns). */
export function optional(form: FormData, name: string, max = 10000): string | null {
  return text(form, name, max) || null;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
}
