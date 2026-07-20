import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { cleanText, ensureAuthUserForAccount, removeLegacyPassword, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json();
    const accountId = cleanText(body.account_id, 80);
    const password = String(body.password || '');
    if (!accountId) throw new Error('معرّف الحساب مطلوب');
    if (password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');

    const { data: account, error } = await admin
      .from('accounts')
      .select('id,role,name,username,status,auth_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!account) throw new Error('الحساب غير موجود');

    const resolved = await ensureAuthUserForAccount(admin, {
      accountId,
      authUserId: account.auth_user_id ? String(account.auth_user_id) : null,
      username: cleanText(account.username, 80),
      password,
      name: cleanText(account.name, 120),
      role: cleanText(account.role, 30),
    });

    if (String(account.auth_user_id || '') !== resolved.id) {
      const { error: linkError } = await admin
        .from('accounts')
        .update({ auth_user_id: resolved.id, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (linkError) {
        if (resolved.created) await admin.auth.admin.deleteUser(resolved.id);
        throw linkError;
      }
    }
    await removeLegacyPassword(admin, 'accounts', accountId);
    await removeLegacyPassword(admin, 'couriers', accountId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'تعذر تغيير كلمة المرور' }, 400);
  }
});
