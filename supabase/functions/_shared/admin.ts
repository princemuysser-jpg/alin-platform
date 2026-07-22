import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.7';

export type AdminContext = {
  admin: SupabaseClient;
  caller: { id: string; accountId: string; adminLevel: string };
};

const OPTIONAL_ACCOUNT_FIELDS = new Set(['phone', 'notes', 'updated_at', 'landmark', 'area', 'deleted_at', 'admin_level']);
const OPTIONAL_COURIER_FIELDS = new Set(['phone', 'username', 'areas', 'area', 'availability', 'work_status', 'updated_at', 'created_at']);

export function cleanText(value: unknown, max = 160): string {
  return String(value ?? '').trim().slice(0, max);
}


export function assertStrongPassword(password: string): void {
  if (password.length < 12 || !/[0-9]/.test(password) || !/[A-Za-z؀-ۿ]/.test(password)) {
    throw new Error('كلمة المرور يجب أن تكون 12 حرفاً على الأقل وتتضمن حروفاً وأرقاماً');
  }
}

export function requireSuperAdmin(context: AdminContext): void {
  if (context.caller.adminLevel !== 'super_admin') throw new Error('هذه العملية تتطلب صلاحية المدير الأعلى');
}

export function normalizeUsername(value: unknown): string {
  return cleanText(value, 80).toLocaleLowerCase('en-US').replace(/\s+/g, '-');
}

function usernameEmailKey(username: string): string {
  const normalized = normalizeUsername(username);
  const ascii = normalized
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'user';
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(normalized)) {
    hash = Math.imul(hash ^ byte, 16777619);
  }
  return `${ascii.slice(0, 38)}-${(hash >>> 0).toString(36)}`;
}

export function emailForUsername(username: string): string {
  const normalized = normalizeUsername(username);
  return normalized.includes('@') ? normalized : `${usernameEmailKey(normalized)}@users.alin.local`;
}


export type AuthUserResolution = { id: string; created: boolean };

function duplicateAuthEmail(error: { message?: string } | null): boolean {
  return /already (?:been )?registered|already exists|email.*registered|user.*exists/i.test(String(error?.message || ''));
}

function missingAuthUser(error: { message?: string; status?: number } | null): boolean {
  return Number(error?.status || 0) === 404 || /user.*not found|not found|does not exist/i.test(String(error?.message || ''));
}

export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = cleanText(email, 200).toLocaleLowerCase('en-US');
  if (!target) return null;
  const perPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => String(user.email || '').toLocaleLowerCase('en-US') === target);
    if (found) return { id: found.id, email: found.email };
    if (users.length < perPage) break;
  }
  return null;
}

async function assertAuthUserAvailable(
  admin: SupabaseClient,
  authUserId: string,
  accountId: string,
): Promise<void> {
  const { data, error } = await admin
    .from('accounts')
    .select('id')
    .eq('auth_user_id', authUserId)
    .neq('id', accountId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) throw new Error('اسم الدخول مرتبط بحساب آخر');
}

export async function ensureAuthUserForAccount(
  admin: SupabaseClient,
  input: {
    accountId: string;
    authUserId?: string | null;
    username: string;
    password: string;
    name: string;
    role: string;
  },
): Promise<AuthUserResolution> {
  const accountId = cleanText(input.accountId, 80);
  const username = normalizeUsername(input.username);
  const password = String(input.password || '');
  const name = cleanText(input.name, 120);
  const role = cleanText(input.role, 30);
  if (!accountId || !username || !name) throw new Error('بيانات الحساب غير مكتملة');
  assertStrongPassword(password);

  const email = emailForUsername(username);
  const updatePayload = {
    email,
    password,
    email_confirm: true,
    user_metadata: { name, username, role },
  };

  let authUserId = cleanText(input.authUserId, 100);
  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, updatePayload);
    if (!error) return { id: authUserId, created: false };
    if (!missingAuthUser(error)) throw error;
    authUserId = '';
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (existing?.id) {
    await assertAuthUserAvailable(admin, existing.id, accountId);
    const { error } = await admin.auth.admin.updateUserById(existing.id, updatePayload);
    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser(updatePayload);
  if (!createError && created.user) return { id: created.user.id, created: true };

  // Handles old orphaned Auth users and a concurrent request that created the same email.
  if (duplicateAuthEmail(createError)) {
    const raced = await findAuthUserByEmail(admin, email);
    if (raced?.id) {
      await assertAuthUserAvailable(admin, raced.id, accountId);
      const { error } = await admin.auth.admin.updateUserById(raced.id, updatePayload);
      if (error) throw error;
      return { id: raced.id, created: false };
    }
  }
  throw createError || new Error('تعذر إنشاء مستخدم الدخول');
}

