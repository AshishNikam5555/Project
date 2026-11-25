// Pure helpers for the admin WhatsApp alert (no Deno/Node APIs → unit-testable anywhere).

export type Booking = {
  id: string;
  tenant_id: string;
  token: string;
  doctor_id: string;
  service_id: string;
  date: string;
  start_time: string;
  status: string;
  patient_name: string;
  patient_mobile: string;
  source: string;
};
export type AlertEvent = 'new' | 'cancelled';

/** Patient mobile, first 2 + last 3 digits: +91 98XXX XX210 */
export function maskMobile(m: string): string {
  const d = String(m ?? '')
    .replace(/\D/g, '')
    .slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}XXX XX${d.slice(7)}` : '—';
}

/** "Priya Sharma" → "Priya S." */
export function shortName(n: string): string {
  const p = String(n ?? '')
    .trim()
    .split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0];
}

const SOURCES: Record<string, string> = {
  poster: 'QR poster',
  whatsapp: 'WhatsApp',
  maps: 'Google Maps',
  card: 'Visiting card',
  status: 'WhatsApp status',
  direct: 'Website',
  staff: 'Reception'
};

export function slotLabel(date: string, time: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return `${day}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function alertParams(ev: AlertEvent, b: Booking, ctx: { service?: string; doctor?: string }) {
  return {
    heading: ev === 'cancelled' ? 'Booking cancelled' : 'New booking',
    token: b.token,
    patient: `${shortName(b.patient_name)} (${maskMobile(b.patient_mobile)})`,
    service: ctx.service ?? '—',
    doctor: ctx.doctor ?? '—',
    slot: slotLabel(b.date, b.start_time),
    source: SOURCES[b.source] ?? b.source
  };
}

export function formatAlert(ev: AlertEvent, b: Booking, ctx: { tenantShort: string; service?: string; doctor?: string; appUrl?: string }): string {
  const p = alertParams(ev, b, ctx);
  return [
    `🦴 ${p.heading} — ${ctx.tenantShort}`,
    `Token: ${p.token}`,
    `Patient: ${p.patient}`,
    `Service: ${p.service}`,
    `Doctor: ${p.doctor}`,
    `Slot: ${p.slot}`,
    `Source: ${p.source}`,
    ...(ctx.appUrl ? [`Open: ${ctx.appUrl.replace(/\/$/, '')}/admin/today.html`] : [])
  ].join('\n');
}

/** Which webhook events produce an alert */
export function eventFor(type: string, rec?: Partial<Booking> | null, old?: Partial<Booking> | null): AlertEvent | null {
  if (type === 'INSERT') return 'new';
  if (type === 'UPDATE' && rec?.status === 'cancelled' && old?.status !== 'cancelled') return 'cancelled';
  return null;
}
