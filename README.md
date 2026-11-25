# Kadam Hospital Online Booking · CareFlow pilot #1

Patients scan a QR code, pick a service, doctor, date and slot, and get a **token number plus their own QR code**. Reception sees bookings arrive **live**, checks patients in by **scanning their QR**, and the admin gets a **WhatsApp alert** for every booking.

It is a static site (HTML, CSS, vanilla JS) on **Supabase** (Postgres, Row Level Security, Realtime, magic-link login, Edge Function). It costs ₹0 on free tiers.

> **Demo:** every page shows _“Demo built by CareFlow — not yet the hospital’s official booking system”_ until the hospital approves.

## Developer tools (installed with `npm install`)

The website loads **no frameworks**: these are development tools only and never ship to patients.

| Tool              | Used for                                                                                | Command                                                          |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Supabase CLI      | link project, push migrations, seed, deploy the WhatsApp function, local stack (Docker) | `npm run db:link`, `db:push`, `db:seed`, `fn:deploy`, `db:start` |
| Netlify CLI       | preview and production deploys                                                          | `npm run deploy:preview`, `npm run deploy`                       |
| Playwright        | end-to-end tests, poster PDF/PNG                                                        | `npm run test:e2e`, `npm run poster`                             |
| ESLint + Prettier | catch mistakes, consistent formatting                                                   | `npm run lint`, `npm run format`                                 |

Quick start on a laptop (Node 22.6+, Python 3):

```bash
npm install
npx playwright install chromium
npm run dev
```

Then open http://localhost:8080. Run `npm test` for lint, alert unit tests and the Postgres security tests (needs local Postgres).

## Two modes

|                | Demo mode (default)                                                        | Live mode                                   |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| Turn on        | leave `SUPABASE_URL` empty in `js/config.js`                               | fill `SUPABASE_URL` + `SUPABASE_ANON_KEY`   |
| Data           | this browser only (localStorage), with sample bookings                     | Supabase Postgres                           |
| Rules          | same rules as the SQL functions (slots, leave, double-booking, rate limit) | enforced in Postgres                        |
| Staff login    | any email (no email sent)                                                  | Supabase magic link, `staff` table only     |
| WhatsApp alert | shown as a preview on the staff dashboard                                  | sent by the `notify-whatsapp` Edge Function |
| Live updates   | across tabs on the same device                                             | Supabase Realtime, any device               |

Use demo mode to pitch today with no accounts. Switch to live mode when the hospital says yes.

## Pages

| Patient (EN / मराठी)                                                          | Staff (`/admin/`)                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `index.html`: home, services, doctors, facilities, emergency banner           | `login.html`: magic-link sign-in                                                                 |
| `book.html`: 3 steps (service, then doctor & slot, then details)              | `today.html`: live list, search, filters, status actions, WhatsApp alert log, source counts, CSV |
| `confirm.html`: token, booking QR, WhatsApp share, save card, directions      | `scan.html`: camera QR scan, scan from photo, or type the token, then check in                   |
| `my-booking.html`: lookup with mobile + token, cancel                         | `calendar.html`: next 7 days per doctor, CSV export                                              |
| `poster.html`: printable A5 QR poster (also `?src=whatsapp/maps/card/status`) | `settings.html`: hospital details, doctors, OPD hours, leave, services, to-confirm list          |

## Go live in 10 steps

1. **Create a Supabase project** (free) at supabase.com, region _Mumbai (ap-south-1)_.
2. **Run the migrations.** In the SQL Editor, run the files in `supabase/migrations/` in order. Or use the CLI: `supabase link` then `supabase db push`.
3. **Load Kadam's data.** Run `npm run seed` (writes `supabase/seed.sql` from `js/seed.js`), then run `supabase/seed.sql`.
   The admin alert number comes from `ADMIN_WHATSAPP` (default `+918668859522`) and is stored in `tenants.private_config`, which patients can never read.