export function makeAccountId(role: string): string {
  const prefix: Record<string, string> = { admin: 'A', teacher: 'T', library: 'L', courier: 'C', accountant: 'AC' };
  return `${prefix[role] || 'U'}${crypto.randomUUID().replaceAll('-', '').slice(0, 22)}`;
}

export async function requireAdmin(req: Request, permission = ''): Promise<AdminContext> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('إعدادات Supabase السرية غير متوفرة داخل Edge Function');

  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('يجب تسجيل الدخول أولاً');

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error('جلسة الدخول غير صالحة');

  const { data: account, error: accountError } = await admin
    .from('accounts')
.select('id,role,status,admin_level,deleted_at')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account || account.role !== 'admin' || account.status !== 'active' || account.deleted_at) {
    throw new Error('هذه العملية مسموحة للمدير فقط');
  }

  const context = { admin, caller: { id: userData.user.id, accountId: String(account.id), adminLevel: String(account.admin_level || 'operator') } };
  const requested = cleanText(permission, 40).toLowerCase();
  if (requested && context.caller.adminLevel !== 'super_admin') {
    const { data: allowed, error: permissionError } = await admin
      .from('account_permissions')
      .select('permission')
      .eq('account_id', context.caller.accountId)
      .eq('permission', requested)
      .eq('granted', true)
      .maybeSingle();
    if (permissionError) throw permissionError;
    if (!allowed) throw new Error('لا تملك صلاحية تنفيذ هذه العملية');
  }
  return context;
}

function missingColumn(error: { message?: string } | null): string | null {
  const message = String(error?.message || '');
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
    /record .* has no field "([a-zA-Z0-9_]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function insertCompat(
  admin: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
  optionalFields = table === 'accounts' ? OPTIONAL_ACCOUNT_FIELDS : OPTIONAL_COURIER_FIELDS,
): Promise<Record<string, unknown>> {
  const row = { ...payload };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await admin.from(table).insert(row).select().single();
    if (!error) return data as Record<string, unknown>;
    const field = missingColumn(error);
    if (!field || !optionalFields.has(field) || !(field in row)) throw error;
    delete row[field];
  }
  throw new Error(`تعذر حفظ بيانات ${table}`);
}

export async function updateCompat(
  admin: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
  id: string,
  optionalFields = table === 'accounts' ? OPTIONAL_ACCOUNT_FIELDS : OPTIONAL_COURIER_FIELDS,
): Promise<Record<string, unknown> | null> {
  const row = { ...payload };
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await admin.from(table).update(row).eq('id', id).select().maybeSingle();
    if (!error) return (data || null) as Record<string, unknown> | null;
    const field = missingColumn(error);
    if (!field || !optionalFields.has(field) || !(field in row)) throw error;
    delete row[field];
  }
  throw new Error(`تعذر تحديث بيانات ${table}`);
}

export async function removeLegacyPassword(admin: SupabaseClient, table: string, id: string): Promise<void> {
  const { error } = await admin.from(table).update({ password_hash: null }).eq('id', id);
  if (error && !missingColumn(error)) console.warn(`Could not clear ${table}.password_hash`, error.message);
}

export function publicAccount(row: Record<string, unknown>): Record<string, unknown> {
  const { password_hash: _passwordHash, ...safe } = row;
  return safe;
}
