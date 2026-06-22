const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seed() {
  console.log("Seeding database...");

  // 1. Garante que o usuário de teste exista no Supabase Auth
  let testUser = null;
  const testEmail = 'luciusmoabe@gmail.com';
  const testPassword = 'Lmdm@3798';
  
  const { data: { users }, error: errUsers } = await supabase.auth.admin.listUsers();
  if (errUsers) {
    console.error("Erro listando usuários:", errUsers);
    return;
  }
  
  testUser = users.find(u => u.email === testEmail);
  
  if (!testUser) {
    console.log("Criando usuário de teste no Auth...");
    const { data: { user }, error: errUser } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });
    if (errUser) {
      console.error("Erro criando usuário:", errUser);
      return;
    }
    testUser = user;
  }
  
  console.log(`Usando Auth User ID: ${testUser.id}`);

  // 2. Garante que exista um Perfil Base para este usuário
  let { data: perfil, error: errPerfilFetch } = await supabase.from('perfil_fotografo')
    .select('*')
    .eq('user_id', testUser.id)
    .maybeSingle();

  let fotografo_id = perfil?.id;

  if (!fotografo_id) {
    console.log("Criando perfil base de estúdio...");
    const { data: newPerfil, error: errPerfil } = await supabase.from('perfil_fotografo').insert({
      user_id: testUser.id,
      nome_comercial: 'MeuStudio Fotografia',
      cpf_cnpj: '00000000000100',
      whatsapp: '11999999999',
      email_comercial: testEmail,
      chave_pix: 'test@meustudio.com'
    }).select().single();
    
    if (errPerfil) {
      console.error("Erro criando perfil:", errPerfil);
      return;
    }
    fotografo_id = newPerfil.id;
  }

  console.log(`Usando Fotografo ID: ${fotografo_id}`);

  // 2. Etapas Padrão de Vendas
  console.log("Checando etapas de vendas...");
  const { data: etapasVendas } = await supabase.from('etapas_pipeline')
    .select('*')
    .eq('fotografo_id', fotografo_id)
    .eq('tipo_pipeline', 'vendas');

  let etapasVendasMap = {};
  if (!etapasVendas || etapasVendas.length === 0) {
    const etapasNovas = [
      { nome_etapa: 'Novo Lead', ordem: 1, cor_hex: '#60a5fa', fotografo_id, tipo_pipeline: 'vendas' },
      { nome_etapa: 'Reunião Agendada', ordem: 2, cor_hex: '#fbbf24', fotografo_id, tipo_pipeline: 'vendas' },
      { nome_etapa: 'Proposta Enviada', ordem: 3, cor_hex: '#a78bfa', fotografo_id, tipo_pipeline: 'vendas' },
    ];
    const { data: e, error } = await supabase.from('etapas_pipeline').insert(etapasNovas).select();
    e?.forEach(x => etapasVendasMap[x.ordem] = x.id);
  } else {
    etapasVendas.forEach(x => etapasVendasMap[x.ordem] = x.id);
  }

  // 3. Etapas Padrão de Produção
  console.log("Checando etapas de produção...");
  const { data: etapasProducao } = await supabase.from('etapas_pipeline')
    .select('*')
    .eq('fotografo_id', fotografo_id)
    .eq('tipo_pipeline', 'producao');

  let etapasProducaoMap = {};
  if (!etapasProducao || etapasProducao.length === 0) {
    const etapasNovas = [
      { nome_etapa: 'Agendado / A Fotografar', ordem: 1, cor_hex: '#34d399', fotografo_id, tipo_pipeline: 'producao' },
      { nome_etapa: 'Curadoria', ordem: 2, cor_hex: '#fbbf24', fotografo_id, tipo_pipeline: 'producao' },
      { nome_etapa: 'Edição (Lightroom)', ordem: 3, cor_hex: '#60a5fa', fotografo_id, tipo_pipeline: 'producao' },
    ];
    const { data: e } = await supabase.from('etapas_pipeline').insert(etapasNovas).select();
    e?.forEach(x => etapasProducaoMap[x.ordem] = x.id);
  } else {
    etapasProducao.forEach(x => etapasProducaoMap[x.ordem] = x.id);
  }

  // 3.5 Injetar Modelo de Contrato Padrão
  let { data: contratos } = await supabase.from('modelos_contrato').select('*').limit(1);
  let contrato_id = contratos?.[0]?.id;
  if (!contrato_id) {
    const { data: newC } = await supabase.from('modelos_contrato').insert({
      fotografo_id,
      titulo_modelo: 'Contrato Padrão',
      texto_html: '<p>Contrato de Prestação de Serviços</p>'
    }).select().single();
    contrato_id = newC?.id;
  }

  // 4. Injetar Leads (CRM)
  console.log("Injetando Leads de Teste...");
  const leads = [
    {
      fotografo_id,
      nome_cliente: 'Ana Beatriz Souza',
      email_cliente: 'ana.beatriz@teste.com',
      whatsapp_cliente: '11988887777',
      tipo_servico: 'casamento',
      valor_estimado: 4500,
      status: 'novo',
      etapa_pipeline_id: etapasVendasMap[1] || Object.values(etapasVendasMap)[0]
    },
    {
      fotografo_id,
      nome_cliente: 'Carlos Mendes',
      email_cliente: 'carlos@teste.com',
      whatsapp_cliente: '11977776666',
      tipo_servico: 'ensaio_externo',
      valor_estimado: 850,
      status: 'em_negociacao',
      etapa_pipeline_id: etapasVendasMap[2] || Object.values(etapasVendasMap)[0]
    },
    {
      fotografo_id,
      nome_cliente: 'Fernanda e Lucas',
      email_cliente: 'fernanda@teste.com',
      whatsapp_cliente: '11966665555',
      tipo_servico: 'casamento',
      valor_estimado: 6000,
      status: 'aprovado',
      data_aprovacao: new Date().toISOString(),
      etapa_pipeline_id: etapasVendasMap[3] || Object.values(etapasVendasMap)[0],
      modelo_contrato_id: contrato_id
    }
  ];

  const { data: insertedLeads, error: errorLeads } = await supabase.from('leads_propostas').insert(leads).select();
  if (errorLeads) {
    console.error("Erro inserindo leads:", errorLeads);
    return;
  }

  const leadAprovado = insertedLeads.find(l => l.status === 'aprovado');

  // 5. Injetar Sessões para os aprovados (Agenda)
  if (leadAprovado) {
    console.log("Injetando Sessão de Teste...");
    const hoje = new Date();
    hoje.setHours(14, 0, 0, 0);
    const fim = new Date(hoje.getTime() + 2 * 60 * 60 * 1000); // +2 horas

    const { error: errSessao } = await supabase.from('sessoes_agenda').insert({
      fotografo_id,
      lead_id: leadAprovado.id,
      titulo_sessao: 'Casamento Fernanda e Lucas',
      tipo_sessao: 'casamento',
      data_hora_inicio: hoje.toISOString(),
      data_hora_fim: fim.toISOString(),
      duracao_minutos: 120,
      local_sessao: 'Igreja Matriz',
      limite_fotos: 50,
      status: 'confirmada',
      etapa_producao_id: etapasProducaoMap[1] || Object.values(etapasProducaoMap)[0]
    });

    if (errSessao) console.error("Erro inserindo sessão:", errSessao);
  }

  console.log("Seed finalizado com sucesso!");
}

seed();
