const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedTest() {
  const token = crypto.randomBytes(32).toString('hex');

  // 1. Fotografo
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'luciusmoabe@gmail.com');
  if (!user) return console.log('User luciusmoabe not found');

  const { data: perfil } = await supabase.from('perfil_fotografo').select('id').eq('user_id', user.id).single();

  // 2. Lead
  const { data: lead } = await supabase.from('leads_propostas').insert({
    fotografo_id: perfil.id,
    nome_cliente: 'Cliente Teste Galeria',
    email_cliente: 'testegaleria@email.com',
    status: 'confirmado',
    link_magico_token: token,
  }).select().single();

  // 3. Sessao com limite = 2
  const { data: sessao } = await supabase.from('sessoes_agenda').insert({
    lead_id: lead.id,
    fotografo_id: perfil.id,
    titulo_sessao: 'Sessao de Teste Limite',
    data_hora_inicio: new Date().toISOString(),
    status: 'pronta_entrega',
    limite_fotos: 2,
    valor_foto_extra: 30.00
  }).select().single();

  // 4. Midias
  const midias = [];
  for (let i = 1; i <= 4; i++) {
    midias.push({
      sessao_id: sessao.id,
      fotografo_id: perfil.id,
      nome_arquivo: `foto_${i}.jpg`,
      storage_path: 'mock',
      storage_path_watermark: 'mock',
      visivel_cliente: true,
      selecionada: false,
      ordem_exibicao: i
    });
  }
  await supabase.from('midias_galeria').insert(midias);

  console.log(`URL_TESTE=http://localhost:3000/cliente/${token}`);
}

seedTest();
