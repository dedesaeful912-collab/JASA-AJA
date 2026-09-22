const SUPABASE_URL = "https://hhmvutunognvlbkeulnf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ElleDxRJT85BHFnS8upOmQ_IkvW6MMr";

const { createClient } = supabase;
window.jasaSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
