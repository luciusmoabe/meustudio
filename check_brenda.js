import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'app/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('leads_propostas')
    .select('id, nome_cliente, status, etapa_pipeline_id')
    .ilike('nome_cliente', '%Brenda%');
    
  console.log(JSON.stringify(data, null, 2));
}
run();
