const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Não podemos rodar query arbitrária via supabase-js na information_schema.
// Vamos tentar inserir um dado e pegar a mensagem de erro para ver qual coluna falhou.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
  const { error } = await supabase.from('financeiro_lancamentos').insert([{
    fotografo_id: '15ec9df9-f570-4dec-ad03-4e5c53ec1335',
    descricao: 'Teste',
    valor_previsto: 100,
    data_vencimento: '2026-06-22',
    tipo: 'DESPESA',
    natureza: 'VARIAVEL'
  }]);
  console.log('Error 1:', error?.message);

  const { error: e2 } = await supabase.from('financeiro_lancamentos').insert([{
    fotografo_id: '15ec9df9-f570-4dec-ad03-4e5c53ec1335',
    descricao: 'Teste2',
    valor_previsto: 100,
    data_vencimento: '2026-06-22'
  }]);
  console.log('Error 2:', e2?.message);
}
checkColumns();
