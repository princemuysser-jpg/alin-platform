const allowedOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = allowedOrigins.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin');
  return !origin || allowedOrigins.has(origin);
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}
