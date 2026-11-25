-- CareFlow booking — Row Level Security.
-- Principles:
--   * anon (patients) can READ public catalogue data only, and can NEVER read bookings.
--   * anon creates/looks up/cancels bookings only through SECURITY DEFINER functions (0003).
--   * staff read/write only rows whose tenant_id matches their row in public.staff.

-- Helpers (security definer so they can read public.staff without recursion)
create or replace function public.is_staff(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and tenant_id = t);
$$;

create or replace function public.is_admin(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and tenant_id = t and role = 'admin');
$$;

alter table public.tenants            enable row level security;
alter table public.doctors            enable row level security;
alter table public.service_categories enable row level security;
alter table public.services           enable row level security;
alter table public.doctor_services    enable row level security;
alter table public.availability       enable row level security;
alter table public.leaves             enable row level security;
alter table public.bookings           enable row level security;
alter table public.token_counters     enable row level security;
alter table public.staff              enable row level security;
alter table public.audit_log          enable row level security;
alter table public.notifications      enable row level security;

-- Defence in depth: remove table privileges that RLS alone would otherwise guard.
revoke all on public.bookings, public.token_counters, public.audit_log, public.notifications, public.staff from anon;
revoke all on public.tenants from anon, authenticated;
grant select (id, slug, name, config, created_at) on public.tenants to anon, authenticated;
grant update (name, config) on public.tenants to authenticated;
revoke all on public.leaves from anon;
grant select (id, tenant_id, doctor_id, date) on public.leaves to anon;   -- reason stays private
revoke insert, delete on public.bookings from authenticated;              -- bookings created via create_booking()
revoke update on public.bookings from authenticated;
grant update (status) on public.bookings to authenticated;                -- staff change status only

-- Tenants
create policy tenants_read on public.tenants for select to anon, authenticated using (true);
create policy tenants_admin_update on public.tenants for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- Catalogue: public read, admin write
create policy doctors_read on public.doctors for select to anon, authenticated
  using (active or public.is_staff(tenant_id));
create policy doctors_admin on public.doctors for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

create policy cats_read on public.service_categories for select to anon, authenticated using (true);
create policy cats_admin on public.service_categories for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

create policy services_read on public.services for select to anon, authenticated
  using (active or public.is_staff(tenant_id));
create policy services_admin on public.services for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

create policy ds_read on public.doctor_services for select to anon, authenticated using (true);
create policy ds_admin on public.doctor_services for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

create policy avail_read on public.availability for select to anon, authenticated using (true);
create policy avail_admin on public.availability for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

create policy leaves_read on public.leaves for select to anon, authenticated using (true);
create policy leaves_admin on public.leaves for all to authenticated
  using (public.is_admin(tenant_id)) with check (public.is_admin(tenant_id));

-- Bookings: staff of the same tenant only. No anon policy at all.
create policy bookings_staff_read on public.bookings for select to authenticated
  using (public.is_staff(tenant_id));
create policy bookings_staff_update on public.bookings for update to authenticated
  using (public.is_staff(tenant_id)) with check (public.is_staff(tenant_id));

-- Staff: see yourself; admins see their tenant's team
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin(tenant_id));

create policy audit_read on public.audit_log for select to authenticated using (public.is_staff(tenant_id));
create policy notif_read on public.notifications for select to authenticated using (public.is_staff(tenant_id));
-- token_counters: no policies -> only SECURITY DEFINER functions touch it.

-- Live dashboard: stream bookings changes (Realtime applies the RLS above per subscriber)
alter publication supabase_realtime add table public.bookings;
