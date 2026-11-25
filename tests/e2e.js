// End-to-end test of the DEMO build (no Supabase needed).
// Run: python3 -m http.server 8080 &  then  node tests/e2e.js [http://localhost:8080] [screenshot-dir]
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8080';
const SHOTS = process.argv[3] || null;
const ok = m => console.log('PASS ' + m);
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const errors = [];
  ctx.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text());
  });

  // Staff dashboard open in another tab first, to prove live updates
  const admin = await ctx.newPage();
  admin.on('pageerror', e => errors.push('admin: ' + e.message));
  await admin.goto(BASE + '/admin/login.html');
  await admin.click('button:has-text("Sign in (demo)")');
  await admin.waitForURL(/today\.html/);
  await admin.waitForSelector('.kpis');
  ok('staff demo sign-in → Today dashboard');

  // Home, from the poster QR
  await page.goto(BASE + '/?t=kadam-hospital&src=poster');
  await page.waitForSelector('.hero h1');
  if (!(await page.textContent('.hero h1')).includes('Kadam Hospital')) throw new Error('home title');
  await shot(page, 'p-home');
  await page.click('[data-lang="mr"]');
  if (!(await page.textContent('.actions4 .btn-primary')).includes('अपॉइंटमेंट')) throw new Error('marathi');
  await shot(page, 'p-home-mr');
  await page.click('[data-lang="en"]');
  ok('home renders, Marathi toggle works');

  // Emergency service is not bookable
  await page.goto(BASE + '/book.html');
  await page.click('[data-svc="a0000000-0000-4000-8000-000000000301"]');
  await page.waitForSelector('.sheet:has-text("come directly")');
  await page.click('.sheet [data-close].btn');
  ok('emergency service shows "come directly" instead of booking');

  // Book: Bone, Joint & Spine → Knee pain
  await page.click('[data-cat="a0000000-0000-4000-8000-000000000203"]');
  await page.click('[data-svc="a0000000-0000-4000-8000-000000000310"]');
  await page.waitForSelector('.date[aria-pressed="true"]');
  await page.click('.slot:not([disabled])');
  const chosen = await page.$eval('.slot[aria-pressed="true"]', e => e.textContent);
  await shot(page, 'p-slot');
  await page.click('#next');
  await page.click('#submit'); // empty form → validation
  await page.waitForSelector('.err');
  await page.fill('#f-name', 'Priya Sharma');
  await page.fill('#f-mobile', '98220 14210');
  await page.fill('#f-age', '32');
  await page.click('[data-gender="F"]');
  await page.fill('#f-note', 'Knee pain for 2 weeks');
  await page.check('#f-consent');
  await shot(page, 'p-details');
  await page.click('#submit');
  await page.waitForURL(/confirm\.html/);
  await page.waitForSelector('.token');
  const token = (await page.textContent('.token')).trim();
  if (!/^KH-\d{4}-\d{3}$/.test(token)) throw new Error('token ' + token);
  if (!(await page.$('.qr svg'))) throw new Error('QR not rendered');
  await shot(page, 'p-confirm');
  ok(`booked ${chosen} → token ${token}, QR rendered`);

  // Live update on staff dashboard
  const bk = await page.evaluate(t => CF_API.getBooking(t, '9822014210'), token);
  await admin.goto(BASE + '/admin/today.html?date=' + bk.date);
  await admin.waitForSelector(`text=${token}`);
  await admin.waitForSelector('#alerts .msg');
  if (!(await admin.textContent('#alerts')).includes(token)) throw new Error('alert text');
  ok('booking appears on staff dashboard with WhatsApp alert preview (masked mobile)');
  const masked = await admin.textContent('#alerts .msg');
  if (masked.includes('9822014210') || !masked.includes('98XXX XX210')) throw new Error('mobile not masked: ' + masked);
  ok('admin alert masks the mobile (98XXX XX210)');

  // Realtime: new booking while dashboard is open
  const before = await admin.$$eval('.list .row[data-id]', r => r.length);
  const r2 = await page.evaluate(async d => {
    const cat = await CF_API.getCatalog();
    const taken = await CF_API.getTakenSlots(d, d);
    const av = cat.availability.filter(a => a.doctor_id === 'a0000000-0000-4000-8000-000000000101' && a.weekday === new Date(d + 'T00:00:00').getDay());
    for (const a of av)
      for (let m = UI.toMin(a.start_time); m + 15 <= UI.toMin(a.end_time); m += 15) {
        const s = UI.fromMin(m);
        const n = UI.nowLocal();
        if ((d > n.date || m > n.min) && !taken.some(x => x.start_time === s && x.doctor_id === a.doctor_id))
          return CF_API.createBooking({
            doctor_id: a.doctor_id,
            service_id: 'a0000000-0000-4000-8000-000000000309',
            date: d,
            start_time: s,
            name: 'Rahul Patil',
            mobile: '9876500011',
            consent: true,
            source: 'whatsapp'
          });
      }
  }, bk.date);
  await admin.waitForFunction(n => document.querySelectorAll('.list .row[data-id]').length > n, before);
  await shot(admin, 'a-today');
  ok(`new booking ${r2.token} appeared live without refresh`);

  // Double booking blocked
  const dbl = await page.evaluate(async b => {
    try {
      await CF_API.createBooking({
        doctor_id: 'a0000000-0000-4000-8000-000000000101',
        service_id: 'a0000000-0000-4000-8000-000000000309',
        date: b.date,
        start_time: b.start_time,
        name: 'Other',
        mobile: '9876500099',
        consent: true
      });
      return 'booked';
    } catch (e) {
      return e.message;
    }
  }, bk);
  if (!/just taken/.test(dbl)) throw new Error('double booking: ' + dbl);
  ok('same slot cannot be booked twice');

  // Staff: open booking → check in
  await admin.click(`.row:has-text("${token}")`);
  await admin.waitForSelector('.sheet');
  await shot(admin, 'a-sheet');
  await admin.click('.sheet [data-set="checked_in"]');
  await admin.waitForSelector(`.row:has-text("${token}") .st-checked_in`);
  ok('reception checks the patient in from the dashboard');

  // My booking: status visible, cancel the second booking
  await page.goto(BASE + '/my-booking.html');
  await page.fill('#l-mobile', '9876500011');
  await page.fill('#l-token', r2.token);
  await page.click('#lk button');
  await page.waitForSelector('.st-confirmed');
  await page.click('#cancel');
  await page.click('#cancel');
  await page.waitForSelector('.st-cancelled');
  ok('patient looks up and cancels with token + mobile');
  await page.fill('#l-mobile', '9999999999');
  await page.click('#lk button');
  await page.waitForSelector('text=No booking found');
  ok('wrong mobile reveals nothing');

  // Scan page: manual token check-in
  await admin.goto(BASE + '/admin/scan.html');
  await admin.fill('#tok', token);
  await admin.click('#tf button');
  await admin.waitForSelector('#result .tok');
  await shot(admin, 'a-scan');
  ok('scan page finds booking by token');

  // Calendar + settings + leave hides date
  await admin.goto(BASE + '/admin/calendar.html');
  await admin.waitForSelector('table.cal');
  await shot(admin, 'a-calendar');
  ok('7-day calendar renders');
  await admin.goto(BASE + '/admin/settings.html');
  await admin.waitForSelector('#lv');
  const leaveDate = await page.evaluate(() => {
    const n = UI.nowLocal();
    for (let i = 1; i < 8; i++) {
      const k = UI.addDays(n.date, i);
      if (UI.weekday(k) !== 0) return k;
    }
  });
  await admin.fill('#lv input[name="date"]', leaveDate);
  await admin.click('#lv button');
  await admin.waitForSelector('[data-del-leave]');
  await shot(admin, 'a-settings');
  await page.goto(BASE + '/book.html?cat=a0000000-0000-4000-8000-000000000203');
  await page.click('[data-svc="a0000000-0000-4000-8000-000000000309"]');
  await page.waitForSelector('.date');
  const leaveBtn = await page.$(`.date[data-date="${leaveDate}"]`);
  if (!(await leaveBtn.isDisabled())) throw new Error('leave day still bookable');
  ok('whole-OPD leave day is shown as Closed in booking');

  if (errors.length) {
    console.log('ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('ALL E2E TESTS PASSED');
  await browser.close();
})().catch(e => {
  console.error('FAIL', e.message);
  process.exit(1);
});
