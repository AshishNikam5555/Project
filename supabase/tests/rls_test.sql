-- Security & booking-rule tests. Run with: bash supabase/tests/run_local.sh
-- Each block raises an exception (and stops the run) on failure; prints PASS notices otherwise.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- Fixtures: second tenant + two staff users (one per tenant)
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000aaaa', 'reception@kadam.test'),
  ('00000000-0000-4000-8000-00000000bbbb', 'staff@other.test');
insert into public.tenants (id, slug, name, config) values
  ('b0000000-0000-4000-8000-000000000001', 'other-clinic', 'Other Clinic', '{"token_prefix":"OC"}');
insert into public.staff (user_id, tenant_id, role) values
  ('00000000-0000-4000-8000-00000000aaaa', 'a0000000-0000-4000-8000-000000000001', 'reception'),
  ('00000000-0000-4000-8000-00000000bbbb', 'b0000000-0000-4000-8000-000000000001', 'admin');

-- Next Mon–Sat date after today (IST), used for bookings
create table public._t (k text primary key, d date);
insert into public._t
  select 'opd', min(d)::date from generate_series((now() at time zone 'Asia/Kolkata')::date + 1, (now() at time zone 'Asia/Kolkata')::date + 7, interval '1 day') d
  where extract(dow from d) between 1 and 6;
insert into public._t
  select 'sun', min(d)::date from generate_series((now() at time zone 'Asia/Kolkata')::date + 1, (now() at time zone 'Asia/Kolkata')::date + 7, interval '1 day') d
  where extract(dow from d) = 0;
grant select on public._t to anon, authenticated;

\echo '--- anon (patient) ---'
do $$ declare r record; v_d date := (select d from public._t where k='opd'); begin
  execute 'set local role anon';
  select * into r from public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309',
        v_d,'10:30','Priya Sharma','+91 98220 14210',32,'F','Knee pain for 2 weeks',true,'poster');
  if r.token !~ '^KH-\d{4}-001$' then raise exception 'FAIL token format: %', r.token; end if;
  raise notice 'PASS anon can book via create_booking → %', r.token;
end $$;

do $$ begin
  execute 'set local role anon';
  begin perform count(*) from public.bookings; raise exception 'FAIL anon read bookings';
  exception when insufficient_privilege then raise notice 'PASS anon cannot read bookings table'; end;
  begin perform private_config from public.tenants; raise exception 'FAIL anon read private_config';
  exception when insufficient_privilege then raise notice 'PASS anon cannot read tenants.private_config (admin WhatsApp number)'; end;
  begin insert into public.bookings (tenant_id) values ('a0000000-0000-4000-8000-000000000001'); raise exception 'FAIL anon inserted directly';
  exception when insufficient_privilege then raise notice 'PASS anon cannot insert bookings directly'; end;
  begin perform public.purge_old_bookings(); raise exception 'FAIL anon ran purge';
  exception when insufficient_privilege then raise notice 'PASS anon cannot run purge_old_bookings'; end;
end $$;

do $$ declare v_d date := (select d from public._t where k='opd'); begin
  execute 'set local role anon';
  begin
    perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309',
        v_d,'10:30','Rahul Patil','9876543210',40,'M',null,true,'direct');
    raise exception 'FAIL double booking allowed';
  exception when sqlstate 'P0001' then raise notice 'PASS same slot cannot be booked twice (%)', sqlerrm; end;
end $$;

do $$ declare v_d date := (select d from public._t where k='opd'); v_s date := (select d from public._t where k='sun'); begin
  execute 'set local role anon';
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', v_d,'15:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL booked outside OPD hours';
  exception when sqlstate 'P0001' then raise notice 'PASS outside OPD hours rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', v_s,'10:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL booked on Sunday';
  exception when sqlstate 'P0001' then raise notice 'PASS Sunday (OPD closed) rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', v_d,'10:07','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL off-grid time accepted';
  exception when sqlstate 'P0001' then raise notice 'PASS off-grid time (10:07) rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', (now() at time zone 'Asia/Kolkata')::date - 1,'10:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL past date accepted';
  exception when sqlstate 'P0001' then raise notice 'PASS past date rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', v_d,'11:00','A Patient','12345',null,null,null,true,'direct');
    raise exception 'FAIL bad mobile accepted';
  exception when sqlstate 'P0001' then raise notice 'PASS invalid mobile rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000309', v_d,'11:00','A Patient','9876543211',null,null,null,false,'direct');
    raise exception 'FAIL booking without consent';
  exception when sqlstate 'P0001' then raise notice 'PASS consent required'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000301', v_d,'11:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL emergency service bookable';
  exception when sqlstate 'P0001' then raise notice 'PASS non-bookable (emergency) service rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000309', v_d,'11:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL service booked with wrong doctor';
  exception when sqlstate 'P0001' then raise notice 'PASS service/doctor mismatch rejected'; end;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000308', v_d,'11:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL unconfirmed (inactive) service bookable';
  exception when sqlstate 'P0001' then raise notice 'PASS inactive service (hip replacement, to confirm) rejected'; end;
