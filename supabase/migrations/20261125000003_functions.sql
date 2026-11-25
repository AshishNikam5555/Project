-- CareFlow booking — public RPC functions (the only way anon touches bookings).

-- Local "now" for a tenant (default Asia/Kolkata)
create or replace function public._tenant_now(t public.tenants) returns timestamp
language sql stable as $$
  select (now() at time zone coalesce(t.config->>'timezone', 'Asia/Kolkata'));
$$;

-- Occupied slots for the booking page (times only — no patient data)
create or replace function public.get_taken_slots(p_tenant_slug text, p_from date, p_to date)
returns table (doctor_id uuid, date date, start_time time)
language sql stable security definer set search_path = public as $$
  select b.doctor_id, b.date, b.start_time
  from public.bookings b join public.tenants t on t.id = b.tenant_id
  where t.slug = p_tenant_slug
    and b.date between p_from and least(p_to, p_from + 31)
    and b.status in ('requested','confirmed','checked_in');
$$;

create or replace function public.create_booking(
  p_tenant_slug text, p_doctor_id uuid, p_service_id uuid, p_date date, p_start_time time,
  p_name text, p_mobile text, p_age int, p_gender text, p_note text, p_consent boolean,
  p_source text default 'direct')
returns table (booking_id uuid, token text, status text)
language plpgsql security definer set search_path = public as $$
declare
  t        public.tenants;
  v_now    timestamp;
  v_mobile text;
  v_window int;
  v_seq    int;
  v_token  text;
  v_status text;
  v_id     uuid;
  v_source text;
