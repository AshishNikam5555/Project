-- CareFlow booking — core schema (multi-tenant).
-- Every tenant-owned table carries tenant_id; isolation is enforced by RLS (see 0002).

create extension if not exists pgcrypto;

-- Tenants -------------------------------------------------------------------
-- config         : public-safe settings (name, hours text, booking rules, colours)
-- private_config : staff/server-only settings (e.g. notify_whatsapp numbers). Never readable by anon.
create table public.tenants (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name           text not null,
  config         jsonb not null default '{}'::jsonb,
  private_config jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table public.doctors (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  name             text not null,
  name_mr          text,
  role             text,
  role_mr          text,
  qualification    text,
  experience_years int check (experience_years between 0 and 70),
  photo_url        text,
  fee_inr          int check (fee_inr >= 0),
  active           boolean not null default true,
  sort             int not null default 0,
  created_at       timestamptz not null default now()
);
create index on public.doctors (tenant_id);

create table public.service_categories (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name      text not null,
  name_mr   text,
  sort      int not null default 0
);
create index on public.service_categories (tenant_id);

-- kind: appointment | emergency (come directly, call) | walkin (no booking, e.g. X-ray). bookable=false hides the Book button.
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  category_id  uuid not null references public.service_categories(id) on delete cascade,
  name         text not null,
  name_mr      text,
  duration_min int not null default 15 check (duration_min between 5 and 240),
  kind         text not null default 'appointment' check (kind in ('appointment','emergency','walkin')),
  bookable     boolean not null default true,
  active       boolean not null default true,
  sort         int not null default 0
);
create index on public.services (tenant_id);

-- Which doctor offers which service
create table public.doctor_services (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (doctor_id, service_id)
);
create index on public.doctor_services (tenant_id);

-- Weekly OPD sessions per doctor. weekday: 0 = Sunday … 6 = Saturday
create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  slot_min   int not null default 15 check (slot_min between 5 and 120),
  check (end_time > start_time)
);
create index on public.availability (tenant_id, doctor_id, weekday);

-- Leave / holiday. doctor_id null = whole hospital OPD closed that day.
create table public.leaves (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  date      date not null,
  reason    text
);
create index on public.leaves (tenant_id, date);

-- Bookings -------------------------------------------------------------------
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  token          text not null,
  doctor_id      uuid not null references public.doctors(id),
  service_id     uuid not null references public.services(id),
  date           date not null,
  start_time     time not null,
  status         text not null default 'confirmed'
                 check (status in ('requested','confirmed','checked_in','completed','cancelled','no_show')),
  patient_name   text not null check (char_length(patient_name) between 2 and 80),
  patient_mobile text not null check (patient_mobile ~ '^[6-9][0-9]{9}$'),
  age            smallint check (age between 0 and 120),
  gender         text check (gender in ('F','M','O')),
  note           text check (char_length(note) <= 120),
  consent        boolean not null check (consent),
  source         text not null default 'direct'
                 check (source in ('poster','whatsapp','maps','card','status','direct','staff')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, token)
);
-- No double booking: one active booking per doctor per slot.
create unique index bookings_one_active_per_slot
  on public.bookings (tenant_id, doctor_id, date, start_time)
  where status in ('requested','confirmed','checked_in');
create index on public.bookings (tenant_id, date);
create index on public.bookings (tenant_id, patient_mobile, created_at);

-- Per-day token counter (KH-MMDD-001, -002 …)
create table public.token_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date      date not null,
  last      int  not null default 0,
  primary key (tenant_id, date)
);

-- Staff ----------------------------------------------------------------------
create table public.staff (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       text not null check (role in ('admin','reception')),
  name       text,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid,
  action     text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  detail     jsonb,
  at         timestamptz not null default now()
);
create index on public.audit_log (tenant_id, at desc);

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete set null,
  channel           text not null default 'whatsapp',
  event             text not null,
  to_masked         text not null,
  status            text not null check (status in ('sent','failed','skipped')),
  attempts          int  not null default 1,
  provider          text,
  provider_response text,
  sent_at           timestamptz not null default now()
);
create index on public.notifications (tenant_id, sent_at desc);
