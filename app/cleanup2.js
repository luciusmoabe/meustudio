require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: leads } = await supabase.from('leads_propostas').select('cliente_id').not('cliente_id', 'is', null);
  const validIds = [...new Set(leads.map(l => l.cliente_id))];
  
  if (validIds.length > 0) {
    const { data: del, error: delErr } = await supabase.from('clientes').delete().not('id', 'in', `(${validIds.join(',')})`);
    console.log(delErr ? "Erro: " + delErr.message : 'Clientes fantasmas deletados com sucesso.');
  } else {
    // If NO valid ids, delete all clients
    const { error: delErr } = await supabase.from('clientes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(delErr ? "Erro: " + delErr.message : 'Todos os clientes deletados (nenhum valido).');
  }
}
run();
