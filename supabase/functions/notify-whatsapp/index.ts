// Supabase Edge Function: notify-whatsapp
// Triggered by a Database Webhook on public.bookings (INSERT, UPDATE). Sends the admin a WhatsApp alert
// for every new booking and every cancellation, and logs each attempt in public.notifications.
// The booking itself never waits on WhatsApp: webhooks are async and this function replies immediately.
//
// Secrets (supabase secrets set …): WEBHOOK_SECRET, WHATSAPP_PROVIDER=callmebot|meta, ADMIN_WHATSAPP,
//   CALLMEBOT_API_KEY, APP_URL, later META_TOKEN, META_PHONE_NUMBER_ID, META_TEMPLATE_LANG.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { alertParams, type Booking, eventFor, formatAlert } from "./format.ts";
import { sendWithRetry, type WhatsAppConfig } from "./whatsapp.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const waConfig = (): WhatsAppConfig => ({
  provider: (env("WHATSAPP_PROVIDER", "callmebot") as WhatsAppConfig["provider"]),
  adminNumber: env("ADMIN_WHATSAPP"),
  callmebotApiKey: env("CALLMEBOT_API_KEY"),
  metaToken: env("META_TOKEN"),
  metaPhoneNumberId: env("META_PHONE_NUMBER_ID"),
  metaTemplateLang: env("META_TEMPLATE_LANG", "en"),
});
const maskPhone = (p: string) => { const d = p.replace(/\D/g, ""); return d.length >= 10 ? `+${d.slice(0, d.length - 8)}XXX XX${d.slice(-3)}` : "—"; };

async function notify(event: "new" | "cancelled", b: Booking) {
  const [t, d, s] = await Promise.all([
    db.from("tenants").select("name, config, private_config").eq("id", b.tenant_id).single(),
    db.from("doctors").select("name").eq("id", b.doctor_id).single(),
    db.from("services").select("name").eq("id", b.service_id).single(),
  ]);
  if (t.error || !t.data) { console.error("tenant lookup failed", t.error); return; }
  const tenant = t.data as { name: string; config: Record<string, unknown>; private_config: { notify_whatsapp?: string[] } };
  const numbers = (tenant.private_config?.notify_whatsapp?.length ? tenant.private_config.notify_whatsapp : [env("ADMIN_WHATSAPP")]).filter(Boolean);
  const ctx = { tenantShort: String(tenant.config?.short_name ?? tenant.name), service: s.data?.name, doctor: d.data?.name, appUrl: env("APP_URL") };
  const p = alertParams(event, b, ctx);
  const msg = {
    text: formatAlert(event, b, ctx),
    template: { name: "booking_alert_staff", params: [p.heading, p.token, p.patient, p.service, p.doctor, p.slot, p.source] },
  };
  for (const to of numbers) {
    const r = await sendWithRetry(to, msg, waConfig());
    const { error } = await db.from("notifications").insert({
      tenant_id: b.tenant_id, booking_id: b.id, channel: "whatsapp", event, to_masked: maskPhone(to),
      status: r.status, attempts: r.attempts, provider: r.provider, provider_response: r.detail,
    });
    if (error) console.error("notification log failed", error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  let payload: { type: string; table: string; record?: Booking; old_record?: Booking };
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (payload.table !== "bookings" || !payload.record) return Response.json({ skipped: "not a booking" });
  const ev = eventFor(payload.type, payload.record, payload.old_record);
  if (!ev) return Response.json({ skipped: "no alert for this change" });

  const work = notify(ev, payload.record).catch((e) => console.error("notify failed", e));
  // Reply now; keep sending (including the 30 s retry) in the background.
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) { rt.waitUntil(work); return Response.json({ queued: ev }, { status: 202 }); }
  await work;
  return Response.json({ sent: ev });
});
