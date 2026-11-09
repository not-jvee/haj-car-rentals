const SUPABASE_URL = 'https://eqsdhcctnnmptsmckoyl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0Mzt0QdX9ZWteNZsZ-h6GQ_jOPuwL4u';
window.hajSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
