import { corsHeaders, jsonResponse, publicError } from '../_shared/cors.ts';
import { cleanText, requireAdmin, requireSuperAdmin } from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const context = await requireAdmin(req, 'accounts');
    const { admin, caller } = context;
    const body = await req.json();
    const accountId = cleanText(body.account_id, 80);
    if (!accountId) throw new Error('معرّف الحساب مطلوب');
    if (accountId === caller.accountId) throw new Error('لا يمكن أرشفة حسابك الحالي');

    const { data: account, error } = await admin
      .from('accounts')
      .select('id,role,auth_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    if (!account) throw new Error('الحساب غير موجود');
    if (account.role === 'admin') requireSuperAdmin(context);

    const now = new Date().toISOString();
    if (account.role === 'courier') {
      const { error: courierError } = await admin.from('couriers').update({ status: 'inactive', updated_at: now }).eq('id', accountId);
      if (courierError && !String(courierError.message).toLowerCase().includes('does not exist')) throw courierError;
    }

    const { error: archiveError } = await admin.from('accounts').update({
      status: 'inactive',
      deleted_at: now,
      auth_user_id: null,
      updated_at: now,
    }).eq('id', accountId);
    if (archiveError) throw archiveError;

    let authWarning = '';
    if (account.auth_user_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(String(account.auth_user_id));
      if (authDeleteError) authWarning = 'تم إيقاف الحساب داخل المنصة، لكن تعذر حذف جلسة الدخول القديمة من Auth';
    }
    return jsonResponse(req, { ok: true, archived: true, warning: authWarning || undefined });
  } catch (error) {
    return jsonResponse(req, { ok: false, error: publicError(error, 'تعذر أرشفة الحساب') }, 400);
  }
});
