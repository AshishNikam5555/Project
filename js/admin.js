/* Staff pages: login, today (live), scan (QR check-in), calendar (7 days + CSV), settings (admin). English only. */
(function () {
  const { icon, esc, $, $$, nowLocal, addDays, time12, toast, sheet, closeSheet, telHref, waHref } = UI;
  const page = document.body.dataset.page;
  const app = $('#app');
  const ST = { requested: 'Requested', confirmed: 'Confirmed', checked_in: 'Checked in', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
  const SRC = {
    poster: 'QR poster',
    whatsapp: 'WhatsApp',
    maps: 'Google Maps',
    card: 'Visiting card',
    status: 'WhatsApp status',
    direct: 'Website',
    staff: 'Reception'
  };
  const pill = s => `<span class="st st-${s}">${ST[s]}</span>`;
  let CAT = null,
    ROLE = null;
  const today = () => nowLocal(CAT ? CAT.tenant.config.timezone : undefined).date;
  const docName = id => (CAT.doctors.find(d => d.id === id) || {}).name || '—';
  const svcName = id => (CAT.services.find(s => s.id === id) || {}).name || '—';
  const dayLabel = k => new Date(k + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  function header() {
    const links = [
      ['today.html', 'Today', 'list'],
      ['scan.html', 'Scan QR', 'qr'],
      ['calendar.html', 'Calendar', 'calendar'],
      ['settings.html', 'Settings', 'sliders']
    ];
    $('#top').innerHTML = `<div class="wrap wide" style="flex-wrap:wrap;padding-block:6px">
      <div class="mono" aria-hidden="true">${esc((CAT.tenant.config.short_name || 'C')[0])}</div>
      <div class="top-title">${esc(CAT.tenant.config.short_name)} · Staff <span id="live" class="live off" style="margin-left:8px">Connecting</span></div>
      <button class="btn btn-gray sm" id="signout">${icon('logout', 'sm')}Sign out</button>
      <nav class="anav" style="width:100%" aria-label="Staff">${links.map(([h, l, i]) => `<a href="${h}" ${location.pathname.endsWith(h) ? 'aria-current="page"' : ''}>${icon(i, 'sm')}${l}</a>`).join('')}<a href="../index.html" target="_blank" rel="noopener">${icon('hospital', 'sm')}Patient site</a></nav></div>`;
    $('#signout').onclick = async () => {
      await CF_API.auth.signOut();
      location.href = 'login.html';
    };
  }
  function setLive(on) {
    const l = $('#live');
    if (l) {
      l.className = 'live' + (on ? '' : ' off');
      l.textContent = on ? 'Live' : 'Offline';
    }
  }
  async function guard() {
    const s = await CF_API.auth.session();
    if (!s) {
      location.href = 'login.html';
      return false;
    }
    ROLE = await CF_API.auth.staffRole();
    if (!ROLE) {
      await CF_API.auth.signOut();
      location.href = 'login.html?e=notstaff';
      return false;
    }
    CAT = await CF_API.settings();
    header();
    return true;
  }
  function chime() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320].forEach((f, i) => {
        const o = a.createOscillator(),
          g = a.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, a.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + i * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i * 0.18 + 0.35);
        o.connect(g).connect(a.destination);
        o.start(a.currentTime + i * 0.18);
        o.stop(a.currentTime + i * 0.18 + 0.4);
      });
    } catch (e) {}
  }
  function csv(rows, name) {
    const cols = [
      'token',
      'date',
      'start_time',
      'status',
      'patient_name',
      'patient_mobile',
      'age',
      'gender',
      'service',
      'doctor',
      'source',
      'note',
      'created_at'
    ];
    const q = v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = [
      cols.join(','),
      ...rows.map(b => cols.map(c => q(c === 'service' ? svcName(b.service_id) : c === 'doctor' ? docName(b.doctor_id) : b[c])).join(','))
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`Exported ${rows.length} bookings`);
  }
  const ACTIONS = {
    requested: [
      ['confirmed', 'Confirm', 'btn-primary'],
      ['cancelled', 'Decline', 'btn-danger']
    ],
    confirmed: [
      ['checked_in', 'Check in', 'btn-primary'],
      ['no_show', 'No-show', 'btn-gray'],
      ['cancelled', 'Cancel', 'btn-danger']
    ],
    checked_in: [
      ['completed', 'Complete', 'btn-green'],
      ['confirmed', 'Undo check-in', 'btn-gray']
    ],
    completed: [],
    cancelled: [['confirmed', 'Restore', 'btn-gray']],
    no_show: [['confirmed', 'Restore', 'btn-gray']]
  };
  function openBooking(b, onChange) {
    const sh =
      sheet(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="tok" style="font-size:15px">${esc(b.token)}</div><h2 style="margin:2px 0 6px;font-size:24px">${esc(b.patient_name)}</h2>${pill(b.status)}</div><button class="btn btn-gray sm" data-close aria-label="Close">${icon('x', 'sm')}</button></div>
      <div class="list" style="margin-top:14px">
        <div class="kv"><span>When</span><b>${dayLabel(b.date)}, ${time12(b.start_time)}</b></div>
        <div class="kv"><span>Service</span><b>${esc(svcName(b.service_id))}</b></div>
        <div class="kv"><span>Doctor</span><b>${esc(docName(b.doctor_id))}</b></div>
        <div class="kv"><span>Mobile</span><b class="num">+91 ${esc(b.patient_mobile)}</b></div>
        <div class="kv"><span>Age / gender</span><b>${b.age ?? '—'} / ${{ F: 'Female', M: 'Male', O: 'Other' }[b.gender] || '—'}</b></div>
        ${b.note ? `<div class="kv"><span>Problem</span><b style="font-weight:500">${esc(b.note)}</b></div>` : ''}
        <div class="kv"><span>Source</span><b>${SRC[b.source] || esc(b.source)}${b.sample ? ' · sample' : ''}</b></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${ACTIONS[b.status].map(([s, l, c]) => `<button class="btn ${c}" style="flex:1" data-set="${s}">${l}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><a class="btn btn-soft sm" style="flex:1" href="${telHref('+91' + b.patient_mobile)}">${icon('phone', 'sm')}Call</a><a class="btn btn-soft sm" style="flex:1" target="_blank" rel="noopener" href="${waHref('91' + b.patient_mobile, `Hello ${b.patient_name.split(' ')[0]}, this is ${CAT.tenant.config.short_name} about your appointment ${b.token} on ${dayLabel(b.date)} at ${time12(b.start_time)}.`)}">${icon('chat', 'sm')}WhatsApp</a></div>`);
    sh.addEventListener('click', async e => {
      const x = e.target.closest('[data-set]');
      if (!x) return;
      x.disabled = true;
      try {
        const nb = await CF_API.setStatus(b.id, x.dataset.set);
        closeSheet();
        toast(`${b.token} → ${ST[x.dataset.set]}`);
        onChange && onChange({ ...b, ...nb, start_time: b.start_time });
      } catch (err) {
        x.disabled = false;
        toast(err.message);
      }
    });
  }

  /* ---------- Login ---------- */
  async function login() {
    const demo = CF_API.mode === 'demo';
    let cat = null;
    try {
      cat = await CF_API.getCatalog();
    } catch (e) {}
    const name = cat ? cat.tenant.config.short_name : 'CareFlow';
    if ((await CF_API.auth.session()) && (await CF_API.auth.staffRole())) {
      location.href = 'today.html';
      return;
    }
    const err = new URLSearchParams(location.search).get('e');
    $('#top').innerHTML = `<div class="wrap"><div class="mono">${esc(name[0])}</div><div class="top-title">${esc(name)} · Staff</div></div>`;
    app.innerHTML = `<h1 class="lt">Staff sign in</h1><p class="sub">We’ll email you a one-time sign-in link. Only reception and admin staff added by the hospital can sign in.</p>
      ${err === 'notstaff' ? `<div class="alert err" style="margin-bottom:14px">${icon('alert')}<div>This email is not on the staff list for ${esc(name)}. Ask the admin to add you.</div></div>` : ''}
      ${demo ? `<div class="alert warn" style="margin-bottom:14px">${icon('info')}<div><b>Demo mode.</b> No email is sent. Any address signs you in as an admin on this device.</div></div>` : ''}
      <form id="f" novalidate><div class="list"><div class="field"><label for="email">Work email</label><input id="email" type="email" autocomplete="email" placeholder="reception@hospital.in" ${demo ? 'value="reception@kadam.demo"' : ''} required></div></div>
      <button class="btn btn-primary block" style="margin-top:14px">${icon('mail')}${demo ? 'Sign in (demo)' : 'Email me a sign-in link'}</button></form><div id="msg"></div>${UI.demoFooter()}`;
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const email = $('#email').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        $('#msg').innerHTML = `<div class="alert err" style="margin-top:14px">${icon('alert')}<div>Enter a valid email address.</div></div>`;
        return;
      }
      try {
        const r = await CF_API.auth.sendLink(email);
        if (r.demoSignedIn) {
          location.href = 'today.html';
          return;
        }
        $('#msg').innerHTML =
          `<div class="alert info" style="margin-top:14px">${icon('mail')}<div>Check <b>${esc(email)}</b> for a sign-in link. Open it on this device.</div></div>`;
      } catch (err) {
        $('#msg').innerHTML = `<div class="alert err" style="margin-top:14px">${icon('alert')}<div>${esc(err.message)}</div></div>`;
      }
    };
  }

  /* ---------- Today ---------- */
  const T = { date: null, q: '', doc: 'all', st: 'all', rows: [], range: null, newIds: new Set(), unseen: 0 };
  async function loadRange(date) {
    const from = addDays(date, -30),
      to = addDays(date, 7);
    T.rows = await CF_API.listBookings(from, to);
    T.range = [from, to];
  }
  async function todayPage() {
    T.date = new URLSearchParams(location.search).get('date') || today();
    await loadRange(T.date);
    renderToday();
    CF_API.subscribe(m => {
      const r = m.record;
      if (!r || !r.id) return;
      const i = T.rows.findIndex(x => x.id === r.id);
      if (i >= 0) T.rows[i] = { ...T.rows[i], ...r };
      else T.rows.push(r);
      if (m.type === 'INSERT') {
        T.newIds.add(r.id);
        chime();
        toast(`New booking ${r.token} · ${dayLabel(r.date)}, ${time12(r.start_time)}`);
        if (document.hidden) {
          T.unseen++;
          document.title = `(${T.unseen}) Today · Staff`;
        }
      }
      renderToday();
      refreshAlerts();
    });
    setLive(true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        T.unseen = 0;
        document.title = 'Today · Staff';
      }
    });
    refreshAlerts();
  }
  async function refreshAlerts() {
    const el = $('#alerts');
    if (!el) return;
    let list = [];
    try {
      list = await CF_API.notifications();
    } catch (e) {}
    el.innerHTML = list.length
      ? list
          .slice(0, 6)
          .map(
            n =>
              `<div class="row" style="display:block"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><b>${n.event === 'cancelled' ? 'Cancellation alert' : 'New booking alert'}</b><span class="muted">${new Date(n.sent_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · ${esc(n.status)}</span></div>${n.text ? `<div class="msg">${esc(n.text)}</div>` : `<div class="muted" style="font-size:14px">To ${esc(n.to_masked)}</div>`}</div>`
          )
          .join('')
      : `<p class="muted" style="padding:16px;margin:0">No WhatsApp alerts yet. They appear here as bookings come in.</p>`;
  }
  function renderToday() {
    const day = T.rows.filter(b => b.date === T.date);
    let list = day.slice();
    if (T.doc !== 'all') list = list.filter(b => b.doctor_id === T.doc);
    if (T.st !== 'all') list = list.filter(b => (T.st === 'active' ? ['requested', 'confirmed', 'checked_in'].includes(b.status) : b.status === T.st));
    const q = T.q.trim().toLowerCase();
    if (q) list = list.filter(b => (b.patient_name + ' ' + b.patient_mobile + ' ' + b.token).toLowerCase().includes(q));
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    const live = day.filter(b => b.status !== 'cancelled');
    const last30 = T.rows.filter(b => b.date > addDays(today(), -30) && b.date <= addDays(today(), 7) && b.status !== 'cancelled');
    const bySrc = Object.keys(SRC)
      .map(k => [k, last30.filter(b => b.source === k).length])
      .filter(x => x[1])
      .sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...bySrc.map(x => x[1]));
    const qEl = document.activeElement && document.activeElement.id === 'tq';
    app.innerHTML = `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div><h1 class="lt" style="margin-bottom:0">${T.date === today() ? 'Today' : dayLabel(T.date)}</h1><div class="muted">${dayLabel(T.date)}${CF_API.mode === 'demo' ? ' · Demo data on this device' : ''}</div></div>
        <div style="display:flex;gap:8px"><button class="btn btn-gray sm" data-day="-1" aria-label="Previous day">${icon('chevL', 'sm')}</button><button class="btn btn-gray sm" data-day="0">Today</button><button class="btn btn-gray sm" data-day="1" aria-label="Next day">${icon('chevR', 'sm')}</button><button class="btn btn-soft sm" id="export">${icon('download', 'sm')}CSV</button></div></div>
      <div class="kpis" style="margin-top:16px">
        <div class="kpi"><span>Booked</span><b>${live.length}</b></div>
        <div class="kpi"><span>Checked in</span><b>${day.filter(b => b.status === 'checked_in').length}</b></div>
        <div class="kpi"><span>Completed</span><b>${day.filter(b => b.status === 'completed').length}</b></div>
        <div class="kpi"><span>From QR poster</span><b>${live.filter(b => b.source === 'poster').length}</b></div>
      </div>
      <div class="split" style="margin-top:20px"><div>
        <label class="search">${icon('search', 'sm')}<span class="sr">Search</span><input id="tq" type="search" placeholder="Search name, mobile or token" value="${esc(T.q)}" autocomplete="off"></label>
        <div class="hscroll" style="margin-top:10px">${[['all', 'All doctors'], ...CAT.doctors.map(d => [d.id, d.name])].map(([v, l]) => `<button class="chip" data-doc="${v}" aria-pressed="${T.doc === v}">${esc(l)}</button>`).join('')}</div>
        <div class="hscroll">${[['all', 'All'], ['active', 'Upcoming'], ...Object.entries(ST)].map(([v, l]) => `<button class="chip" data-st="${v}" aria-pressed="${T.st === v}">${l}</button>`).join('')}</div>
        <div class="list" style="margin-top:8px">${list.map(b => `<button class="row ${T.newIds.has(b.id) ? 'new' : ''}" data-id="${b.id}"><div class="time"><b>${time12(b.start_time).replace(/ (AM|PM)/, '')}</b><span>${time12(b.start_time).slice(-2)}</span></div><div class="grow"><div class="t1">${esc(b.patient_name)} <span class="tok">${esc(b.token)}</span></div><div class="t2">${esc(svcName(b.service_id))} · ${esc(docName(b.doctor_id))}</div></div><span class="end">${pill(b.status)}</span></button>`).join('') || `<p class="muted" style="padding:24px 16px;margin:0;text-align:center">No bookings${q || T.doc !== 'all' || T.st !== 'all' ? ' match these filters' : ' for this day yet'}.</p>`}</div>
      </div><div>
        <section><div class="sec-h"><h2>WhatsApp alerts</h2></div><div class="list" id="alerts"><p class="muted" style="padding:16px;margin:0">Loading…</p></div>
          <p class="foot">${CF_API.mode === 'demo' ? 'Simulated in demo mode. Live: sent by the notify-whatsapp server function to the admin number.' : 'Sent to the admin WhatsApp number by the notify-whatsapp server function.'}</p></section>
        <section class="sec"><div class="sec-h"><h2>Where bookings come from</h2><span class="cap">30 days</span></div><div class="card" style="display:grid;gap:10px">${bySrc.map(([k, n]) => `<div style="display:grid;grid-template-columns:120px 1fr 34px;gap:10px;align-items:center;font-size:15px"><span>${SRC[k]}</span><span style="height:10px;border-radius:5px;background:var(--fill);overflow:hidden"><i style="display:block;height:100%;width:${(n / max) * 100}%;background:var(--accent)"></i></span><b class="num" style="text-align:right">${n}</b></div>`).join('') || '<span class="muted">No bookings yet.</span>'}</div></section>
      </div></div>`;
    refreshAlerts();
    const qi = $('#tq');
    if (qEl) {
      qi.focus();
      qi.setSelectionRange(qi.value.length, qi.value.length);
    }
    qi.oninput = () => {
      T.q = qi.value;
      renderToday();
    };
    $('#export').onclick = () =>
      csv(
        day.sort((a, b) => a.start_time.localeCompare(b.start_time)),
        `bookings-${T.date}.csv`
      );
    setTimeout(() => T.newIds.clear(), 2500);
  }
  document.addEventListener('click', async e => {
    if (page !== 'today' || !CAT) return;
    const d = e.target.closest('[data-day]');
    if (d) {
      T.date = d.dataset.day === '0' ? today() : addDays(T.date, Number(d.dataset.day));
      if (T.date < T.range[0] || T.date > T.range[1]) await loadRange(T.date);
      history.replaceState(null, '', '?date=' + T.date);
      renderToday();
      return;
    }
    const c = e.target.closest('[data-doc]');
    if (c) {
      T.doc = c.dataset.doc;
      renderToday();
      return;
    }
    const s = e.target.closest('[data-st]');
    if (s) {
      T.st = s.dataset.st;
      renderToday();
      return;
    }
    const r = e.target.closest('[data-id]');
    if (r) {
      const b = T.rows.find(x => x.id === r.dataset.id);
      openBooking(b, nb => {
        Object.assign(b, nb);
        renderToday();
      });
    }
  });

  /* ---------- Scan ---------- */
  let scanner = null;
  function scanPage() {
    app.innerHTML = `<h1 class="lt">Scan QR to check in</h1><p class="sub">Point the camera at the QR code on the patient’s phone or booking card.</p>
      <div id="reader"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary" id="start">${icon('camera')}Start camera</button><label class="btn btn-gray">${icon('upload')}Scan from photo<input type="file" accept="image/*" id="file" hidden></label></div>
      <div id="camerr"></div>
      <div class="sec-h" style="margin-top:24px"><span class="cap">Or type the token</span></div>
      <form id="tf" style="display:flex;gap:8px"><div class="list" style="flex:1"><div class="field" style="padding-block:4px"><label for="tok" class="sr">Token</label><input id="tok" placeholder="KH-1128-017" autocapitalize="characters"></div></div><button class="btn btn-soft">Find</button></form>
      <div id="result" style="margin-top:18px"></div>`;
    $('#start').onclick = startCam;
    $('#file').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!window.Html5Qrcode) return camErr('Scanner library did not load. Check the internet connection.');
      try {
        const h = new Html5Qrcode('reader');
        const txt = await h.scanFile(f, false);
        handleCode(txt);
      } catch (err) {
        camErr('No QR code found in that photo. Try again closer and in good light.');
      }
    };
    $('#tf').onsubmit = async e => {
      e.preventDefault();
      const v = $('#tok').value.trim();
      if (!v) return;
      show(await CF_API.bookingByToken(v).catch(() => null), v);
    };
  }
  function camErr(m) {
    $('#camerr').innerHTML = `<div class="alert warn" style="margin-top:12px">${icon('alert')}<div>${esc(m)}</div></div>`;
  }
  async function startCam() {
    $('#camerr').innerHTML = '';
    if (!window.Html5Qrcode) return camErr('Scanner library did not load. Check the internet connection.');
    try {
      scanner = scanner || new Html5Qrcode('reader');
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, txt => {
        scanner.stop().catch(() => {});
        handleCode(txt);
      });
      $('#start').hidden = true;
    } catch (err) {
      camErr('Camera is not available here. Allow camera access, or use “Scan from photo” or type the token.');
    }
  }
  async function handleCode(txt) {
    const m = String(txt)
      .trim()
      .match(/^[A-Z]{2,6}:([0-9a-f-]{36})$/i);
    if (!m) {
      $('#result').innerHTML =
        `<div class="alert err">${icon('alert')}<div>This QR code is not a booking from ${esc(CAT.tenant.config.short_name)}.</div></div>`;
      return;
    }
    show(await CF_API.bookingById(m[1]).catch(() => null), txt);
    if (navigator.vibrate) navigator.vibrate(80);
  }
  function show(b, what) {
    const el = $('#result');
    $('#start').hidden = false;
    if (!b) {
      el.innerHTML = `<div class="alert err">${icon('alert')}<div>No booking found for “${esc(what)}”.</div></div>`;
      return;
    }
    const isToday = b.date === today();
    el.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="tok" style="font-size:16px">${esc(b.token)}</div><div style="font-size:22px;font-weight:700">${esc(b.patient_name)}</div><div class="muted">${dayLabel(b.date)}, ${time12(b.start_time)} · ${esc(docName(b.doctor_id))}</div><div class="muted">${esc(svcName(b.service_id))}</div></div>${pill(b.status)}</div>
      ${!isToday ? `<div class="alert warn" style="margin-top:12px">${icon('alert')}<div>This booking is for ${dayLabel(b.date)}, not today.</div></div>` : ''}
      ${['confirmed', 'requested'].includes(b.status) ? `<button class="btn btn-primary block" id="ci" style="margin-top:14px">${icon('check')}Check in</button>` : ''}</div>`;
    const ci = $('#ci');
    if (ci)
      ci.onclick = async () => {
        ci.disabled = true;
        try {
          await CF_API.setStatus(b.id, 'checked_in');
          toast(`${b.token} checked in`);
          show({ ...b, status: 'checked_in' }, what);
        } catch (err) {
          ci.disabled = false;
          toast(err.message);
        }
      };
  }

  /* ---------- Calendar ---------- */
  async function calendarPage() {
    const from = today(),
      to = addDays(from, 6),
      days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const rows = (await CF_API.listBookings(from, to)).filter(b => b.status !== 'cancelled');
    const cnt = (d, k) => rows.filter(b => b.date === k && (!d || b.doctor_id === d)).length;
    app.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap"><div><h1 class="lt" style="margin-bottom:0">Next 7 days</h1><div class="muted">Bookings per doctor per day (cancelled excluded)</div></div><button class="btn btn-soft sm" id="exp">${icon('download', 'sm')}Export CSV</button></div>
      <div class="tbl-wrap" style="margin-top:16px"><table class="cal"><thead><tr><th>Doctor</th>${days.map(k => `<th>${dayLabel(k)}</th>`).join('')}</tr></thead><tbody>
      ${CAT.doctors
        .map(
          d =>
            `<tr><td><b>${esc(d.name)}</b><div class="muted" style="font-size:13px">${esc(d.role || '')}</div></td>${days
              .map(k => {
                const n = cnt(d.id, k);
                return `<td><a class="${n ? 'has' : ''}" href="today.html?date=${k}">${n || '·'}</a></td>`;
              })
              .join('')}</tr>`
        )
        .join('')}
      <tr><td><b>Total</b></td>${days.map(k => `<td><b>${cnt(null, k)}</b></td>`).join('')}</tr></tbody></table></div>
      <p class="foot">Tap a number to open that day’s list. Export includes every booking (all statuses) for these 7 days.</p>`;
    $('#exp').onclick = async () =>
      csv(
        (await CF_API.listBookings(from, to)).sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
        `bookings-${from}-to-${to}.csv`
      );
  }

  /* ---------- Settings ---------- */
  async function settingsPage() {
    CAT = await CF_API.settings();
    const c = CAT.tenant.config,
      admin = ROLE === 'admin';
    const dis = admin ? '' : 'disabled';
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const avFor = d => {
      const a = CAT.availability.filter(x => x.doctor_id === d.id);
      const days = [...new Set(a.map(x => x.weekday))];
      const sess = [...new Map(a.map(x => [x.start_time + x.end_time, [x.start_time, x.end_time]])).values()].sort();
      return { days, sess, slot: (a[0] || {}).slot_min || 15 };
    };
    app.innerHTML = `<h1 class="lt">Settings</h1>${admin ? '' : `<div class="alert warn">${icon('lock')}<div>Only admins can change settings. You are signed in as reception.</div></div>`}
    <div class="split" style="margin-top:8px"><div>
      <section class="sec" style="margin-top:8px"><div class="sec-h"><h2>Hospital</h2></div><form id="hosp" class="list">
        ${[
          ['phone', 'Phone'],
          ['whatsapp', 'WhatsApp (patients)'],
          ['google_maps_url', 'Google Maps link'],
          ['opd_hours_text', 'OPD hours (English)'],
          ['opd_hours_text_mr', 'OPD hours (Marathi)']
        ]
          .map(([k, l]) => `<div class="field"><label for="h-${k}">${l}</label><input id="h-${k}" name="${k}" value="${esc(c[k] || '')}" ${dis}></div>`)
          .join('')}
        <div class="field"><label for="h-win">Booking window</label><select id="h-win" name="booking_window_days" ${dis}>${[3, 7, 14].map(n => `<option value="${n}" ${c.booking_window_days == n ? 'selected' : ''}>${n} days ahead</option>`).join('')}</select></div>
        <div class="field"><label for="h-ret">Delete bookings after</label><select id="h-ret" name="retention_months" ${dis}>${[6, 12, 24].map(n => `<option value="${n}" ${c.retention_months == n ? 'selected' : ''}>${n} months</option>`).join('')}</select></div>
        <div class="row"><div class="grow"><div class="t1">Confirm bookings automatically</div><div class="t2">Off: new bookings arrive as “Requested” and reception confirms them.</div></div><button type="button" class="toggle" role="switch" id="h-auto" aria-checked="${c.auto_confirm !== false}" aria-label="Confirm automatically" ${dis}></button></div>
        ${admin ? '<div style="padding:12px 16px"><button class="btn btn-primary sm">Save hospital details</button></div>' : ''}</form></section>

      <section class="sec"><div class="sec-h"><h2>Doctors & OPD hours</h2></div>${CAT.doctors
        .map(d => {
          const a = avFor(d);
          return `<form class="card doc-f" data-id="${d.id}" style="margin-bottom:12px;display:grid;gap:10px">
        <div class="grid g2m">${[
          ['name', 'Name'],
          ['name_mr', 'Name (Marathi)'],
          ['role', 'Role'],
          ['qualification', 'Qualification'],
          ['experience_years', 'Years of experience'],
          ['fee_inr', 'Consultation fee (₹)']
        ]
          .map(
            ([k, l]) =>
              `<label style="font-size:13px;font-weight:600;color:var(--text2)">${l}<input name="${k}" value="${esc(d[k] ?? '')}" ${k === 'experience_years' || k === 'fee_inr' ? 'inputmode="numeric"' : ''} style="display:block;width:100%;margin-top:4px;min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 12px;font-size:16px;color:var(--text);font-weight:400" ${dis}></label>`
          )
          .join('')}</div>
        <div><div class="muted" style="font-size:13px;font-weight:600;margin-bottom:6px">OPD days</div><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map(n => `<label class="chip"><input type="checkbox" name="wd" value="${n}" ${a.days.includes(n) ? 'checked' : ''} ${dis}> ${wd[n]}</label>`).join('')}</div></div>
        <div class="grid g2m">${[0, 1].map(i => `<div style="font-size:13px;font-weight:600;color:var(--text2)">Session ${i + 1}${i ? ' (optional)' : ''}<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="time" name="s${i}" value="${(a.sess[i] || [])[0] || ''}" ${dis} style="flex:1;min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 8px;font-size:16px"> – <input type="time" name="e${i}" value="${(a.sess[i] || [])[1] || ''}" ${dis} style="flex:1;min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 8px;font-size:16px"></div></div>`).join('')}</div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label style="font-size:15px">Slot length <select name="slot" ${dis} style="min-height:40px;border-radius:10px;border:1px solid var(--sep);padding:0 8px">${[10, 15, 20, 30].map(n => `<option ${a.slot == n ? 'selected' : ''}>${n}</option>`).join('')}</select> min</label>
        <label style="font-size:15px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="active" ${d.active ? 'checked' : ''} ${dis}> Show on website</label>
        ${admin ? '<button class="btn btn-primary sm" style="margin-left:auto">Save</button>' : ''}</div></form>`;
        })
        .join('')}</section>
    </div><div>
      <section class="sec" style="margin-top:8px"><div class="sec-h"><h2>Leave & holidays</h2></div>
        ${
          admin
            ? `<form id="lv" class="card" style="display:grid;gap:10px"><div class="grid g2m"><label style="font-size:13px;font-weight:600;color:var(--text2)">Date<input type="date" name="date" min="${today()}" required style="display:block;width:100%;min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 10px;font-size:16px;margin-top:4px"></label>
          <label style="font-size:13px;font-weight:600;color:var(--text2)">Who<select name="doctor_id" style="display:block;width:100%;min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 10px;font-size:16px;margin-top:4px"><option value="">Whole OPD closed</option>${CAT.doctors.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label></div>
          <input name="reason" placeholder="Reason (staff only)" style="min-height:44px;border:1px solid var(--sep);border-radius:12px;padding:0 12px;font-size:16px"><button class="btn btn-primary sm">${icon('plus', 'sm')}Add leave</button></form>`
            : ''
        }
        <div class="list" style="margin-top:10px">${
          CAT.leaves
            .filter(l => l.date >= today())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(
              l =>
                `<div class="row"><div class="grow"><div class="t1">${dayLabel(l.date)}</div><div class="t2">${l.doctor_id ? esc(docName(l.doctor_id)) : 'Whole OPD'}${l.reason ? ' · ' + esc(l.reason) : ''}</div></div>${admin ? `<button class="btn btn-danger sm" data-del-leave="${l.id}" aria-label="Remove leave">${icon('trash', 'sm')}</button>` : ''}</div>`
            )
            .join('') || '<p class="muted" style="padding:16px;margin:0">No upcoming leave. Bookings are hidden automatically on leave days.</p>'
        }</div></section>

      <section class="sec"><div class="sec-h"><h2>Services</h2></div><div class="list">${CAT.services
        .map(
          s =>
            `<div class="row"><div class="grow"><div class="t1" style="font-size:16px">${esc(s.name)}</div><div class="t2">${
              s.kind === 'emergency'
                ? 'Emergency · not bookable'
                : s.kind === 'walkin'
                  ? 'Walk-in · not bookable'
                  : 'With ' +
                    esc(
                      CAT.doctor_services
                        .filter(x => x.service_id === s.id)
                        .map(x => docName(x.doctor_id))
                        .join(', ') || 'no doctor'
                    )
            }</div></div><button class="toggle" role="switch" aria-checked="${s.active}" aria-label="Show ${esc(s.name)}" data-svc="${s.id}" ${dis}></button></div>`
        )
        .join('')}</div>
        <p class="foot">Hidden services (switched off) are not shown or bookable. Hip replacement and arthroscopy stay hidden until the hospital confirms them.</p></section>

      <section class="sec"><div class="sec-h"><h2>To confirm with the hospital</h2></div><div class="list">${(c.to_confirm || []).map(x => `<div class="row"><span class="ico" style="background:var(--warn-soft);color:var(--warn-ink)">${icon('info', 'sm')}</span><div class="grow t1" style="font-size:15px">${esc(x)}</div></div>`).join('')}</div></section>
      ${CF_API.mode === 'demo' ? `<section class="sec"><div class="list"><button class="row" id="reset"><div class="grow t1" style="color:var(--danger-ink)">Reset demo data</div></button></div><p class="foot">Restores the Kadam seed data and sample bookings on this device.</p></section>` : ''}
    </div></div>`;
    if (!admin) return;
    $('#h-auto').onclick = e => e.currentTarget.setAttribute('aria-checked', e.currentTarget.getAttribute('aria-checked') !== 'true');
    $('#hosp').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const o = {};
      for (const [k, v] of f) o[k] = ['booking_window_days', 'retention_months'].includes(k) ? Number(v) : v.trim() || null;
      o.auto_confirm = $('#h-auto').getAttribute('aria-checked') === 'true';
      await CF_API.saveTenantConfig(o);
      toast('Hospital details saved');
    };
    $$('.doc-f').forEach(
      form =>
        (form.onsubmit = async e => {
          e.preventDefault();
          const f = new FormData(form),
            id = form.dataset.id;
          const num = v => (v === '' ? null : Number(v));
          const d = {
            id,
            name: f.get('name').trim(),
            name_mr: f.get('name_mr').trim() || null,
            role: f.get('role').trim() || null,
            qualification: f.get('qualification').trim() || null,
            experience_years: num(f.get('experience_years')),
            fee_inr: num(f.get('fee_inr')),
            active: f.get('active') === 'on'
          };
          const days = f.getAll('wd').map(Number),
            slot = Number(f.get('slot'));
          const sess = [0, 1].map(i => [f.get('s' + i), f.get('e' + i)]).filter(([s, en]) => s && en);
          if (sess.some(([s, en]) => en <= s)) {
            toast('Session end time must be after start time');
            return;
          }
          try {
            await CF_API.saveDoctor(d);
            await CF_API.saveAvailability(
              id,
              days.flatMap(w => sess.map(([s, en]) => ({ weekday: w, start_time: s, end_time: en, slot_min: slot })))
            );
            toast(`${d.name} saved`);
            settingsPage();
          } catch (err) {
            toast(err.message);
          }
        })
    );
    const lv = $('#lv');
    if (lv)
      lv.onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(lv);
        await CF_API.addLeave({ date: f.get('date'), doctor_id: f.get('doctor_id') || null, reason: f.get('reason').trim() || null });
        toast('Leave added');
        settingsPage();
      };
    $$('[data-del-leave]').forEach(
      b =>
        (b.onclick = async () => {
          await CF_API.deleteLeave(b.dataset.delLeave);
          toast('Leave removed');
          settingsPage();
        })
    );
    $$('[data-svc]').forEach(
      b =>
        (b.onclick = async () => {
          const s = CAT.services.find(x => x.id === b.dataset.svc);
          const on = b.getAttribute('aria-checked') !== 'true';
          await CF_API.saveService({ id: s.id, active: on });
          b.setAttribute('aria-checked', on);
          s.active = on;
          toast(`${s.name} ${on ? 'shown' : 'hidden'}`);
        })
    );
    const r = $('#reset');
    if (r)
      r.onclick = () => {
        if (r.dataset.armed) {
          CF_API.resetDemo();
          location.href = 'today.html';
        } else {
          r.dataset.armed = 1;
          r.querySelector('.t1').textContent = 'Tap again to reset all demo data';
        }
      };
  }

  /* ---------- boot ---------- */
  (async () => {
    try {
      if (page === 'login') return login();
      if (!(await guard())) return;
      ({ today: todayPage, scan: scanPage, calendar: calendarPage, settings: settingsPage })[page]();
      if (page !== 'today') setLive(true);
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="alert err" style="margin-top:24px">${icon('alert')}<div>${esc(err.message || 'Could not load')}<div style="margin-top:10px"><button class="btn btn-gray sm" data-reload>Try again</button></div></div></div>`;
    }
  })();
})();
