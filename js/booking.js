/* Patient pages: index (home), book (3 steps), confirm (token + QR), my-booking (lookup / cancel). */
(function () {
  const { icon, esc, $, $$, nowLocal, toMin, addDays, weekday, time12, toast, sheet, closeSheet, telHref, waHref, mapsHref } = UI;
  const t = I18N.t, pick = I18N.pick;
  const page = document.body.dataset.page;
  const app = $('#app');
  const CAT_ICON = ['siren', 'bone', 'spine', 'baby', 'activity'];
  let CAT = null;
  const cfg = () => CAT.tenant.config;

  /* ---------- shared ---------- */
  function top(back) {
    const name = pick(cfg(), 'short_name');
    $('#top').innerHTML = `<div class="wrap">${back ? `<button class="back" id="back">${icon('chevL')}<span>${t('back')}</span></button>` : `<a class="mono" href="index.html" aria-label="${esc(name)}">${esc(name[0])}</a>`}
      <div class="top-title">${esc(name)}</div>
      <div class="lang" role="group" aria-label="Language"><button data-lang="en" aria-pressed="${I18N.lang === 'en'}">EN</button><button data-lang="mr" aria-pressed="${I18N.lang === 'mr'}" lang="mr">मराठी</button></div></div>`;
  }
  document.addEventListener('click', e => {
    const l = e.target.closest('[data-lang]');
    if (l) { I18N.set(l.dataset.lang); render(); }
  });
  const catOf = s => CAT.categories.findIndex(c => c.id === s.category_id);
  const docsFor = sid => CAT.doctors.filter(d => CAT.doctor_services.some(x => x.doctor_id === d.id && x.service_id === sid));
  function slotsFor(did, k) {
    if (CAT.leaves.some(l => l.date === k && (!l.doctor_id || l.doctor_id === did))) return [];
    const now = nowLocal(cfg().timezone), wd = weekday(k), out = [];
    CAT.availability.filter(a => a.doctor_id === did && a.weekday === wd).forEach(a => {
      for (let m = toMin(a.start_time); m + a.slot_min <= toMin(a.end_time); m += a.slot_min) {
        if (k === now.date && m <= now.min) continue;
        out.push(UI.fromMin(m));
      }
    });
    return out.sort();
  }
  function opdOpenNow() {
    const now = nowLocal(cfg().timezone), wd = weekday(now.date);
    return CAT.availability.some(a => a.weekday === wd && now.min >= toMin(a.start_time) && now.min < toMin(a.end_time));
  }
  const dateName = k => { const n = nowLocal(cfg().timezone).date; return k === n ? t('today') : k === addDays(n, 1) ? t('tomorrow') : I18N.dateLabel(k); };
  const avatar = d => d.photo_url ? `<img class="avatar" src="${esc(d.photo_url)}" alt="">` : `<div class="avatar ph" aria-hidden="true">${icon('user')}</div>`;
  const docMeta = d => [d.qualification, d.experience_years ? t('yrs', { n: d.experience_years }) : ''].filter(Boolean).join(' · ');
  const feeText = d => d.fee_inr ? t('fee', { fee: d.fee_inr }) : t('fee_at_hospital');
  const footer = () => UI.demoFooter();

  function load() {
    app.innerHTML = `<p class="muted" style="padding:40px 0;text-align:center">${t('loading')}</p>`;
    CF_API.getCatalog().then(c => { CAT = c; document.title = `${pick(c.tenant.config, 'short_name')} · ${document.title.split('·').pop().trim()}`; if (page === 'book') initBook(); render(); })
      .catch(err => { console.error(err); app.innerHTML = `<div class="alert err" style="margin-top:24px">${icon('alert')}<div>${esc(t('offline'))}<div style="margin-top:10px"><button class="btn btn-gray sm" data-reload>${t('retry')}</button></div></div></div>`; });
  }
  function render() {
    if (!CAT) return;
    ({ home: renderHome, book: renderBook, confirm: renderConfirm, lookup: renderLookup })[page]();
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const c = cfg(); top(false);
    const svcCount = id => CAT.services.filter(s => s.category_id === id).length;
    app.innerHTML = `
    <section class="hero">
      ${c.hero_url ? `<img src="${esc(c.hero_url)}" alt="" style="width:100%;aspect-ratio:16/8;object-fit:cover">` : `<div class="ph">${icon('hospital')}<span>${t('photo_soon')}</span></div>`}
      <div class="hero-body">
        <h1>${esc(CAT.tenant.name)}</h1>
        <p>${esc(pick(c, 'tagline'))}</p>
        <div class="badges"><span class="badge red"><span class="dot"></span>${t('open24')}</span><span class="badge ${opdOpenNow() ? 'green' : 'blue'}">${icon('clock', 'sm')}${t(opdOpenNow() ? 'opd_today_open' : 'opd_today_closed')}</span></div>
      </div>
    </section>
    <div class="actions4">
      <a class="btn btn-primary" href="book.html">${icon('calendar')}${t('book')}</a>
      <a class="tile" href="${telHref(c.phone)}">${icon('phone')}${t('call')}</a>
      <a class="tile" href="${waHref(c.whatsapp, 'Hello, I would like to book an appointment.')}" target="_blank" rel="noopener">${icon('chat')}${t('whatsapp')}</a>
      <a class="tile" href="${mapsHref(c)}" target="_blank" rel="noopener">${icon('nav')}${t('directions')}</a>
    </div>
    <a class="emerg" href="${telHref(c.phone)}">${icon('siren', 'lg')}<div><b>${t('emergency_title')}</b><span>${esc(t('emergency_text', { phone: c.phone }))}</span></div></a>
    <section class="sec"><div class="sec-h"><h2>${t('services')}</h2></div>
      <div class="grid g2 g3">${CAT.categories.map((k, i) => `<a class="catcard" href="book.html?cat=${k.id}"><span class="ico">${icon(CAT_ICON[i] || 'stethoscope')}</span><b>${esc(pick(k))}</b><span>${t('services_count', { n: I18N.digits(svcCount(k.id)) })}</span></a>`).join('')}</div>
    </section>
    <section class="sec"><div class="sec-h"><h2>${t('doctors')}</h2></div>
      <div class="grid g2m">${CAT.doctors.map(d => `<div class="card"><div class="doc">${avatar(d)}<div style="min-width:0"><b style="font-size:18px">${esc(pick(d))}</b><div class="muted" style="font-size:15px">${esc(pick(d, 'role'))}</div>${docMeta(d) ? `<div class="muted" style="font-size:14px">${esc(docMeta(d))}</div>` : ''}</div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap"><span class="muted" style="font-size:14px">${esc(feeText(d))}</span><a class="btn btn-soft sm" href="book.html?doctor=${d.id}">${t('book')}</a></div></div>`).join('')}</div>
    </section>
    <section class="sec"><div class="sec-h"><h2>${t('facilities')}</h2></div>
      <div class="chips">${(c.facilities || []).map(f => `<span class="chip">${icon(f.icon === 'clock' ? 'clock' : f.icon === 'accessibility' ? 'accessibility' : f.icon === 'car' ? 'car' : f.icon === 'scan' ? 'scan' : 'activity')}${esc(I18N.lang === 'mr' ? f.mr : f.en)}</span>`).join('')}</div>
    </section>
    <section class="sec"><div class="sec-h"><h2>${t('visit_us')}</h2></div>
      <div class="list">
        <div class="row ic"><span class="ico">${icon('clock')}</span><div class="grow"><div class="t2">${t('opd_hours')}</div><div class="t1">${esc(pick(c, 'opd_hours_text'))}</div></div></div>
        <a class="row ic" href="${mapsHref(c)}" target="_blank" rel="noopener" style="color:inherit"><span class="ico">${icon('pin')}</span><div class="grow"><div class="t2">${t('address')}</div><div class="t1" style="font-size:16px">${esc(c.address)}</div></div><span class="end">${icon('chevR')}</span></a>
        <a class="row ic" href="${telHref(c.phone)}" style="color:inherit"><span class="ico">${icon('phone')}</span><div class="grow"><div class="t2">${t('call')}</div><div class="t1 num">${esc(c.phone)}</div></div><span class="end">${icon('chevR')}</span></a>
      </div>
    </section>
    <section class="sec"><div class="list"><a class="row ic" href="my-booking.html" style="color:inherit"><span class="ico">${icon('ticket')}</span><div class="grow"><div class="t1">${t('my_booking')}</div><div class="t2">${t('my_booking_sub')}</div></div><span class="end">${icon('chevR')}</span></a></div></section>
    ${footer()}`;
    $('#bar').innerHTML = `<div class="wrap"><span class="hint">${t('book_hint')}</span><a class="btn btn-primary" href="book.html">${icon('calendar')}${t('book')}</a></div>`;
    $('#bar').hidden = false;
  }

  /* ---------- Book (3 steps) ---------- */
  const S = { step: 1, cat: 'all', q: '', sid: null, did: null, date: null, time: null, taken: [], busy: false, error: '',
    f: { name: '', mobile: '', age: '', gender: '', note: '', consent: false }, errs: {} };
  function initBook() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('cat') && CAT.categories.some(c => c.id === qs.get('cat'))) S.cat = qs.get('cat');
    if (qs.get('doctor') && CAT.doctors.some(d => d.id === qs.get('doctor'))) S.lockDoc = qs.get('doctor');
    history.replaceState({ step: 1 }, '');
    window.addEventListener('popstate', e => { S.step = (e.state && e.state.step) || 1; render(); window.scrollTo(0, 0); });
  }
  function go(step) { S.step = step; history.pushState({ step }, ''); render(); window.scrollTo(0, 0); }
  async function loadTaken() {
    const n = nowLocal(cfg().timezone).date;
    try { S.taken = await CF_API.getTakenSlots(n, addDays(n, cfg().booking_window_days || 7)); } catch (e) { S.taken = []; }
  }
  const freeSlots = (did, k) => slotsFor(did, k).filter(s => !S.taken.some(x => x.doctor_id === did && x.date === k && x.start_time === s));

  function renderBook() {
    top(S.step > 1 || true);
    $('#back').onclick = () => S.step > 1 ? history.back() : (location.href = 'index.html');
    const bar = $('#bar'); bar.hidden = false;
    const steps = `<div class="steps" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= S.step ? 'on' : ''}"></i>`).join('')}</div><div class="muted" style="font-size:14px;font-weight:600">${t('step', { n: I18N.digits(S.step) })}</div>`;
    if (S.step === 1) {
      let list = CAT.services.filter(s => S.cat === 'all' || s.category_id === S.cat);
      if (S.lockDoc) list = list.filter(s => s.kind !== 'appointment' || docsFor(s.id).some(d => d.id === S.lockDoc));
      const q = S.q.trim().toLowerCase();
      if (q) list = list.filter(s => (s.name + ' ' + (s.name_mr || '')).toLowerCase().includes(q));
      app.innerHTML = `${steps}<h1 class="lt">${t('step_service')}</h1>
        <div class="hscroll" role="group">${[{ id: 'all', name: t('all') }, ...CAT.categories].map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${S.cat === c.id}">${esc(c.id === 'all' ? c.name : pick(c))}</button>`).join('')}</div>
        <label class="search" style="margin:10px 0 14px">${icon('search', 'sm')}<span class="sr">${t('search_services')}</span><input id="q" type="search" placeholder="${t('search_services')}" value="${esc(S.q)}" autocomplete="off"></label>
        <div class="list">${list.map(s => `<button class="row ic" data-svc="${s.id}"><span class="ico ${s.kind === 'emergency' ? 'red' : s.kind === 'walkin' ? 'green' : ''}">${icon(CAT_ICON[catOf(s)] || 'stethoscope')}</span><div class="grow"><div class="t1">${esc(pick(s))}</div>${s.kind !== 'appointment' ? `<div class="t2">${t(s.kind === 'emergency' ? 'emergency_label' : 'walkin_label')}</div>` : ''}</div><span class="end">${icon('chevR')}</span></button>`).join('') || `<p class="muted" style="padding:20px;text-align:center">—</p>`}</div>
        ${footer()}`;
      bar.innerHTML = `<div class="wrap"><span class="hint">${t('book_hint')}</span></div>`;
      const qi = $('#q'); qi.oninput = () => { S.q = qi.value; const pos = qi.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
      return;
    }
    const svc = CAT.services.find(s => s.id === S.sid), docs = docsFor(S.sid);
    if (S.step === 2) {
      const n = nowLocal(cfg().timezone).date, win = cfg().booking_window_days || 7;
      const days = []; for (let i = 0; i <= win; i++) { const k = addDays(n, i); days.push({ k, all: S.did ? slotsFor(S.did, k).length : 0, free: S.did ? freeSlots(S.did, k).length : 0 }); }
      if (S.did && (!S.date || !days.find(d => d.k === S.date && d.free))) { const f = days.find(d => d.free); S.date = f ? f.k : null; S.time = null; }
      const all = S.did && S.date ? slotsFor(S.did, S.date) : [];
      const free = S.did && S.date ? freeSlots(S.did, S.date) : [];
      const groups = [['morning', 0, 720], ['afternoon', 720, 1020], ['evening', 1020, 1440]];
      app.innerHTML = `${steps}<h1 class="lt">${t('step_slot')}</h1>
        <div class="card summary" style="margin-bottom:18px"><span class="ico">${icon(CAT_ICON[catOf(svc)] || 'stethoscope')}</span><div style="min-width:0"><div class="muted" style="font-size:13px;font-weight:600">${t('service')}</div><b>${esc(pick(svc))}</b></div></div>
        <div class="slot-h" style="margin-top:0">${t('choose_doctor')}</div>
        <div class="list">${docs.map(d => `<button class="row ic" data-doc="${d.id}" aria-pressed="${S.did === d.id}">${avatar(d).replace('class="avatar', 'style="width:40px;height:40px" class="avatar')}<div class="grow"><div class="t1">${esc(pick(d))}</div><div class="t2">${esc(pick(d, 'role'))}</div></div><span class="end" style="color:var(--accent-ink)">${S.did === d.id ? icon('check') : ''}</span></button>`).join('')}</div>
        ${S.did ? `<div class="slot-h">${t('choose_date')}</div>
        <div class="dates" role="group">${days.map(d => `<button class="date" data-date="${d.k}" aria-pressed="${S.date === d.k}" ${d.free ? '' : 'disabled'}><small>${esc(d.k === n ? t('today') : d.k === addDays(n, 1) ? t('tomorrow') : I18N.dateLabel(d.k).split(/[ ,]/)[0])}</small><b>${I18N.digits(Number(d.k.slice(8)))}</b><em>${d.all ? (d.free ? t('free', { n: I18N.digits(d.free) }) : t('full')) : t('closed')}</em></button>`).join('')}</div>
        ${S.date ? groups.map(([g, a, b]) => { const sl = all.filter(s => toMin(s) >= a && toMin(s) < b); return sl.length ? `<div class="slot-h">${t(g)}</div><div class="slots">${sl.map(s => `<button class="slot" data-time="${s}" aria-pressed="${S.time === s}" ${free.includes(s) ? '' : 'disabled'}>${time12(s)}</button>`).join('')}</div>` : ''; }).join('') : `<div class="alert info" style="margin-top:12px">${icon('info')}<div>${t('no_slots')}</div></div>`}` : ''}
        ${footer()}`;
      bar.innerHTML = `<div class="wrap"><span class="hint">${S.time ? esc(dateName(S.date) + ', ' + time12(S.time)) : t('select_time')}</span><button class="btn btn-primary" id="next" ${S.time ? '' : 'disabled'}>${t('continue')}</button></div>`;
      $('#next').onclick = () => go(3);
      return;
    }
    // Step 3 — details
    const doc = CAT.doctors.find(d => d.id === S.did), f = S.f, e = S.errs;
    app.innerHTML = `${steps}<h1 class="lt">${t('step_details')}</h1>
      <div class="card" style="margin-bottom:18px"><div class="summary"><span class="ico">${icon('calendar')}</span><div style="min-width:0"><b>${esc(dateName(S.date))}, ${time12(S.time)}</b><div class="muted" style="font-size:15px">${esc(pick(svc))} · ${esc(pick(doc))}</div></div></div></div>
      ${S.error ? `<div class="alert err" style="margin-bottom:14px" role="alert">${icon('alert')}<div>${esc(I18N.err(S.error))}</div></div>` : ''}
      <form id="form" novalidate>
      <div class="list">
        <div class="field"><label for="f-name">${t('name')}</label><input id="f-name" name="name" autocomplete="name" placeholder="${t('name_ph')}" value="${esc(f.name)}" maxlength="80" required>${e.name ? `<div class="err">${t('err_name')}</div>` : ''}</div>
        <div class="field"><label for="f-mobile">${t('mobile')}</label><input id="f-mobile" name="mobile" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="${t('mobile_ph')}" value="${esc(f.mobile)}" maxlength="14" required>${e.mobile ? `<div class="err">${t('err_mobile')}</div>` : ''}</div>
        <div class="field"><label for="f-age">${t('age')}</label><input id="f-age" name="age" inputmode="numeric" placeholder="${t('age_ph')}" value="${esc(f.age)}" maxlength="3"></div>
        <div class="field"><span class="lbl" id="g-l">${t('gender')}</span><div class="seg" role="group" aria-labelledby="g-l" style="margin:6px 0 4px">${['F', 'M', 'O'].map(g => `<button type="button" data-gender="${g}" aria-pressed="${f.gender === g}">${t(g === 'F' ? 'female' : g === 'M' ? 'male' : 'other')}</button>`).join('')}</div></div>
        <div class="field"><label for="f-note">${t('problem')}</label><textarea id="f-note" name="note" maxlength="120" placeholder="${t('problem_ph')}">${esc(f.note)}</textarea><div class="muted" style="font-size:13px;text-align:right"><span id="cnt">${f.note.length}</span>/120</div></div>
      </div>
      <p class="foot">${t('no_reports')}</p>
      <label class="check" style="margin-top:16px"><input type="checkbox" id="f-consent" ${f.consent ? 'checked' : ''}><span>${esc(t('consent', { hospital: pick(cfg(), 'short_name') }))}${e.consent ? `<span class="err" style="display:block;color:var(--danger-ink);font-size:14px">${t('err_consent')}</span>` : ''}</span></label>
      <p class="foot">${icon('shield', 'sm').replace('class="i sm"', 'class="i sm" style="display:inline;vertical-align:-3px"')} ${esc(t('privacy_note', { months: I18N.digits(cfg().retention_months || 12) }))}</p>
      </form>${footer()}`;
    bar.innerHTML = `<div class="wrap"><button class="btn btn-primary block" id="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? t('booking') : t('confirm_booking')}</button></div>`;
    const form = $('#form');
    form.addEventListener('input', ev => {
      const el = ev.target;
      if (el.id === 'f-consent') f.consent = el.checked;
      else if (el.name) f[el.name] = el.value;
      if (el.name === 'note') $('#cnt').textContent = el.value.length;
    });
    form.addEventListener('submit', ev => { ev.preventDefault(); submit(); });
    $('#submit').onclick = submit;
  }
  async function submit() {
    const f = S.f; f.consent = $('#f-consent').checked;
    const mob = f.mobile.replace(/\D/g, '').slice(-10);
    S.errs = { name: f.name.trim().length < 2, mobile: !/^[6-9]\d{9}$/.test(mob), consent: !f.consent };
    S.error = '';
    if (S.errs.name || S.errs.mobile || S.errs.consent) { render(); const firstErr = S.errs.name ? '#f-name' : S.errs.mobile ? '#f-mobile' : '#f-consent'; $(firstErr).focus(); return; }
    S.busy = true; render();
    try {
      const r = await CF_API.createBooking({ doctor_id: S.did, service_id: S.sid, date: S.date, start_time: S.time, name: f.name, mobile: mob, age: f.age.replace(/\D/g, ''),
        gender: f.gender, note: f.note, consent: f.consent, source: UI.source() });
      try { sessionStorage.setItem('cf-last', JSON.stringify({ token: r.token, mobile: mob, id: r.booking_id, status: r.status })); } catch (e) {}
      location.href = 'confirm.html';
    } catch (err) {
      S.busy = false;
      if (/just taken|not available|passed|leave/i.test(err.message)) { await loadTaken(); S.time = null; S.step = 2; history.replaceState({ step: 2 }, ''); toast(I18N.err(err.message)); render(); window.scrollTo(0, 0); }
      else { S.error = err.message; render(); window.scrollTo(0, 0); }
    }
  }
  document.addEventListener('click', async e => {
    if (page !== 'book' || !CAT) return;
    const c = e.target.closest('[data-cat]'); if (c) { S.cat = c.dataset.cat; render(); return; }
    const s = e.target.closest('[data-svc]');
    if (s) {
      const svc = CAT.services.find(x => x.id === s.dataset.svc);
      if (svc.kind !== 'appointment' || !svc.bookable) {
        const c2 = cfg();
        sheet(`<h2 style="margin:4px 0 6px">${esc(pick(svc))}</h2><p class="muted">${t(svc.kind === 'emergency' ? 'emergency_sheet' : 'walkin_sheet')}</p>
          <div class="grid" style="margin-top:14px"><a class="btn ${svc.kind === 'emergency' ? 'btn-primary' : 'btn-soft'} block" href="${telHref(c2.phone)}">${icon('phone')}${t('call')} ${esc(c2.phone)}</a><a class="btn btn-gray block" href="${mapsHref(c2)}" target="_blank" rel="noopener">${icon('nav')}${t('directions')}</a><button class="btn btn-gray block" data-close>${t('back')}</button></div>`);
        return;
      }
      S.sid = svc.id; const docs = docsFor(svc.id);
      S.did = S.lockDoc && docs.some(d => d.id === S.lockDoc) ? S.lockDoc : docs.length === 1 ? docs[0].id : null;
      S.date = null; S.time = null; await loadTaken(); go(2); return;
    }
    const d = e.target.closest('[data-doc]'); if (d) { S.did = d.dataset.doc; S.date = null; S.time = null; render(); return; }
    const dt = e.target.closest('[data-date]'); if (dt && !dt.disabled) { S.date = dt.dataset.date; S.time = null; render(); return; }
    const tm = e.target.closest('[data-time]'); if (tm && !tm.disabled) { S.time = tm.dataset.time; render(); $('#next') && $('#next').scrollIntoView({ block: 'nearest' }); return; }
    const g = e.target.closest('[data-gender]'); if (g) { S.f.gender = g.dataset.gender; $$('[data-gender]').forEach(b => b.setAttribute('aria-pressed', b === g)); }
  });

  /* ---------- Confirmation ---------- */
  let last = null; try { last = JSON.parse(sessionStorage.getItem('cf-last') || 'null'); } catch (e) {}
  async function renderConfirm() {
    top(false); $('#bar').hidden = true;
    if (!last) { app.innerHTML = `<div class="alert warn" style="margin-top:24px">${icon('info')}<div>${t('no_last')}</div></div><div class="grid" style="margin-top:16px"><a class="btn btn-primary block" href="my-booking.html">${t('my_booking')}</a><a class="btn btn-gray block" href="index.html">${t('home')}</a></div>${footer()}`; return; }
    const b = await CF_API.getBooking(last.token, last.mobile).catch(() => null);
    if (!b) { app.innerHTML = `<div class="alert err" style="margin-top:24px">${icon('alert')}<div>${t('not_found')}</div></div>${footer()}`; return; }
    const c = cfg(), svcName = I18N.lang === 'mr' && b.service_name_mr ? b.service_name_mr : b.service_name;
    const doc = CAT.doctors.find(d => d.name === b.doctor_name); const docName = doc ? pick(doc) : b.doctor_name;
    const qrData = `${c.token_prefix || 'CF'}:${b.id}`;
    const qr = window.qrcode ? (() => { const q = qrcode(0, 'M'); q.addData(qrData); q.make(); return q; })() : null;
    const shareText = t('share_text', { hospital: c.short_name, token: b.token, date: dateName(b.date), time: time12(b.start_time), service: svcName, doctor: docName, address: c.address.split(',').slice(0, 3).join(',') });
    const requested = b.status === 'requested';
    app.innerHTML = `<div style="text-align:center"><div class="tick">${icon('check')}</div>
      <h1 class="lt" style="margin-top:6px">${t(requested ? 'requested_title' : 'booked_title')}</h1>${requested ? `<p class="sub">${t('requested_sub')}</p>` : ''}</div>
      <div class="card" style="text-align:center"><div class="muted" style="font-size:14px;font-weight:600">${t('your_token')}</div><div class="token">${esc(b.token)}</div>
        <div class="qr" aria-label="QR code for booking ${esc(b.token)}">${qr ? qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) : ''}</div><div class="muted" style="font-size:14px">${t('show_qr')}</div></div>
      <div class="list" style="margin-top:14px">
        <div class="kv"><span>${t('date')}</span><b>${esc(dateName(b.date))} · ${esc(I18N.dateLabel(b.date))}</b></div>
        <div class="kv"><span>${t('time')}</span><b>${time12(b.start_time)}</b></div>
        <div class="kv"><span>${t('doctor')}</span><b>${esc(docName)}</b></div>
        <div class="kv"><span>${t('service')}</span><b>${esc(svcName)}</b></div>
        <div class="kv"><span>${t('status')}</span><b><span class="st st-${b.status}">${t('st_' + b.status)}</span></b></div>
      </div>
      <div class="alert info" style="margin-top:14px">${icon('info')}<div>${t('arrive_early')}</div></div>
      <div class="grid" style="margin-top:16px">
        <a class="btn btn-green block" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">${icon('chat')}${t('share_wa')}</a>
        <button class="btn btn-soft block" id="save">${icon('download')}${t('save_card')}</button>
        <a class="btn btn-gray block" href="${mapsHref(c)}" target="_blank" rel="noopener">${icon('nav')}${t('get_directions')}</a>
        <a class="btn btn-gray block" href="index.html">${t('home')}</a>
      </div>${footer()}`;
    $('#save').onclick = () => saveCard(b, qr, { svcName, docName });
  }
  function saveCard(b, qr, { svcName, docName }) {
    const c = cfg(), W = 900, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), F = '"Noto Sans Devanagari",-apple-system,Roboto,sans-serif';
    x.fillStyle = '#F2F2F7'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 36); x.fill();
    x.fillStyle = '#0062CC'; x.font = `700 40px ${F}`; x.textAlign = 'center'; x.fillText(c.short_name, W / 2, 130);
    x.fillStyle = '#6C6C70'; x.font = `500 28px ${F}`; x.fillText(t('your_token'), W / 2, 210);
    x.fillStyle = '#1C1C1E'; x.font = `800 84px ${F}`; x.fillText(b.token, W / 2, 300);
    if (qr) { const n = qr.getModuleCount(), cell = Math.floor(420 / (n + 4)); x.save(); x.translate((W - cell * (n + 4)) / 2, 350); x.fillStyle = '#fff'; x.fillRect(0, 0, cell * (n + 4), cell * (n + 4)); x.translate(cell * 2, cell * 2); qr.renderTo2dContext(x, cell); x.restore(); }
    x.fillStyle = '#1C1C1E'; x.font = `700 38px ${F}`; x.fillText(`${dateName(b.date)} · ${I18N.dateLabel(b.date)} · ${time12(b.start_time)}`, W / 2, 860);
    x.font = `500 32px ${F}`; x.fillStyle = '#3A3A3C'; x.fillText(svcName.slice(0, 44), W / 2, 920); x.fillText(docName, W / 2, 970);
    x.fillStyle = '#6C6C70'; x.font = `400 26px ${F}`; c.address.match(/.{1,52}(\s|$)/g).slice(0, 3).forEach((l, i) => x.fillText(l.trim(), W / 2, 1060 + i * 36));
    x.fillText(c.phone, W / 2, 1180); x.font = `500 24px ${F}`; x.fillText(t('arrive_early').split('.')[0] + '.', W / 2, 1240);
    cv.toBlob(async blob => {
      const file = new File([blob], `${b.token}.png`, { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: b.token }); return; } } catch (e) { if (e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); toast(t('saved_card'));
    }, 'image/png');
  }

  /* ---------- My booking ---------- */
  const L = { mobile: last ? last.mobile : '', token: new URLSearchParams(location.search).get('token') || (last ? last.token : ''), result: null, err: '', armed: false, busy: false };
  function renderLookup() {
    top(false); $('#bar').hidden = true;
    const r = L.result;
    app.innerHTML = `<h1 class="lt">${t('my_booking')}</h1><p class="sub">${t('lookup_sub')}</p>
      <form id="lk" novalidate><div class="list">
        <div class="field"><label for="l-mobile">${t('mobile')}</label><input id="l-mobile" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="${t('mobile_ph')}" value="${esc(L.mobile)}" maxlength="14"></div>
        <div class="field"><label for="l-token">${t('token_label')}</label><input id="l-token" autocapitalize="characters" placeholder="${t('token_ph')}" value="${esc(L.token)}" maxlength="20"></div>
      </div><button class="btn btn-primary block" style="margin-top:14px" ${L.busy ? 'disabled' : ''}>${icon('search')}${t('find')}</button></form>
      ${L.err ? `<div class="alert err" style="margin-top:14px" role="alert">${icon('alert')}<div>${esc(L.err)}</div></div>` : ''}
      ${r ? `<div class="list" style="margin-top:18px">
        <div class="kv"><span>${t('token_label')}</span><b class="num">${esc(r.token)}</b></div>
        <div class="kv"><span>${t('status')}</span><b><span class="st st-${r.status}">${t('st_' + r.status)}</span></b></div>
        <div class="kv"><span>${t('date')}</span><b>${esc(dateName(r.date))}, ${time12(r.start_time)}</b></div>
        <div class="kv"><span>${t('doctor')}</span><b>${esc(r.doctor_name)}</b></div>
        <div class="kv"><span>${t('service')}</span><b>${esc(I18N.lang === 'mr' && r.service_name_mr ? r.service_name_mr : r.service_name)}</b></div>
      </div>${['requested', 'confirmed'].includes(r.status) ? `<button class="btn btn-danger block" id="cancel" style="margin-top:14px">${t(L.armed ? 'cancel_confirm' : 'cancel_booking')}</button>` : ''}` : ''}
      <a class="btn btn-gray block" href="book.html" style="margin-top:14px">${t('book_another')}</a>${footer()}`;
    $('#lk').onsubmit = async e => {
      e.preventDefault(); L.mobile = $('#l-mobile').value; L.token = $('#l-token').value; L.err = ''; L.result = null; L.armed = false;
      if (!/^[6-9]\d{9}$/.test(L.mobile.replace(/\D/g, '').slice(-10))) { L.err = t('err_mobile'); return render(); }
      L.busy = true; render();
      try { L.result = await CF_API.getBooking(L.token, L.mobile); if (!L.result) L.err = t('not_found'); } catch (err) { L.err = I18N.err(err.message); }
      L.busy = false; render();
    };
    const cb = $('#cancel');
    if (cb) cb.onclick = async () => {
      if (!L.armed) { L.armed = true; return render(); }
      try { await CF_API.cancelBooking(L.token, L.mobile); L.result = await CF_API.getBooking(L.token, L.mobile); L.armed = false; toast(t('cancelled_ok')); }
      catch (err) { L.err = I18N.err(err.message); }
      render();
    };
  }

  load();
})();
