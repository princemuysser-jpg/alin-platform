-- Alin V18 Supabase Direct SQL
-- نفّذه في Supabase SQL Editor. هذا SQL يضيف سياسة مناسبة لنسخة التجربة.
-- ملاحظة: للاستخدام التجاري النهائي نحتاج RLS أدق وتسجيل دخول Supabase Auth.

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    area TEXT,
    landmark TEXT,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS booklets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    price INTEGER NOT NULL,
    cover_path TEXT,
    teacher_image_path TEXT,
    file_path TEXT,
    file_name TEXT,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    type TEXT,
    name TEXT,
    category TEXT,
    price INTEGER,
    stock INTEGER DEFAULT 0,
    image_path TEXT,
    status TEXT DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    title TEXT,
    text TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    kind TEXT,
    item_id TEXT,
    title TEXT,
    student_name TEXT,
    student_phone TEXT,
    library_id TEXT,
    qty INTEGER,
    unit_price INTEGER,
    total INTEGER,
    status TEXT,
    payment_status TEXT,
    payment_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permits (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    booklet_id TEXT,
    library_id TEXT,
    qty INTEGER,
    used INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE,
    alin INTEGER,
    teacher INTEGER,
    teacher_id TEXT,
    library INTEGER,
    library_id TEXT,
    settlement_status TEXT DEFAULT 'unsettled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    role TEXT,
    account_id TEXT,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    kind TEXT,
    text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

INSERT INTO categories (id, type, name, status)
VALUES
('C1', 'booklet', 'السادس الإعدادي', 'active'),
('C2', 'stationery', 'دفاتر', 'active'),
('C3', 'stationery', 'أقلام', 'active'),
('C4', 'gift', 'هدايا', 'active')
ON CONFLICT (id) DO NOTHING;

-- RLS بسيط للتجربة لأن الواجهة تعمل مباشرة من المتصفح.
-- تجارياً: نبدله بسياسات دقيقة حسب Auth.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booklets ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','booklets','products','banners','orders','permits','ledger','withdrawals','audit','categories','settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "alin_v15_public_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "alin_v15_public_insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "alin_v15_public_update" ON %I', t);
    EXECUTE format('CREATE POLICY "alin_v15_public_select" ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "alin_v15_public_insert" ON %I FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "alin_v15_public_update" ON %I FOR UPDATE USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;


-- V18: السماح بالحذف من لوحة الإدارة في النسخة المباشرة
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','booklets','products','banners','orders','permits','ledger','withdrawals','audit','categories','settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "alin_v18_public_delete" ON %I', t);
    EXECUTE format('CREATE POLICY "alin_v18_public_delete" ON %I FOR DELETE USING (true)', t);
  END LOOP;
END $$;

-- V19 upgrades
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_limit INTEGER DEFAULT 5;
CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL DEFAULT 'percent', discount_value INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, scope_type TEXT DEFAULT 'all', scope_value TEXT, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, audience TEXT NOT NULL DEFAULT 'all', account_id TEXT, title TEXT NOT NULL, text TEXT, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY; ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alin_v19_public_all" ON coupons; CREATE POLICY "alin_v19_public_all" ON coupons FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "alin_v19_public_all" ON notifications; CREATE POLICY "alin_v19_public_all" ON notifications FOR ALL USING (true) WITH CHECK (true);
INSERT INTO settings(key,value) VALUES ('platform_name','منصة آلين'),('platform_phone',''),('hero_title','منصة آلين للمدرسين والمكتبات'),('hero_text','اختار الملزمة أو المنتج وحدد مكتبة الاستلام.'),('low_stock_default','5') ON CONFLICT(key) DO NOTHING;
