import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// `supabase` ist ein globales Objekt aus dem UMD-Script (siehe index.html),
// das vor diesem Modul geladen wird.
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
