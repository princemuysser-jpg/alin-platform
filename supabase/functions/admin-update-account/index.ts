import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  cleanText,
  emailForUsername,
  ensureAuthUserForAccount,
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
    const hasRequestedAreas = Array.isArray(body.areas);
    const requestedAreas = hasRequestedAreas
      ? [...new Set(body.areas.map((x: unknown) => cleanText(x, 100)).filter(Boolean))]
      : undefined;
    if (requestedRole === 'courier' && hasRequestedAreas && !requestedAreas?.length) {
      throw new Error('اختر منطقة عمل واحدة على الأقل للمندوب');
    }
    const requestedPrimaryArea = requestedRole === 'courier'
      ? (hasRequestedAreas ? (requestedAreas?.[0] || '') : (body.area === undefined ? undefined : cleanText(body.area, 120)))
      : (body.area === undefined ? undefined : cleanText(body.area, 120));
    const username = body.username === undefined ? normalizeUsername(account?.username) : normalizeUsername(body.username);
    const name = body.name === undefined ? cleanText(account?.name, 120) : cleanText(body.name, 120);
    const password = String(body.password || '');

    // Seamless migration for a legacy courier row that has no accounts/Auth user yet.
    if (!account) {
      if (requestedRole !== 'courier') throw new Error('الحساب غير موجود');
      if (!username || !name || password.length < 8) {
        throw new Error('هذا مندوب قديم غير مربوط. اكتب اسمه واسم الدخول وكلمة مرور جديدة من 8 أحرف لترحيله');
      }
      const resolved = await ensureAuthUserForAccount(admin, {
        accountId, authUserId: null, username, password, name, role: 'courier',
      });
      try {
        account = await insertCompat(admin, 'accounts', {
          id: accountId,
          role: 'courier',
          name,
          username,
          status: body.status || 'active',
          auth_user_id: resolved.id,
          area: requestedPrimaryArea || '',
          landmark: cleanText(body.landmark, 180),
          phone: cleanText(body.phone, 40),
          notes: cleanText(body.notes, 500),
          updated_at: new Date().toISOString(),
        }) as typeof account;
      } catch (error) {
        if (resolved.created) await admin.auth.admin.deleteUser(resolved.id);
        throw error;
      }
    } else {
      const nextUsername = username || normalizeUsername(account.username);
      const nextName = name || cleanText(account.name, 120);
      if (!nextUsername || !nextName) throw new Error('الاسم واسم الدخول مطلوبان');

      let nextAuthUserId = account.auth_user_id ? String(account.auth_user_id) : '';
      if (password) {
        const resolved = await ensureAuthUserForAccount(admin, {
          accountId,
          authUserId: nextAuthUserId || null,
          username: nextUsername,
          password,
          name: nextName,
          role: requestedRole,
        });
        nextAuthUserId = resolved.id;
      } else if (nextAuthUserId) {
        const authChanges: Record<string, unknown> = {
          user_metadata: { name: nextName, username: nextUsername, role: requestedRole },
        };
        if (nextUsername !== normalizeUsername(account.username)) authChanges.email = emailForUsername(nextUsername);
        const { error: authUpdateError } = await admin.auth.admin.updateUserById(nextAuthUserId, authChanges);
        if (authUpdateError) throw authUpdateError;
      }
      account.auth_user_id = nextAuthUserId || null;

      account = await updateCompat(admin, 'accounts', {
        role: requestedRole,
        name: nextName,
        username: nextUsername,
        status: ['active', 'inactive', 'pending'].includes(body.status) ? body.status : account.status,
        auth_user_id: account.auth_user_id,
        area: requestedPrimaryArea,
        landmark: body.landmark === undefined ? undefined : cleanText(body.landmark, 180),
        phone: body.phone === undefined ? undefined : cleanText(body.phone, 40),
        notes: body.notes === undefined ? undefined : cleanText(body.notes, 500),
        updated_at: new Date().toISOString(),
      }, accountId) as typeof account;
    }

    const finalRole = cleanText(account?.role || requestedRole, 30);
    if (finalRole === 'courier' || requestedRole === 'courier') {
      const areas = requestedAreas;
      const courierPayload: Record<string, unknown> = {
        name: cleanText(body.name ?? account?.name, 120),
        username: normalizeUsername(body.username ?? account?.username),
        phone: body.phone === undefined ? undefined : cleanText(body.phone, 40),
        area: requestedPrimaryArea === undefined ? (areas?.[0] || undefined) : requestedPrimaryArea,
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
