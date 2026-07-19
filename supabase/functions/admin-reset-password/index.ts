import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts';
import { cleanText, emailForUsername, normalizeUsername, removeLegacyPassword, requireAdmin } from '../_shared/admin.ts';

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
      .select('id,auth_user_id,name,username,role,status')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!account) throw new Error('الحساب غير موجود');

    if (account.auth_user_id) {
      const { error: updateError } = await admin.auth.admin.updateUserById(String(account.auth_user_id), { password });
      if (updateError) throw updateError;
    } else {
      const username = normalizeUsername(account.username);
      if (!username) throw new Error('اسم الدخول غير موجود لهذا الحساب');
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: emailForUsername(username),
        password,
        email_confirm: true,
        user_metadata: {
          name: cleanText(account.name, 120),
          username,
          role: cleanText(account.role, 30),
        },
      });
      if (createError || !created.user) throw createError || new Error('تعذر ربط الحساب بخدمة الدخول');
      const { error: linkError } = await admin
        .from('accounts')
        .update({ auth_user_id: created.user.id, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (linkError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw linkError;
      }
    }

    await removeLegacyPassword(admin, 'accounts', accountId);
    await removeLegacyPassword(admin, 'couriers', accountId);
    return jsonResponse(req, { ok: true, linked: !account.auth_user_id });
  } catch (error) {
    return jsonResponse(req, { ok: false, error: error instanceof Error ? error.message : 'تعذر تغيير كلمة المرور' }, 400);
  }
});