begin
  select * into t from public.tenants where slug = p_tenant_slug;
  if not found then raise exception 'Unknown hospital' using errcode = 'P0001'; end if;

  if not coalesce(p_consent, false) then
    raise exception 'Please agree to be contacted about this appointment' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Please enter the patient''s name' using errcode = 'P0001';
  end if;
  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if v_mobile !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 120 then
    raise exception 'Keep the problem description under 120 characters' using errcode = 'P0001';
  end if;
  if p_age is not null and (p_age < 0 or p_age > 120) then
    raise exception 'Enter a valid age' using errcode = 'P0001';
  end if;

  v_now    := public._tenant_now(t);
  v_window := coalesce((t.config->>'booking_window_days')::int, 7);
  if p_date < v_now::date or p_date > v_now::date + v_window then
    raise exception 'Choose a date within the next % days', v_window using errcode = 'P0001';
  end if;
  if (p_date + p_start_time) <= v_now then
    raise exception 'This time has already passed. Please choose a later slot' using errcode = 'P0001';
  end if;

  perform 1 from public.services s
    join public.doctor_services ds on ds.service_id = s.id
    join public.doctors d on d.id = ds.doctor_id
   where s.id = p_service_id and s.tenant_id = t.id and s.active and s.bookable
     and d.id = p_doctor_id and d.tenant_id = t.id and d.active;
  if not found then
    raise exception 'This service is not available with the selected doctor' using errcode = 'P0001';
  end if;

  perform 1 from public.availability a
   where a.tenant_id = t.id and a.doctor_id = p_doctor_id
     and a.weekday = extract(dow from p_date)::int
     and p_start_time >= a.start_time
     and p_start_time + make_interval(mins => a.slot_min) <= a.end_time
     and (extract(epoch from (p_start_time - a.start_time))::int / 60) % a.slot_min = 0;
  if not found then
    raise exception 'The doctor is not available at this time' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.leaves l where l.tenant_id = t.id and l.date = p_date
             and (l.doctor_id is null or l.doctor_id = p_doctor_id)) then
    raise exception 'The doctor is on leave that day. Please choose another date' using errcode = 'P0001';
  end if;

  -- Rate limit: 3 bookings per mobile per hour (stops spam flooding WhatsApp alerts)
  if (select count(*) from public.bookings b where b.tenant_id = t.id and b.patient_mobile = v_mobile
        and b.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many bookings from this number. Please call the hospital' using errcode = 'P0001';
  end if;

  v_source := case when p_source in ('poster','whatsapp','maps','card','status','direct') then p_source else 'direct' end;
  v_status := case when coalesce((t.config->>'auto_confirm')::boolean, true) then 'confirmed' else 'requested' end;

  insert into public.token_counters as c (tenant_id, date, last) values (t.id, p_date, 1)
    on conflict (tenant_id, date) do update set last = c.last + 1
    returning c.last into v_seq;
  v_token := coalesce(t.config->>'token_prefix', 'CF') || '-' || to_char(p_date, 'MMDD') || '-' || lpad(v_seq::text, 3, '0');

  begin
    insert into public.bookings (tenant_id, token, doctor_id, service_id, date, start_time, status,
                                 patient_name, patient_mobile, age, gender, note, consent, source)
    values (t.id, v_token, p_doctor_id, p_service_id, p_date, p_start_time, v_status,
            trim(p_name), v_mobile, p_age, nullif(p_gender, ''), nullif(trim(p_note), ''), true, v_source)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Sorry, this slot was just taken. Please choose another time' using errcode = 'P0001';
  end;

  return query select v_id, v_token, v_status;
end;
$$;

-- "My booking": one booking, only with the matching token + mobile
create or replace function public.get_booking(p_tenant_slug text, p_token text, p_mobile text)
returns table (id uuid, token text, status text, date date, start_time time,
               doctor_name text, service_name text, service_name_mr text, patient_first_name text)
language sql stable security definer set search_path = public as $$
  select b.id, b.token, b.status, b.date, b.start_time, d.name, s.name, s.name_mr,
         split_part(b.patient_name, ' ', 1)
  from public.bookings b
  join public.tenants t on t.id = b.tenant_id
  join public.doctors d on d.id = b.doctor_id
  join public.services s on s.id = b.service_id
  where t.slug = p_tenant_slug
    and upper(b.token) = upper(trim(p_token))
    and b.patient_mobile = right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
$$;

create or replace function public.cancel_booking(p_tenant_slug text, p_token text, p_mobile text)
returns text
language plpgsql security definer set search_path = public as $$
declare b public.bookings; t public.tenants;
begin
  select * into t from public.tenants where slug = p_tenant_slug;
  select bk.* into b from public.bookings bk
   where bk.tenant_id = t.id and upper(bk.token) = upper(trim(p_token))
     and bk.patient_mobile = right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if not found then raise exception 'No booking found for this token and mobile number' using errcode = 'P0001'; end if;
  if b.status not in ('requested','confirmed') then
    raise exception 'This booking can no longer be cancelled online' using errcode = 'P0001';
  end if;
  if (b.date + b.start_time) <= public._tenant_now(t) then
    raise exception 'This appointment time has passed' using errcode = 'P0001';
  end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  return 'cancelled';
end;
$$;

-- Audit + updated_at ----------------------------------------------------------
create or replace function public._bookings_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (tenant_id, user_id, action, booking_id, detail)
    values (new.tenant_id, auth.uid(), 'created', new.id, jsonb_build_object('source', new.source));
  elsif new.status is distinct from old.status then
    new.updated_at := now();
    insert into public.audit_log (tenant_id, user_id, action, booking_id, detail)
    values (new.tenant_id, auth.uid(), 'status:' || new.status, new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger bookings_audit_ins after insert on public.bookings
  for each row execute function public._bookings_audit();
create trigger bookings_audit_upd before update on public.bookings
  for each row execute function public._bookings_audit();

-- Retention: delete bookings older than config.retention_months (default 12).
-- Schedule daily with pg_cron (Supabase: Database → Extensions → pg_cron):
--   select cron.schedule('purge-old-bookings', '30 2 * * *', $$select public.purge_old_bookings()$$);
create or replace function public.purge_old_bookings() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.bookings b using public.tenants t
   where t.id = b.tenant_id
     and b.date < (current_date - make_interval(months => coalesce((t.config->>'retention_months')::int, 12)));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Execute rights: patients may call only the public RPCs.
revoke execute on function public.purge_old_bookings() from public, anon, authenticated;
revoke execute on function public._bookings_audit() from public, anon, authenticated;
grant execute on function public.get_taken_slots(text, date, date) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, uuid, date, time, text, text, int, text, text, boolean, text) to anon, authenticated;
grant execute on function public.get_booking(text, text, text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text, text) to anon, authenticated;
