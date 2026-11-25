// One adapter for all WhatsApp providers: switching CallMeBot → Meta Cloud API is a config change, not a code change.

export type WhatsAppConfig = {
  provider: "callmebot" | "meta";
  adminNumber?: string;          // CallMeBot can only message the number that registered the key
  callmebotApiKey?: string;
  metaToken?: string;
  metaPhoneNumberId?: string;
  metaTemplateLang?: string;     // e.g. "en"
  fetch?: typeof fetch;          // injectable for tests
};
export type Message = { text: string; template?: { name: string; params: string[] } };
export type SendResult = { ok: boolean; provider: string; status: "sent" | "failed" | "skipped"; detail: string };

const digits = (p: string) => String(p ?? "").replace(/\D/g, "");

export async function sendWhatsApp(to: string, msg: Message, cfg: WhatsAppConfig): Promise<SendResult> {
  const f = cfg.fetch ?? fetch;
  try {
    if (cfg.provider === "callmebot") {
      if (!cfg.callmebotApiKey) return { ok: false, provider: "callmebot", status: "skipped", detail: "CALLMEBOT_API_KEY not set" };
      if (cfg.adminNumber && digits(to) !== digits(cfg.adminNumber)) {
        return { ok: false, provider: "callmebot", status: "skipped", detail: "CallMeBot can only message the registered admin number" };
      }
      const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${digits(to)}&text=${encodeURIComponent(msg.text)}&apikey=${encodeURIComponent(cfg.callmebotApiKey)}`;
      const res = await f(url, { method: "GET" });
      const body = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
      const ok = res.ok && !/(error|invalid|not allowed|wrong)/i.test(body);
      return { ok, provider: "callmebot", status: ok ? "sent" : "failed", detail: `${res.status} ${body}` };
    }
    if (cfg.provider === "meta") {
      if (!cfg.metaToken || !cfg.metaPhoneNumberId) return { ok: false, provider: "meta", status: "skipped", detail: "META_TOKEN / META_PHONE_NUMBER_ID not set" };
      // Business-initiated messages must use a pre-approved template; plain text works only inside a 24h customer window.
      const body = msg.template
        ? { messaging_product: "whatsapp", to: digits(to), type: "template",
            template: { name: msg.template.name, language: { code: cfg.metaTemplateLang ?? "en" },
              components: [{ type: "body", parameters: msg.template.params.map((t) => ({ type: "text", text: t })) }] } }
        : { messaging_product: "whatsapp", to: digits(to), type: "text", text: { body: msg.text } };
      const res = await f(`https://graph.facebook.com/v21.0/${cfg.metaPhoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = (await res.text()).slice(0, 400);
      return { ok: res.ok, provider: "meta", status: res.ok ? "sent" : "failed", detail: `${res.status} ${text}` };
    }
    return { ok: false, provider: String(cfg.provider), status: "skipped", detail: "Unknown WHATSAPP_PROVIDER" };
  } catch (e) {
    return { ok: false, provider: cfg.provider, status: "failed", detail: String((e as Error)?.message ?? e).slice(0, 400) };
  }
}

/** Send, and retry once after `retryMs` on failure (never throws). */
export async function sendWithRetry(to: string, msg: Message, cfg: WhatsAppConfig, retryMs = 30_000): Promise<SendResult & { attempts: number }> {
  const first = await sendWhatsApp(to, msg, cfg);
  if (first.ok || first.status === "skipped") return { ...first, attempts: 1 };
  await new Promise((r) => setTimeout(r, retryMs));
  return { ...(await sendWhatsApp(to, msg, cfg)), attempts: 2 };
}
