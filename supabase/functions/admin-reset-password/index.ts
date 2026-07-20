import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { cleanText, emailForUsername, removeLegacyPassword, requireAdmin } from '../_shared/admin.ts';

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

    let authUserId = account.auth_user_id ? String(account.auth_user_id) : '';
    if (!authUserId) {
      const username = cleanText(account.username, 80);
      const name = cleanText(account.name, 120);
      const role = cleanText(account.role, 30);
      if (!username || !name) throw new Error('أكمل اسم الحساب واسم الدخول أولاً');
      const email = emailForUsername(username);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username, role },
      });
      if (createError || !created.user) throw createError || new Error('تعذر ربط الحساب بخدمة الدخول');
      authUserId = created.user.id;
      const { error: linkError } = await admin
        .from('accounts')
        .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (linkError) {
        await admin.auth.admin.deleteUser(authUserId);
        throw linkError;
      }
    } else {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, { password });
      if (updateError) throw updateError;
    }
    await removeLegacyPassword(admin, 'accounts', accountId);
    await removeLegacyPassword(admin, 'couriers', accountId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'تعذر تغيير كلمة المرور' }, 400);
  }
});
