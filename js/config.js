/* Deployment settings. The Supabase anon key is public by design — security comes from RLS.
 * Leave SUPABASE_URL empty to run in DEMO mode (everything stays in this browser, nothing is sent anywhere). */
window.CF_CONFIG = {
  SUPABASE_URL: '',          // e.g. 'https://abcd1234.supabase.co'
  SUPABASE_ANON_KEY: '',     // Project Settings → API → anon public key
  TENANT_SLUG: 'kadam-hospital',
  PUBLIC_URL: 'https://kadam-booking.netlify.app'  // your deployed URL; used by the poster QR and WhatsApp links
};
