require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = fs.readFileSync('database/15_refatoracao_okrs.sql', 'utf8');

async function run() {
  const { error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error("Erro via execute_sql:", error);
    console.log("Para resolver, por favor rode o script via SQL Editor no Supabase!");
  } else {
    console.log("Migração de OKRs aplicada com sucesso via execute_sql!");
  }
}
run();
