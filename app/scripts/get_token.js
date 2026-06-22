const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: lead } = await supabase.from('leads_propostas').select('link_magico_token, id').eq('status', 'confirmado').not('link_magico_token', 'is', null).limit(1).single();
  if (!lead) {
    console.log("NO_LEAD_FOUND");
    return;
  }
  
  // Make sure it has a session ready for delivery
  const { data: sessoes } = await supabase.from('sessoes_agenda').select('id').eq('lead_id', lead.id);
  if (sessoes && sessoes.length > 0) {
    await supabase.from('sessoes_agenda').update({ status: 'pronta_entrega', limite_fotos: 2, valor_foto_extra: 30 }).eq('id', sessoes[0].id);
    
    // Create some media if not exists
    const { data: midias } = await supabase.from('midias_galeria').select('id').eq('sessao_id', sessoes[0].id);
    if (!midias || midias.length === 0) {
      await supabase.from('midias_galeria').insert([
        { sessao_id: sessoes[0].id, fotografo_id: (await supabase.from('leads_propostas').select('fotografo_id').eq('id', lead.id).single()).data.fotografo_id, nome_arquivo: 'foto_1.jpg', storage_path: 'mock', selecionada: false, visivel_cliente: true },
        { sessao_id: sessoes[0].id, fotografo_id: (await supabase.from('leads_propostas').select('fotografo_id').eq('id', lead.id).single()).data.fotografo_id, nome_arquivo: 'foto_2.jpg', storage_path: 'mock', selecionada: false, visivel_cliente: true },
        { sessao_id: sessoes[0].id, fotografo_id: (await supabase.from('leads_propostas').select('fotografo_id').eq('id', lead.id).single()).data.fotografo_id, nome_arquivo: 'foto_3.jpg', storage_path: 'mock', selecionada: false, visivel_cliente: true }
      ]);
    } else {
        await supabase.from('midias_galeria').update({ visivel_cliente: true }).eq('sessao_id', sessoes[0].id);
    }
  }

  console.log(`TOKEN=${lead.link_magico_token}`);
}
run();
