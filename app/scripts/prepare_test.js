const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function prepare() {
  const token = 'af6e126d0d12f3a0b75fc787b75ce20bf4fb4eceb5aaddb3b9153ae551a0b400';
  
  const { data: lead } = await supabase.from('leads_propostas').select('id, fotografo_id').eq('link_magico_token', token).single();
  if (!lead) return console.log('Lead não encontrado.');

  const { data: sessoes } = await supabase.from('sessoes_agenda').select('id').eq('lead_id', lead.id);
  if (!sessoes || sessoes.length === 0) return console.log('Sessao não encontrada.');
  const sessaoId = sessoes[0].id;

  // Atualiza a sessão para limite 2, valor extra 25
  await supabase.from('sessoes_agenda').update({ status: 'pronta_entrega', limite_fotos: 2, valor_foto_extra: 25.00 }).eq('id', sessaoId);

  // Zera seleção e garante pelo menos 3 mídias visíveis
  await supabase.from('midias_galeria').update({ selecionada: false, visivel_cliente: true }).eq('sessao_id', sessaoId);
  const { count } = await supabase.from('midias_galeria').select('*', { count: 'exact', head: true }).eq('sessao_id', sessaoId);
  
  if (count < 3) {
    const toInsert = [];
    for(let i = count; i < 3; i++) {
      toInsert.push({
        sessao_id: sessaoId,
        fotografo_id: lead.fotografo_id,
        nome_arquivo: `test_${i}.jpg`,
        storage_path: 'mock',
        storage_path_watermark: 'mock',
        visivel_cliente: true,
        selecionada: false,
        ordem_exibicao: i
      });
    }
    await supabase.from('midias_galeria').insert(toInsert);
  }
  
  console.log('PRONTO');
}
prepare();
