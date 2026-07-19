import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type AdminContext = {
  admin: SupabaseClient;
  caller: { id: string; accountId: string };
};

const OPTIONAL_ACCOUNT_FIELDS = new Set(['phone', 'notes', 'updated_at', 'landmark', 'area']);
const OPTIONAL_COURIER_FIELDS = new Set(['phone', 'username', 'areas', 'area', 'availability', 'work_status', 'updated_at', 'created_at']);

export function cleanText(value: unknown, max = 160): string {
  return String(value ?? '').trim().slice(0, max);
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

export function makeAccountId(role: string): string {
  const prefix: Record<string, string> = { admin: 'A', teacher: 'T', library: 'L', courier: 'C', accountant: 'AC' };
  return `${prefix[role] || 'U'}${crypto.randomUUID().replaceAll('-', '').slice(0, 22)}`;
}

export async function requireAdmin(req: Request): Promise<AdminContext> {
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
    .select('id,role,status')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account || account.role !== 'admin' || account.status !== 'active') {
    throw new Error('هذه العملية مسموحة للمدير فقط');
  }

  return { admin, caller: { id: userData.user.id, accountId: String(account.id) } };
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
