import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { cleanText, requireAdmin } from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const { admin, caller } = await requireAdmin(req);
    const body = await req.json();
    const accountId = cleanText(body.account_id, 80);
    if (!accountId) throw new Error('معرّف الحساب مطلوب');
    if (accountId === caller.accountId) throw new Error('لا يمكن للمدير حذف حسابه الحالي');

    const { data: account, error } = await admin
      .from('accounts')
      .select('id,role,auth_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!account) throw new Error('الحساب غير موجود');

    if (account.role === 'courier') {
      const { error: courierDeleteError } = await admin.from('couriers').delete().eq('id', accountId);
      if (courierDeleteError && !String(courierDeleteError.message).toLowerCase().includes('does not exist')) throw courierDeleteError;
    }
    const { error: accountDeleteError } = await admin.from('accounts').delete().eq('id', accountId);
    if (accountDeleteError) throw accountDeleteError;

    let authWarning = '';
    if (account.auth_user_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(String(account.auth_user_id));
      if (authDeleteError) authWarning = 'تم حذف الحساب من قاعدة البيانات لكن تعذر حذف مستخدم Auth؛ راجعه من Authentication > Users';
    }
    return jsonResponse({ ok: true, warning: authWarning || undefined });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'تعذر حذف الحساب' }, 400);
  }
});
