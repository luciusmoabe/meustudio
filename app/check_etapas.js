import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, count, error } = await supabase
    .from('etapas_pipeline')
    .select('*');
    
  console.log(JSON.stringify(data, null, 2));
}
run();
