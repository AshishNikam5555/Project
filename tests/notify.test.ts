// Unit tests for the WhatsApp alert formatter and provider adapter (no network).
// Run: node --experimental-strip-types --test tests/notify.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { eventFor, formatAlert, maskMobile } from "../supabase/functions/notify-whatsapp/format.ts";
import { sendWhatsApp, sendWithRetry } from "../supabase/functions/notify-whatsapp/whatsapp.ts";

const b = { id: "b1", tenant_id: "t1", token: "KH-1128-017", doctor_id: "d1", service_id: "s1", date: "2026-11-28",
  start_time: "10:30:00", status: "confirmed", patient_name: "Priya Sharma", patient_mobile: "9822014210", source: "poster" };

test("alert matches the agreed format and masks the mobile", () => {
  const t = formatAlert("new", b, { tenantShort: "Kadam Hospital", service: "Knee / Joint Pain & Arthritis Care", doctor: "Dr. Kadam", appUrl: "https://demo.example/" });
  assert.equal(t, [
    "🦴 New booking — Kadam Hospital", "Token: KH-1128-017", "Patient: Priya S. (+91 98XXX XX210)",
    "Service: Knee / Joint Pain & Arthritis Care", "Doctor: Dr. Kadam", "Slot: Sat, 28 Nov, 10:30 AM", "Source: QR poster",
    "Open: https://demo.example/admin/today.html"].join("\n"));
  assert.ok(!t.includes("9822014210"));
  assert.equal(maskMobile("+91 98220 14210"), "+91 98XXX XX210");
});

test("only inserts and new cancellations trigger alerts", () => {
  assert.equal(eventFor("INSERT", b, null), "new");
  assert.equal(eventFor("UPDATE", { status: "cancelled" }, { status: "confirmed" }), "cancelled");
  assert.equal(eventFor("UPDATE", { status: "checked_in" }, { status: "confirmed" }), null);
  assert.equal(eventFor("UPDATE", { status: "cancelled" }, { status: "cancelled" }), null);
});

test("CallMeBot: correct URL, only to the registered admin number", async () => {
  let url = "";
  const fetch = (async (u: string) => { url = u; return new Response("Message queued. You will receive it in a few seconds."); }) as unknown as typeof globalThis.fetch;
  const cfg = { provider: "callmebot" as const, adminNumber: "+918668859522", callmebotApiKey: "123456", fetch };
  const r = await sendWhatsApp("+91 86688 59522", { text: "Hi & bye" }, cfg);
  assert.equal(r.status, "sent");
  assert.equal(url, "https://api.callmebot.com/whatsapp.php?phone=%2B918668859522&text=Hi%20%26%20bye&apikey=123456");
  const other = await sendWhatsApp("+919999999999", { text: "x" }, cfg);
  assert.equal(other.status, "skipped");
});

test("Meta Cloud API: sends the approved template with body parameters", async () => {
  let req: { url: string; body: any; auth: string } | null = null;
  const fetch = (async (u: string, o: any) => { req = { url: u, body: JSON.parse(o.body), auth: o.headers.Authorization }; return new Response('{"messages":[{"id":"wamid.1"}]}'); }) as unknown as typeof globalThis.fetch;
  const r = await sendWhatsApp("+918668859522", { text: "x", template: { name: "booking_alert_staff", params: ["New booking", "KH-1128-017"] } },
    { provider: "meta", metaToken: "TOKEN", metaPhoneNumberId: "555", fetch });
  assert.equal(r.status, "sent");
  assert.equal(req!.url, "https://graph.facebook.com/v21.0/555/messages");
  assert.equal(req!.auth, "Bearer TOKEN");
  assert.equal(req!.body.to, "918668859522");
  assert.equal(req!.body.template.name, "booking_alert_staff");
  assert.deepEqual(req!.body.template.components[0].parameters, [{ type: "text", text: "New booking" }, { type: "text", text: "KH-1128-017" }]);
});

test("retries once after a failure, and never throws", async () => {
  let calls = 0;
  const fetch = (async () => { calls++; if (calls === 1) throw new Error("network down"); return new Response("Message queued"); }) as unknown as typeof globalThis.fetch;
  const r = await sendWithRetry("+918668859522", { text: "x" }, { provider: "callmebot", callmebotApiKey: "k", fetch }, 10);
  assert.equal(calls, 2); assert.equal(r.attempts, 2); assert.equal(r.status, "sent");
  const bad = await sendWithRetry("+918668859522", { text: "x" }, { provider: "callmebot", callmebotApiKey: "k", fetch: (async () => new Response("APIKey is invalid", { status: 200 })) as any }, 10);
  assert.equal(bad.status, "failed"); assert.equal(bad.attempts, 2);
});