end $$;

-- Leave day
insert into public.leaves (tenant_id, doctor_id, date, reason)
  select 'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000102', d, 'Conference' from public._t where k='opd';
do $$ declare v_d date := (select d from public._t where k='opd'); begin
  execute 'set local role anon';
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000316', v_d,'10:00','A Patient','9876543211',null,null,null,true,'direct');
    raise exception 'FAIL booked on leave day';
  exception when sqlstate 'P0001' then raise notice 'PASS leave day rejected'; end;
  begin perform reason from public.leaves; raise exception 'FAIL anon read leave reason';
  exception when insufficient_privilege then raise notice 'PASS leave reason is private'; end;
end $$;

-- Rate limit: 3 per mobile per hour
do $$ declare v_d date := (select d from public._t where k='opd'); i int; begin
  execute 'set local role anon';
  for i in 0..2 loop
    perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000310', v_d, ('17:' || lpad((i*15)::text,2,'0'))::time,'Spam Test','9000000001',null,null,null,true,'direct');
  end loop;
  begin perform public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000310', v_d,'18:00','Spam Test','9000000001',null,null,null,true,'direct');
    raise exception 'FAIL 4th booking in an hour accepted';
  exception when sqlstate 'P0001' then raise notice 'PASS rate limit (3 per mobile per hour)'; end;
end $$;

-- My booking lookup / cancel
do $$ declare n int; r record; begin
  execute 'set local role anon';
  select count(*) into n from public.get_booking('kadam-hospital', (select token from public.get_booking('kadam-hospital','KH-' || to_char((select d from public._t where k='opd'),'MMDD') || '-001','9822014210')), '9999999999');
  if n <> 0 then raise exception 'FAIL lookup with wrong mobile returned data'; end if;
  raise notice 'PASS lookup with wrong mobile returns nothing';
  select * into r from public.get_booking('kadam-hospital','kh-' || to_char((select d from public._t where k='opd'),'MMDD') || '-001','+91 98220 14210');
  if r.patient_first_name <> 'Priya' or r.status <> 'confirmed' then raise exception 'FAIL lookup: %', r; end if;
  raise notice 'PASS lookup with token + mobile returns only that booking (%)', r.token;
end $$;

\echo '--- staff ---'
do $$ declare n int; begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000aaaa', true);
  execute 'set local role authenticated';
  select count(*) into n from public.bookings;
  if n < 4 then raise exception 'FAIL Kadam staff sees % bookings', n; end if;
  raise notice 'PASS Kadam reception sees its % bookings', n;
  update public.bookings set status = 'checked_in' where token like 'KH-%-001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL staff status update'; end if;
  raise notice 'PASS reception can change booking status';
  begin update public.bookings set patient_mobile = '9111111111'; raise exception 'FAIL staff edited patient mobile';
  exception when insufficient_privilege then raise notice 'PASS staff can only change status column'; end;
  update public.doctors set fee_inr = 1 ;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL reception edited doctors'; end if;
  raise notice 'PASS reception (non-admin) cannot edit settings';
end $$;

do $$ declare n int; begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000bbbb', true);
  execute 'set local role authenticated';
  select count(*) into n from public.bookings;
  if n <> 0 then raise exception 'FAIL other tenant staff sees % Kadam bookings', n; end if;
  update public.bookings set status = 'cancelled';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL other tenant cancelled Kadam bookings'; end if;
  select count(*) into n from public.audit_log;
  if n <> 0 then raise exception 'FAIL other tenant sees audit'; end if;
  raise notice 'PASS staff of another hospital cannot see or change Kadam data';
end $$;

do $$ declare n int; begin
  select count(*) into n from public.audit_log where action = 'status:checked_in' and user_id = '00000000-0000-4000-8000-00000000aaaa';
  if n <> 1 then raise exception 'FAIL audit log missing'; end if;
  raise notice 'PASS status change written to audit_log with staff user id';
end $$;

-- Patient cancel
do $$ declare v text; tok text; begin
  select token into tok from public.bookings where patient_mobile = '9000000001' order by start_time limit 1;
  execute 'set local role anon';
  v := public.cancel_booking('kadam-hospital', tok, '9000000001');
  if v <> 'cancelled' then raise exception 'FAIL cancel'; end if;
  raise notice 'PASS patient can cancel own booking with token + mobile';
end $$;

drop table public._t;
\echo 'ALL TESTS PASSED'