4. **Connect the site.** Copy _Project URL_ and _anon public key_ (Settings → API) into `js/config.js`. Set `PUBLIC_URL` to your site address.
5. **Deploy.** Drag the folder into Netlify (or `netlify deploy --prod`). `netlify.toml` adds security headers and blocks `/supabase`, `/tools` and `/tests`. Vercel and GitHub Pages also work.
6. **Staff logins.**
   - Authentication → URL configuration: set Site URL to your site and add `https://<site>/admin/today.html` as a redirect URL.
   - Authentication → Users → _Invite user_ for each staff email.
   - Then run, in the SQL Editor:
     ```sql
     insert into public.staff (user_id, tenant_id, role)
     select id, 'a0000000-0000-4000-8000-000000000001', 'admin' from auth.users where email = 'owner@example.com';
     ```
     Use `'reception'` for front-desk staff. Reception can change booking status but not settings.
7. **WhatsApp alerts (demo, free, CallMeBot).**
   - On the phone with **+91 86688 59522**: save CallMeBot's number from callmebot.com/blog/free-api-whatsapp-messages, then send it _“I allow callmebot to send me messages”_. You'll receive an API key.
   - Deploy the function and set its secrets:
     ```bash
     supabase functions deploy notify-whatsapp --no-verify-jwt
     ```
     ```bash
     supabase secrets set WHATSAPP_PROVIDER=callmebot ADMIN_WHATSAPP=+918668859522 CALLMEBOT_API_KEY=<key> WEBHOOK_SECRET=<long-random-string> APP_URL=https://<site>
     ```
   - Database → Webhooks → _Create_: table `bookings`, events **Insert** and **Update**, type _Supabase Edge Function_ → `notify-whatsapp`, POST, add the HTTP header `x-webhook-secret: <same string>`.
   - CallMeBot is free for personal use only. It suits the owner-alert demo, not messaging patients or a paid product.
8. **Data retention.** Database → Extensions: enable `pg_cron`, then run:
   ```sql
   select cron.schedule('purge-old-bookings', '30 2 * * *', $$select public.purge_old_bookings()$$);
   ```
9. **Print the poster.**
   ```bash
   npm run poster -- https://<site>
   ```
   This writes `assets/poster-a5.pdf` and `.png`. Add `whatsapp`, `maps`, `card` or `status` after the URL for variants, so each source is counted separately.
10. **Test on a phone** using the checklist below, then show the hospital.

### Production WhatsApp (Meta Cloud API)

You need a business number (not a personal WhatsApp), Meta Business verification, and approved **Utility** templates. Then set:

```bash
supabase secrets set WHATSAPP_PROVIDER=meta META_TOKEN=<token> META_PHONE_NUMBER_ID=<id> META_TEMPLATE_LANG=en
```

No code changes: `whatsapp.ts` is one adapter for both providers. Template `booking_alert_staff`, body:

```
{{1}} — Kadam Hospital
Token: {{2}}
Patient: {{3}}
Service: {{4}}
Doctor: {{5}}
Slot: {{6}}
Source: {{7}}
```

Later templates: `booking_confirmed_patient` (only to patients who consented) and `appointment_reminder`. Utility messages cost about ₹0.12–0.15 each in India; check current rates before quoting.

## Tests

| Command                                 | What it checks                                                                                                                             | Result                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `npm run test:db`                       | Migrations, seed, **27 security/rule tests** on real Postgres, plus a concurrency test (6 simultaneous bookings for one slot → 1 succeeds) | all pass                                               |
| `npm run test:notify`                   | Alert format, mobile masking, CallMeBot URL, Meta template payload, retry once on failure                                                  | 5/5 pass                                               |
| `npm run serve` then `npm run test:e2e` | Full demo flow in a phone-sized browser (see below)                                                                                        | 14/14 pass                                             |
| Lighthouse (mobile)                     | `index.html` / `book.html`                                                                                                                 | Perf 98/99 · A11y 96/100 · Best practices 96 · SEO 100 |

The end-to-end test covers: booking, token, QR, live staff update, masked WhatsApp alert preview, double-booking blocked, check-in, patient lookup and cancel, wrong mobile reveals nothing, token scan, calendar, and leave days closing booking.

`test:db` needs local Postgres binaries (`initdb`, `pg_ctl`). It uses a throwaway database and a small stub of Supabase's `auth` schema and roles (`supabase/tests/_local_supabase_stub.sql`). Never run that stub on Supabase.

