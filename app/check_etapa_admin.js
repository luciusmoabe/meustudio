import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('etapas_pipeline')
    .select('*')
    .eq('id', '8dade883-544f-4b04-a3eb-806febfca0c7');
    
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
