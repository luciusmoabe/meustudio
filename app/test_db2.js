const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('tipos_sessao').select('id, pacote_servicos!pacote_servicos_pacote_id_fkey(*)');
  if (error) console.error('Error:', error);
  else console.log('Success! Data count:', data.length);
}
test();
