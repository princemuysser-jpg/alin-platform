const DEFAULT_ORIGINS = ['https://princemuysser-jpg.github.io'];

function allowedOrigins(): string[] {
  const configured = (Deno.env.get('ALIN_ALLOWED_ORIGINS') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...configured])];
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') || '';
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const allowed = allowedOrigins().includes(origin) || local;
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export function publicError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (message && /[\u0600-\u06FF]/.test(message) && message.length <= 240 && !/(column|schema|postgres|relation|constraint|stack|jwt|sqlstate)/i.test(message)) {
    return message;
  }
  return fallback;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
