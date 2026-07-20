import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  cleanText,
  ensureAuthUserForAccount,
  insertCompat,
  makeAccountId,
  normalizeUsername,
  publicAccount,
  requireAdmin,
} from '../_shared/admin.ts';

const ALLOWED_ROLES = new Set(['teacher', 'library', 'courier', 'accountant']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'الطريقة غير مسموحة' }, 405);

  let createdUserId = '';
  let accountId = '';
  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json();
    const role = cleanText(body.role, 30).toLowerCase();
    const name = cleanText(body.name, 120);
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const status = ['active', 'inactive', 'pending'].includes(body.status) ? body.status : 'active';
    if (!ALLOWED_ROLES.has(role)) throw new Error('نوع الحساب غير مدعوم');
    if (!name || !username || !password) throw new Error('أكمل الاسم واسم الدخول وكلمة المرور');
    if (password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل');

    const { data: duplicate, error: duplicateError } = await admin
      .from('accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) throw new Error('اسم الدخول مستخدم مسبقاً');

    accountId = makeAccountId(role);
    const resolved = await ensureAuthUserForAccount(admin, {
      accountId, authUserId: null, username, password, name, role,
    });
    if (resolved.created) createdUserId = resolved.id;

    const account = await insertCompat(admin, 'accounts', {
      id: accountId,
      role,
      name,
      username,
      status,
      auth_user_id: resolved.id,
      area: cleanText(body.area, 120),
      landmark: cleanText(body.landmark, 180),
      phone: cleanText(body.phone, 40),
      notes: cleanText(body.notes, 500),
      updated_at: new Date().toISOString(),
    });

    if (role === 'courier') {
      const areas = Array.isArray(body.areas) ? body.areas.map((x: unknown) => cleanText(x, 100)).filter(Boolean) : [];
      if (!areas.length && cleanText(body.area, 120)) areas.push(cleanText(body.area, 120));
      try {
        await insertCompat(admin, 'couriers', {
          id: accountId,
          name,
          username,
          phone: cleanText(body.phone, 40),
          areas,
          area: areas[0] || '',
          availability: ['available', 'busy', 'offline'].includes(body.availability) ? body.availability : 'available',
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (courierError) {
        await admin.from('accounts').delete().eq('id', accountId);
        if (resolved.created) await admin.auth.admin.deleteUser(resolved.id);
        throw courierError;
      }
    }

    return jsonResponse({ ok: true, account: publicAccount(account) });
  } catch (error) {
    if (createdUserId) {
      try {
        const url = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const cleanup = createClient(url, serviceKey, { auth: { persistSession: false } });
        if (accountId) await cleanup.from('accounts').delete().eq('id', accountId);
        await cleanup.auth.admin.deleteUser(createdUserId);
      } catch (_) { /* best effort rollback */ }
    }
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'تعذر إنشاء الحساب' }, 400);
  }
});