**Still to test by hand on real devices:** QR scanning in normal light, magic-link login, a WhatsApp message arriving within ~10 seconds, and Realtime across two phones. These need the live Supabase project.

## Security model

- Patients (`anon`) **cannot read the bookings table at all**. They can only call:
  - `create_booking()`, which validates everything and returns the id, token and status;
  - `get_booking(token, mobile)` and `cancel_booking(token, mobile)`, which return or change one booking;
  - `get_taken_slots()`, which returns times only, with no patient data.
- One active booking per doctor per slot is enforced by a **unique partial index**, so it is race-proof.
- At most 3 bookings per mobile per hour, so spam can't flood the WhatsApp alerts.
- Staff see only rows where `tenant_id` matches their `staff` row. Reception can change only the `status` column. Settings are admin-only. Every booking and status change is written to `audit_log`.
- The booking QR encodes only `KH:<booking uuid>`. Admin alerts mask the patient mobile (`+91 98XXX XX210`). The admin number and the webhook/API keys never appear in frontend code.

## Decisions that differ from the brief (and why)

- **Plain CSS instead of the Tailwind CDN.** The Tailwind play CDN is about 300 KB of JavaScript and needs `unsafe-inline`. Patient pages are now about 29 KB gzipped and run under a strict Content-Security-Policy.
- **QR libraries are served from the site** (`js/vendor/`: qrcode-generator MIT, html5-qrcode Apache-2.0) instead of a CDN. This means fewer connections on slow 3G and no third-party dependency.
- **Darker accent for text** (`#0062CC`). `#0A84FF` on white is 3.6:1, which fails WCAG AA for text. `#0A84FF` is still used for decorative accents.
- **Extra tables and columns:**
  - `doctor_services`: which doctor offers which service.
  - `token_counters`: per-day `KH-MMDD-###` tokens.
  - `notifications`: the WhatsApp send log.
  - `tenants.private_config`: alert numbers patients can't read.
  - `services.kind`: appointment / emergency / walk-in.
- **Emergency, X-ray and lab tests are listed but not bookable.** Emergency says “come directly, call”; X-ray and tests are walk-in.
- **Unconfirmed items are hidden, not shown with “[CONFIRM]”:** hip replacement, arthroscopy, insurance, fees and doctor credentials. The full list is in _Settings → To confirm with the hospital_.
- **i18n:** `js/i18n.js` is the source (it also works when opened from disk). `npm run i18n` exports `i18n/en.json` and `mr.json` for review. **Have hospital staff review the Marathi.**

## Before showing real patients

OPD hours, the chief surgeon's full name, qualification and experience, the physiotherapist's details, fees, the Google Maps link, photos (taken with consent), the retention period, and whether hip replacement, arthroscopy and cashless insurance should be listed. Real photos replace the grey placeholders: set `config.hero_url` and `doctors.photo_url`.

## Running cost

|                                    | Demo / pilot               | First paid hospitals                                                           |
| ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| Hosting (Netlify/Vercel free)      | ₹0                         | ₹0                                                                             |
| Supabase free (500 MB DB, 50k MAU) | ₹0                         | ₹0 → about ₹2,100/month on Pro, only if you outgrow free or need daily backups |
| WhatsApp                           | ₹0 (CallMeBot, owner only) | about ₹0.12–0.15 per utility message via Meta                                  |
| Domain                             | free subdomain             | about ₹800/year                                                                |

Note: free Supabase projects pause after 7 days without activity. Use Pro for a hospital that depends on it.

## Folder map

```
index.html book.html confirm.html my-booking.html poster.html 404.html
admin/        login, today, scan, calendar, settings
css/app.css   design tokens and components (iOS-inspired, 44px targets)
js/config.js  Supabase URL/key, tenant, public URL
js/seed.js    Kadam data (single source for demo + seed.sql)
js/supabase.js data layer: live (Supabase) and demo (browser) backends
js/booking.js patient pages · js/admin.js staff pages · js/i18n.js EN/मराठी · js/ui.js icons and helpers
supabase/migrations  schema, RLS, functions · supabase/seed.sql (generated)
supabase/functions/notify-whatsapp  Edge Function + provider adapter
supabase/tests  Postgres security tests · tests/  e2e + notify unit tests
tools/        seed generator, poster renderer, i18n export
```
