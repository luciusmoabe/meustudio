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
    .eq('id', '7c521450-820f-4752-a9da-9c39668f0b83');
    
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
