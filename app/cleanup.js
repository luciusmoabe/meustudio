require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    DELETE FROM clientes
    WHERE id NOT IN (
        SELECT DISTINCT cliente_id 
        FROM leads_propostas 
        WHERE cliente_id IS NOT NULL
    );
  `});
  
  if (error && error.message.includes('function execute_sql')) {
    // se rpc nao existir, faremos via postgrest query
    console.log("No rpc, doing manual delete");
    const { data: leads } = await supabase.from('leads_propostas').select('cliente_id').not('cliente_id', 'is', null);
    const validIds = [...new Set(leads.map(l => l.cliente_id))];
    
    // delete where id not in validIds
    const { data: del, error: delErr } = await supabase.from('clientes').delete().not('id', 'in', `(${validIds.join(',')})`);
    console.log(delErr || 'Clientes fantasmas deletados com sucesso.');
  } else {
    console.log(error || 'Clientes fantasmas deletados via RPC.');
  }
}
run();
