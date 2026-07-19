import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts';
import { cleanText, removeLegacyPassword, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(isAllowedOrigin(req) ? 'ok' : 'origin not allowed', { status: isAllowedOrigin(req) ? 200 : 403, headers: corsHeaders(req) });
  if (!isAllowedOrigin(req)) return jsonResponse(req, { ok: false, error: 'المصدر غير مسموح' }, 403);
  if (req.method !== 'POST') return jsonResponse(req, { ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json();
    const accountId = cleanText(body.account_id, 80);
    const password = String(body.password || '');
    if (!accountId) throw new Error('معرّف الحساب مطلوب');
    if (password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');

    const { data: account, error } = await admin
      .from('accounts')
      .select('id,auth_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!account?.auth_user_id) throw new Error('الحساب غير مربوط بخدمة الدخول. افتح تعديل الحساب واربطه أولاً');

    const { error: updateError } = await admin.auth.admin.updateUserById(String(account.auth_user_id), { password });
    if (updateError) throw updateError;
    await removeLegacyPassword(admin, 'accounts', accountId);
    await removeLegacyPassword(admin, 'couriers', accountId);
    return jsonResponse(req, { ok: true });
  } catch (error) {
    return jsonResponse(req, { ok: false, error: error instanceof Error ? error.message : 'تعذر تغيير كلمة المرور' }, 400);
  }
});
