import { createClient } from 'npm:@supabase/supabase-js@2.110.7';
import { corsHeaders, jsonResponse, publicError } from '../_shared/cors.ts';
import { cleanText, emailForUsername, normalizeUsername } from '../_shared/admin.ts';

function requestIp(req: Request): string {
  return cleanText(
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0] ||
    'unknown',
    80,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new Error('إعدادات تسجيل الدخول غير مكتملة');

    const body = await req.json();
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const device = cleanText(body.device_id, 160) || 'browser-session';
    if (!username || !password) throw new Error('اكتب اسم الدخول وكلمة المرور');

    const guardDevice = `${device}|${requestIp(req)}`;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: guard, error: guardError } = await admin.rpc('alin_login_guard_check', {
      p_identifier: username,
      p_device: guardDevice,
    });
    if (guardError) throw guardError;
    if (guard?.allowed === false) {
      const minutes = Math.max(1, Math.ceil(Number(guard.retry_after_seconds || 60) / 60));
      return jsonResponse(req, { ok: false, error: `تم إيقاف المحاولات مؤقتاً. حاول بعد ${minutes} دقيقة` }, 429);
    }

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: emailForUsername(username),
      password,
    });
    if (error || !data.session || !data.user) {
      const { data: failed } = await admin.rpc('alin_login_guard_fail', {
        p_identifier: username,
        p_device: guardDevice,
      });
      const locked = failed?.allowed === false;
      const remaining = Math.max(0, Number(failed?.remaining ?? 0));
      return jsonResponse(req, {
        ok: false,
        error: locked ? 'تم إيقاف المحاولات لمدة 15 دقيقة بسبب تكرار الخطأ' : `بيانات الدخول غير صحيحة. المحاولات المتبقية: ${remaining}`,
      }, locked ? 429 : 401);
    }

    const signedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    });
    await signedClient.rpc('alin_login_guard_success', { p_identifier: username, p_device: guardDevice });

    return jsonResponse(req, {
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
      },
      user: { id: data.user.id },
    });
  } catch (error) {
    return jsonResponse(req, { ok: false, error: publicError(error, 'تعذر تسجيل الدخول حالياً') }, 400);
  }
});
