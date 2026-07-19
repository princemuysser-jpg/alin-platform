import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  cleanText,
  emailForUsername,
  insertCompat,
  normalizeUsername,
  publicAccount,
  removeLegacyPassword,
  requireAdmin,
  updateCompat,
} from '../_shared/admin.ts';

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'library', 'courier', 'accountant']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'الطريقة غير مسموحة' }, 405);

  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json();
    const accountId = cleanText(body.account_id, 80);
    if (!accountId) throw new Error('معرّف الحساب مطلوب');

    let { data: account, error: accountError } = await admin
      .from('accounts')
      .select('id,role,name,username,status,auth_user_id')
      .eq('id', accountId)
      .maybeSingle();
    if (accountError) throw accountError;

    const requestedRole = cleanText(body.role || account?.role || 'courier', 30).toLowerCase();
    if (!ALLOWED_ROLES.has(requestedRole)) throw new Error('نوع الحساب غير مدعوم');
    const username = body.username === undefined ? normalizeUsername(account?.username) : normalizeUsername(body.username);
    const name = body.name === undefined ? cleanText(account?.name, 120) : cleanText(body.name, 120);
    const password = String(body.password || '');

    // Seamless migration for a legacy courier row that has no accounts/Auth user yet.
    if (!account) {
      if (requestedRole !== 'courier') throw new Error('الحساب غير موجود');
      if (!username || !name || password.length < 8) {
        throw new Error('هذا مندوب قديم غير مربوط. اكتب اسمه واسم الدخول وكلمة مرور جديدة من 8 أحرف لترحيله');
      }
      const email = emailForUsername(username);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username, role: 'courier' },
      });
      if (createError || !created.user) throw createError || new Error('تعذر إنشاء مستخدم الدخول');
      try {
        account = await insertCompat(admin, 'accounts', {
          id: accountId,
          role: 'courier',
          name,
          username,
          status: body.status || 'active',
          auth_user_id: created.user.id,
          area: cleanText(body.area, 120),
          landmark: cleanText(body.landmark, 180),
          phone: cleanText(body.phone, 40),
          notes: cleanText(body.notes, 500),
          updated_at: new Date().toISOString(),
        }) as typeof account;
      } catch (error) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw error;
      }
    } else {
      const nextUsername = username || normalizeUsername(account.username);
      const nextName = name || cleanText(account.name, 120);
      if (!nextUsername || !nextName) throw new Error('الاسم واسم الدخول مطلوبان');

      const authChanges: Record<string, unknown> = {
        user_metadata: { name: nextName, username: nextUsername, role: requestedRole },
      };
      if (nextUsername !== normalizeUsername(account.username)) authChanges.email = emailForUsername(nextUsername);
      if (password) {
        if (password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');
        authChanges.password = password;
      }
      if (account.auth_user_id) {
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(String(account.auth_user_id), authChanges);
        if (authUpdateError) throw authUpdateError;
      } else if (password.length >= 8) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: emailForUsername(nextUsername), password, email_confirm: true,
          user_metadata: { name: nextName, username: nextUsername, role: requestedRole },
        });
        if (createError || !created.user) throw createError || new Error('تعذر ربط الحساب بخدمة الدخول');
        account.auth_user_id = created.user.id;
      } else {
        throw new Error('الحساب غير مربوط بخدمة الدخول. اكتب كلمة مرور جديدة لإكمال الربط');
      }

      account = await updateCompat(admin, 'accounts', {
        role: requestedRole,
        name: nextName,
        username: nextUsername,
        status: ['active', 'inactive', 'pending'].includes(body.status) ? body.status : account.status,
        auth_user_id: account.auth_user_id,
        area: body.area === undefined ? undefined : cleanText(body.area, 120),
        landmark: body.landmark === undefined ? undefined : cleanText(body.landmark, 180),
        phone: body.phone === undefined ? undefined : cleanText(body.phone, 40),
        notes: body.notes === undefined ? undefined : cleanText(body.notes, 500),
        updated_at: new Date().toISOString(),
      }, accountId) as typeof account;
    }

    const finalRole = cleanText(account?.role || requestedRole, 30);
    if (finalRole === 'courier' || requestedRole === 'courier') {
      const areas = Array.isArray(body.areas) ? body.areas.map((x: unknown) => cleanText(x, 100)).filter(Boolean) : undefined;
      const courierPayload: Record<string, unknown> = {
        name: cleanText(body.name ?? account?.name, 120),
        username: normalizeUsername(body.username ?? account?.username),
        phone: body.phone === undefined ? undefined : cleanText(body.phone, 40),
        area: body.area === undefined ? (areas?.[0] || undefined) : cleanText(body.area, 120),
        areas,
        availability: ['available', 'busy', 'offline'].includes(body.availability) ? body.availability : undefined,
        status: ['active', 'inactive', 'pending'].includes(body.status) ? body.status : undefined,
        updated_at: new Date().toISOString(),
      };
      Object.keys(courierPayload).forEach((key) => courierPayload[key] === undefined && delete courierPayload[key]);
      const updatedCourier = await updateCompat(admin, 'couriers', courierPayload, accountId);
      if (!updatedCourier) {
        await insertCompat(admin, 'couriers', { id: accountId, ...courierPayload, created_at: new Date().toISOString() });
      }
      await removeLegacyPassword(admin, 'couriers', accountId);
    }
    await removeLegacyPassword(admin, 'accounts', accountId);

    return jsonResponse({ ok: true, account: publicAccount(account as Record<string, unknown>) });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'تعذر تحديث الحساب' }, 400);
  }
});
