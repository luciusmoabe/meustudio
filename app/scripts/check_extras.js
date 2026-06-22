const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.from('tipos_sessao').select('valor_foto_extra').limit(1);
  if (error) {
    console.error('ERRO:', error.message);
    process.exit(1);
  }
  console.log('SUCESSO! Banco está atualizado.');
}

check();
