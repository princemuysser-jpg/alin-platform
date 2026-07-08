
create table if not exists public.library_join_requests (
  id text primary key,
  library_name text,
  owner_name text,
  whatsapp text,
  area text,
  address text,
  landmark text,
  gps text,
  notes text,
  status text default 'pending',
  approved_account_id text,
  approved_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  created_at timestamptz default now()
);

create table if not exists public.couriers (
  id text primary key,
  name text,
  phone text,
  area text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.courier_settlements (
  id text primary key,
  receipt_number text,
  courier_id text,
  amount numeric default 0,
  payment_method text,
  note text,
  status text default 'received',
  created_at timestamptz default now()
);

alter table public.orders add column if not exists fulfillment_type text default 'pickup';
alter table public.orders add column if not exists courier_id text;
alter table public.orders add column if not exists delivery_area text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_landmark text;
alter table public.orders add column if not exists delivery_fee numeric default 0;
alter table public.orders add column if not exists payment_method text default 'cash_at_library';

alter table public.accounts add column if not exists owner_name text;
alter table public.accounts add column if not exists whatsapp text;
alter table public.accounts add column if not exists address text;
alter table public.accounts add column if not exists gps text;

alter table public.library_join_requests enable row level security;
alter table public.couriers enable row level security;
alter table public.courier_settlements enable row level security;

drop policy if exists "alin library requests all" on public.library_join_requests;
create policy "alin library requests all" on public.library_join_requests for all to anon using (true) with check (true);

drop policy if exists "alin couriers all" on public.couriers;
create policy "alin couriers all" on public.couriers for all to anon using (true) with check (true);

drop policy if exists "alin courier settlements all" on public.courier_settlements;
create policy "alin courier settlements all" on public.courier_settlements for all to anon using (true) with check (true);
