import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Try to use service role key if available, otherwise RLS will block us.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!serviceKey) {
  console.log("No service key found. RLS might block queries.");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('leads_propostas')
    .select('*')
    .ilike('nome_cliente', '%Brenda%');
    
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
