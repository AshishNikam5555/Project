/* Data layer with two interchangeable backends:
 *   live — Supabase (Postgres + RLS + RPC functions + Realtime + magic-link auth)
 *   demo — this browser only (localStorage), same rules as the SQL functions, for pitching without any setup.
 * Pages only call CF_API.*, never Supabase directly. */
(function () {
  const C = window.CF_CONFIG;
  const LIVE = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const ACTIVE = ['requested', 'confirmed', 'checked_in'];
  const SB_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

  // WhatsApp admin-alert text (same format as supabase/functions/notify-whatsapp)
  function alertText(ev, b, ctx) {
    const head = ev === 'cancelled' ? 'Booking cancelled' : 'New booking';
    const first = String(b.patient_name || '').trim().split(/\s+/);
    const name = first.length > 1 ? `${first[0]} ${first[1][0]}.` : first[0];
    const d = new Date(b.date + 'T00:00:00');
    const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const src = { poster: 'QR poster', whatsapp: 'WhatsApp', maps: 'Google Maps', card: 'Visiting card', status: 'WhatsApp status', direct: 'Website', staff: 'Reception' }[b.source] || b.source;
    return `🦴 ${head} — ${ctx.tenantShort}\nToken: ${b.token}\nPatient: ${name} (${UI.maskMobile(b.patient_mobile)})\nService: ${ctx.service}\nDoctor: ${ctx.doctor}\nSlot: ${day}, ${UI.time12(b.start_time)}\nSource: ${src}\nOpen: ${C.PUBLIC_URL}/admin/today.html`;
  }

  /* ============================ DEMO BACKEND ============================ */
  function demoBackend() {
    const KEY = 'cf-demo-db-v1:' + UI.tenantSlug;
    const chan = 'BroadcastChannel' in window ? new BroadcastChannel('cf-demo:' + UI.tenantSlug) : null;
    const listeners = new Set();
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
    let db = null;

    function load() {
      try { const j = localStorage.getItem(KEY); if (j) return JSON.parse(j); } catch (e) {}
      return null;
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
    function emit(type, record) {
      const m = { type, record };
      listeners.forEach(fn => fn(m));
      if (chan) chan.postMessage(m);
    }
    if (chan) chan.onmessage = e => { db = load() || db; listeners.forEach(fn => fn(e.data)); };
    window.addEventListener('storage', e => { if (e.key === KEY) db = load() || db; });

    function init() {
      db = load();
      if (db) return;
      const S = window.CF_SEED;
      if (S.tenant.slug !== UI.tenantSlug) throw new Error('Unknown hospital');
      db = {
        tenant: { id: S.tenant.id, slug: S.tenant.slug, name: S.tenant.name, config: S.tenant.config },
        doctors: S.doctors.map(d => ({ ...d })), categories: S.categories.map(c => ({ ...c })),
        services: S.services.map(({ doctor_ids, ...s }) => s),
        doctor_services: S.services.flatMap(s => s.doctor_ids.map(d => ({ doctor_id: d, service_id: s.id }))),
        availability: S.availability.map(a => ({ id: uuid(), ...a })), leaves: [],
        bookings: [], counters: {}, notifications: [], audit: []
      };
      seedSampleBookings();
      save();
    }
    // Realistic sample bookings so the staff screens aren't empty in a pitch. Clearly marked as sample.
    function seedSampleBookings() {
      const names = ['Sunil Shinde', 'Anita Gaikwad', 'Rajesh Bhosale', 'Kavita Pawar', 'Sachin Jadhav', 'Mangal Kale', 'Vishal Thorat', 'Pooja Wagh', 'Dattatray More', 'Sneha Kulkarni', 'Ganesh Shelke', 'Rekha Salunke', 'Amol Deshmukh', 'Sunita Borude'];
      const srcs = ['poster', 'poster', 'whatsapp', 'maps', 'direct', 'poster', 'status', 'card'];
      const now = UI.nowLocal(); let n = 0;
      for (let off = 0; off < 6; off++) {
        const k = UI.addDays(now.date, off);
        const docs = db.doctors.filter(d => slotsFor(d.id, k, true).length);
        docs.forEach(d => {
          const sl = slotsFor(d.id, k, true); const count = off === 0 ? 6 : 3 - Math.min(2, off >> 1);
          for (let i = 0; i < count && sl.length; i++) {
            const s = sl.splice((i * 7 + off * 3 + n) % sl.length, 1)[0];
            const svcs = db.doctor_services.filter(x => x.doctor_id === d.id).map(x => x.service_id);
            const sv = svcs[(n * 5) % svcs.length];
            const past = off === 0 && UI.toMin(s) < now.min;
            insertBooking({ doctor_id: d.id, service_id: sv, date: k, start_time: s, patient_name: names[n % names.length],
              patient_mobile: '9' + String(812340000 + n * 7919).slice(0, 9), age: 18 + (n * 13) % 60, gender: n % 2 ? 'F' : 'M', note: null,
              source: srcs[n % srcs.length], status: past ? (n % 5 === 0 ? 'no_show' : 'completed') : 'confirmed', sample: true,
              created_at: new Date(Date.now() - (40 - n) * 3600e3).toISOString() }, false);
            n++;
          }
        });
      }
    }
    function nextToken(date) {
      db.counters[date] = (db.counters[date] || 0) + 1;
      return `${db.tenant.config.token_prefix || 'CF'}-${date.slice(5, 7)}${date.slice(8, 10)}-${String(db.counters[date]).padStart(3, '0')}`;
    }
    function insertBooking(b, notify = true) {
      const rec = { id: uuid(), tenant_id: db.tenant.id, token: nextToken(b.date), consent: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...b };
      db.bookings.push(rec);
      db.audit.push({ action: 'created', booking_id: rec.id, at: rec.created_at, user: null });
      if (notify) queueAlert('new', rec);
      return rec;
    }
    function queueAlert(ev, b) {
      const doc = db.doctors.find(d => d.id === b.doctor_id), sv = db.services.find(s => s.id === b.service_id);
      db.notifications.unshift({ id: uuid(), booking_id: b.id, event: ev, channel: 'whatsapp', to_masked: 'Admin WhatsApp (set on server)', status: 'simulated', provider: 'demo',
        text: alertText(ev === 'new' ? 'new' : 'cancelled', b, { tenantShort: db.tenant.config.short_name, service: sv?.name, doctor: doc?.name }), sent_at: new Date().toISOString() });
      db.notifications = db.notifications.slice(0, 50);
    }
    // Same rules as the SQL availability check (weekday sessions, slot grid, leave days)
    function slotsFor(doctorId, date, ignorePast) {
      const wd = UI.weekday(date);
      if (db.leaves.some(l => l.date === date && (!l.doctor_id || l.doctor_id === doctorId))) return [];
      const now = UI.nowLocal(); const out = [];
      db.availability.filter(a => a.doctor_id === doctorId && a.weekday === wd).forEach(a => {
        for (let m = UI.toMin(a.start_time); m + a.slot_min <= UI.toMin(a.end_time); m += a.slot_min) {
          if (!ignorePast && (date < now.date || (date === now.date && m <= now.min))) continue;
          out.push(UI.fromMin(m));
        }
      });
      return out.sort();
    }
    const P = fn => (...a) => { try { init(); return Promise.resolve(fn(...a)); } catch (e) { return Promise.reject(e); } };
    const err = m => { throw new Error(m); };

    return {
      mode: 'demo',
      getCatalog: P(() => ({ tenant: db.tenant, doctors: db.doctors.filter(d => d.active), categories: db.categories, services: db.services.filter(s => s.active),
        doctor_services: db.doctor_services, availability: db.availability, leaves: db.leaves.map(({ reason, ...l }) => l) })),
      getTakenSlots: P((from, to) => db.bookings.filter(b => b.date >= from && b.date <= to && ACTIVE.includes(b.status)).map(b => ({ doctor_id: b.doctor_id, date: b.date, start_time: b.start_time }))),
      createBooking: P(p => {
        const cfg = db.tenant.config, now = UI.nowLocal();
        if (!p.consent) err('Please agree to be contacted about this appointment');
        if (!p.name || p.name.trim().length < 2) err("Please enter the patient's name");
        const mobile = String(p.mobile || '').replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(mobile)) err('Enter a valid 10-digit mobile number');
        if (p.note && p.note.length > 120) err('Keep the problem description under 120 characters');
        const win = cfg.booking_window_days || 7;
        if (p.date < now.date || p.date > UI.addDays(now.date, win)) err(`Choose a date within the next ${win} days`);
        if (p.date === now.date && UI.toMin(p.start_time) <= now.min) err('This time has already passed. Please choose a later slot');
        const sv = db.services.find(s => s.id === p.service_id && s.active && s.bookable);
        const doc = db.doctors.find(d => d.id === p.doctor_id && d.active);
        if (!sv || !doc || !db.doctor_services.some(x => x.doctor_id === doc.id && x.service_id === sv.id)) err('This service is not available with the selected doctor');
        if (db.leaves.some(l => l.date === p.date && (!l.doctor_id || l.doctor_id === doc.id))) err('The doctor is on leave that day. Please choose another date');
        if (!slotsFor(doc.id, p.date).includes(p.start_time)) err('The doctor is not available at this time');
        if (db.bookings.filter(b => b.patient_mobile === mobile && Date.now() - new Date(b.created_at) < 3600e3).length >= 3) err('Too many bookings from this number. Please call the hospital');
        if (db.bookings.some(b => b.doctor_id === doc.id && b.date === p.date && b.start_time === p.start_time && ACTIVE.includes(b.status))) err('Sorry, this slot was just taken. Please choose another time');
        const rec = insertBooking({ doctor_id: doc.id, service_id: sv.id, date: p.date, start_time: p.start_time, status: cfg.auto_confirm === false ? 'requested' : 'confirmed',
          patient_name: p.name.trim(), patient_mobile: mobile, age: p.age ? Number(p.age) : null, gender: p.gender || null, note: p.note ? p.note.trim() : null,
          source: ['poster', 'whatsapp', 'maps', 'card', 'status', 'direct'].includes(p.source) ? p.source : 'direct' });
        save(); emit('INSERT', rec);
        return { booking_id: rec.id, token: rec.token, status: rec.status };
      }),
      getBooking: P((token, mobile) => {
        const m = String(mobile || '').replace(/\D/g, '').slice(-10);
        const b = db.bookings.find(x => x.token.toUpperCase() === String(token || '').trim().toUpperCase() && x.patient_mobile === m);
        if (!b) return null;
        const d = db.doctors.find(x => x.id === b.doctor_id), s = db.services.find(x => x.id === b.service_id);
        return { id: b.id, token: b.token, status: b.status, date: b.date, start_time: b.start_time, doctor_name: d?.name, service_name: s?.name, service_name_mr: s?.name_mr, patient_first_name: b.patient_name.split(' ')[0] };
      }),
      cancelBooking: P((token, mobile) => {
        const m = String(mobile || '').replace(/\D/g, '').slice(-10);
        const b = db.bookings.find(x => x.token.toUpperCase() === String(token || '').trim().toUpperCase() && x.patient_mobile === m);
        if (!b) err('No booking found for this token and mobile number');
        if (!['requested', 'confirmed'].includes(b.status)) err('This booking can no longer be cancelled online');
        const now = UI.nowLocal();
        if (b.date < now.date || (b.date === now.date && UI.toMin(b.start_time) <= now.min)) err('This appointment time has passed');
        b.status = 'cancelled'; b.updated_at = new Date().toISOString();
        db.audit.push({ action: 'status:cancelled', booking_id: b.id, at: b.updated_at, user: null });
        queueAlert('cancelled', b); save(); emit('UPDATE', b);
        return 'cancelled';
      }),
      // ---- staff ----
      auth: {
        session: P(() => { try { return JSON.parse(localStorage.getItem('cf-demo-staff') || 'null'); } catch (e) { return null; } }),
        sendLink: P(email => { const s = { email, role: 'admin', demo: true }; localStorage.setItem('cf-demo-staff', JSON.stringify(s)); return { demoSignedIn: true }; }),
        staffRole: P(() => 'admin'),
        signOut: P(() => { localStorage.removeItem('cf-demo-staff'); })
      },
      tenant: P(() => db.tenant),
      listBookings: P((from, to) => db.bookings.filter(b => b.date >= from && b.date <= to).map(b => ({ ...b }))),
      bookingById: P(id => db.bookings.find(b => b.id === id) || null),
      bookingByToken: P(tok => db.bookings.find(b => b.token.toUpperCase() === String(tok).trim().toUpperCase()) || null),
      setStatus: P((id, status) => {
        const b = db.bookings.find(x => x.id === id); if (!b) err('Booking not found');
        b.status = status; b.updated_at = new Date().toISOString();
        db.audit.push({ action: 'status:' + status, booking_id: id, at: b.updated_at, user: 'demo-staff' });
        if (status === 'cancelled') queueAlert('cancelled', b);
        save(); emit('UPDATE', b); return b;
      }),
      notifications: P(() => db.notifications.slice(0, 20)),
      subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
      settings: P(() => ({ tenant: db.tenant, doctors: db.doctors, categories: db.categories, services: db.services, doctor_services: db.doctor_services, availability: db.availability, leaves: db.leaves })),
      saveTenantConfig: P(cfg => { db.tenant.config = { ...db.tenant.config, ...cfg }; save(); }),
      saveDoctor: P(d => { Object.assign(db.doctors.find(x => x.id === d.id), d); save(); }),
      saveService: P((s, doctorIds) => { Object.assign(db.services.find(x => x.id === s.id), s); if (doctorIds) { db.doctor_services = db.doctor_services.filter(x => x.service_id !== s.id).concat(doctorIds.map(d => ({ doctor_id: d, service_id: s.id }))); } save(); }),
      saveAvailability: P((doctorId, rows) => { db.availability = db.availability.filter(a => a.doctor_id !== doctorId).concat(rows.map(r => ({ id: uuid(), doctor_id: doctorId, ...r }))); save(); }),
      addLeave: P(l => { db.leaves.push({ id: uuid(), ...l }); save(); }),
      deleteLeave: P(id => { db.leaves = db.leaves.filter(l => l.id !== id); save(); }),
      resetDemo: () => { try { localStorage.removeItem(KEY); } catch (e) {} db = null; }
    };
  }

  /* ============================ LIVE BACKEND (Supabase) ============================ */
  function liveBackend() {
    let sbP = null, tenantP = null;
    const sb = () => sbP || (sbP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = SB_SRC; s.async = true;
      s.onload = () => res(window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY));
      s.onerror = () => rej(new Error('Could not reach the booking server. Check your internet connection.'));
      document.head.appendChild(s);
    }));
    const unwrap = ({ data, error }) => { if (error) throw new Error(error.message || 'Something went wrong'); return data; };
    const tenant = () => tenantP || (tenantP = sb().then(c => c.from('tenants').select('id,slug,name,config').eq('slug', UI.tenantSlug).single()).then(unwrap));
    const tid = async () => (await tenant()).id;

    return {
      mode: 'live',
      async getCatalog() {
        const c = await sb(), t = await tenant();
        const [doctors, categories, services, doctor_services, availability, leaves] = await Promise.all([
          c.from('doctors').select('*').eq('tenant_id', t.id).eq('active', true).order('sort'),
          c.from('service_categories').select('*').eq('tenant_id', t.id).order('sort'),
          c.from('services').select('*').eq('tenant_id', t.id).eq('active', true).order('sort'),
          c.from('doctor_services').select('doctor_id,service_id').eq('tenant_id', t.id),
          c.from('availability').select('*').eq('tenant_id', t.id),
          c.from('leaves').select('id,doctor_id,date').eq('tenant_id', t.id).gte('date', UI.nowLocal().date)
        ].map(p => p.then(unwrap)));
        return { tenant: t, doctors, categories, services, doctor_services, availability: availability.map(a => ({ ...a, start_time: a.start_time.slice(0, 5), end_time: a.end_time.slice(0, 5) })), leaves };
      },
      async getTakenSlots(from, to) {
        const rows = unwrap(await (await sb()).rpc('get_taken_slots', { p_tenant_slug: UI.tenantSlug, p_from: from, p_to: to }));
        return rows.map(r => ({ ...r, start_time: r.start_time.slice(0, 5) }));
      },
      async createBooking(p) {
        const rows = unwrap(await (await sb()).rpc('create_booking', { p_tenant_slug: UI.tenantSlug, p_doctor_id: p.doctor_id, p_service_id: p.service_id, p_date: p.date,
          p_start_time: p.start_time, p_name: p.name, p_mobile: p.mobile, p_age: p.age ? Number(p.age) : null, p_gender: p.gender || null, p_note: p.note || null,
          p_consent: !!p.consent, p_source: p.source }));
        return rows[0];
      },
      async getBooking(token, mobile) {
        const rows = unwrap(await (await sb()).rpc('get_booking', { p_tenant_slug: UI.tenantSlug, p_token: token, p_mobile: mobile }));
        return rows[0] ? { ...rows[0], start_time: rows[0].start_time.slice(0, 5) } : null;
      },
      async cancelBooking(token, mobile) { return unwrap(await (await sb()).rpc('cancel_booking', { p_tenant_slug: UI.tenantSlug, p_token: token, p_mobile: mobile })); },
      auth: {
        async session() { const { data } = await (await sb()).auth.getSession(); return data.session ? { email: data.session.user.email, user_id: data.session.user.id } : null; },
        async sendLink(email) {
          unwrap(await (await sb()).auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.href.replace(/login\.html.*$/, 'today.html') } }));
          return { sent: true };
        },
        async staffRole() {
          const c = await sb(); const { data: u } = await c.auth.getUser(); if (!u.user) return null;
          const r = unwrap(await c.from('staff').select('role').eq('tenant_id', await tid()).eq('user_id', u.user.id).maybeSingle());
          return r ? r.role : null;
        },
        async signOut() { await (await sb()).auth.signOut(); }
      },
      tenant,
      async listBookings(from, to) {
        const rows = unwrap(await (await sb()).from('bookings').select('*').eq('tenant_id', await tid()).gte('date', from).lte('date', to).order('date').order('start_time'));
        return rows.map(r => ({ ...r, start_time: r.start_time.slice(0, 5) }));
      },
      async bookingById(id) { const r = unwrap(await (await sb()).from('bookings').select('*').eq('id', id).maybeSingle()); return r && { ...r, start_time: r.start_time.slice(0, 5) }; },
      async bookingByToken(tok) { const r = unwrap(await (await sb()).from('bookings').select('*').eq('tenant_id', await tid()).ilike('token', String(tok).trim()).maybeSingle()); return r && { ...r, start_time: r.start_time.slice(0, 5) }; },
      async setStatus(id, status) { return unwrap(await (await sb()).from('bookings').update({ status }).eq('id', id).select().single()); },
      async notifications() { return unwrap(await (await sb()).from('notifications').select('*').eq('tenant_id', await tid()).order('sent_at', { ascending: false }).limit(20)); },
      subscribe(cb) {
        let ch;
        (async () => {
          const c = await sb(); const t = await tid();
          ch = c.channel('bookings-' + t).on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: 'tenant_id=eq.' + t },
            p => cb({ type: p.eventType, record: { ...p.new, start_time: (p.new.start_time || '').slice(0, 5) } })).subscribe();
        })();
        return () => ch && ch.unsubscribe();
      },
      async settings() {
        const c = await sb(), t = await tenant();
        const q = (tb, sel = '*') => c.from(tb).select(sel).eq('tenant_id', t.id).then(unwrap);
        const [doctors, categories, services, doctor_services, availability, leaves] = await Promise.all([q('doctors'), q('service_categories'), q('services'), q('doctor_services'), q('availability'), q('leaves')]);
        return { tenant: t, doctors: doctors.sort((a, b) => a.sort - b.sort), categories, services: services.sort((a, b) => a.sort - b.sort), doctor_services,
          availability: availability.map(a => ({ ...a, start_time: a.start_time.slice(0, 5), end_time: a.end_time.slice(0, 5) })), leaves };
      },
      async saveTenantConfig(cfg) { const c = await sb(), t = await tenant(); unwrap(await c.from('tenants').update({ config: { ...t.config, ...cfg } }).eq('id', t.id)); t.config = { ...t.config, ...cfg }; },
      async saveDoctor(d) { const { id, confirm, ...rest } = d; unwrap(await (await sb()).from('doctors').update(rest).eq('id', id)); },
      async saveService(s, doctorIds) {
        const c = await sb(), t = await tid(); const { id, confirm, ...rest } = s;
        unwrap(await c.from('services').update(rest).eq('id', id));
        if (doctorIds) {
          unwrap(await c.from('doctor_services').delete().eq('service_id', id));
          if (doctorIds.length) unwrap(await c.from('doctor_services').insert(doctorIds.map(d => ({ tenant_id: t, doctor_id: d, service_id: id }))));
        }
      },
      async saveAvailability(doctorId, rows) {
        const c = await sb(), t = await tid();
        unwrap(await c.from('availability').delete().eq('doctor_id', doctorId));
        if (rows.length) unwrap(await c.from('availability').insert(rows.map(r => ({ ...r, tenant_id: t, doctor_id: doctorId }))));
      },
      async addLeave(l) { unwrap(await (await sb()).from('leaves').insert({ ...l, tenant_id: await tid() })); },
      async deleteLeave(id) { unwrap(await (await sb()).from('leaves').delete().eq('id', id)); },
      resetDemo() {}
    };
  }

  window.CF_API = LIVE ? liveBackend() : demoBackend();
  window.CF_API.alertText = alertText;
})();
