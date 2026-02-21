import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://udqxvsgdgxgtnhxxxcgv.supabase.co';
// Llave Pública (Anon / Publishable) SEGURA para Vercel y Dashboards React
const SB_KEY = 'sb_publishable_gNx13J0yKxHjVDQUjwyOYQ_ul3vrHvb';

export const supabase = createClient(SB_URL, SB_KEY);
