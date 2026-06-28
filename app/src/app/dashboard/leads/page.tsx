import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeadsClient from './LeadsClient'

export const metadata = {
  title: 'CRM — Leads | MeuStudio',
  description: 'Gerencie seus leads e funil de vendas',
}

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let perfil: { id: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('perfil_fotografo')
      .select('id')
      .eq('user_id', user.id)
      .single()
    perfil = data
  }

  if (!perfil) {
    return (
      <>
        <div className="topbar">
          <span className="topbar-title">CRM — Leads</span>
        </div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '16px' }}>Configure o perfil do seu estúdio antes de usar o CRM.</p>
            <a href="/dashboard/perfil" className="btn btn-primary">Ir para o Perfil →</a>
          </div>
        </div>
      </>
    )
  }

  // Carrega etapas do pipeline de vendas
  const { data: etapas } = await supabase
    .from('etapas_pipeline')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .eq('tipo_pipeline', 'vendas')
    .order('ordem')

  // Carrega leads com etapa atual
  const { data: leads } = await supabase
    .from('leads_propostas')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .order('criado_em', { ascending: false })

  // Carrega os tipos de sessão customizados do fotógrafo com seus formulários e pacotes
  const { data: tiposSessao } = await supabase
    .from('tipos_sessao')
    .select('*, servico_formularios(*), pacote_servicos!pacote_id (id, servico_id, quantidade)')
    .eq('fotografo_id', perfil.id)
    .order('nome', { ascending: true })

  // Etapas de produção
  const { data: etapasProducao } = await supabase
    .from('etapas_pipeline')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .eq('tipo_pipeline', 'producao')
    .is('pacote_id', null)
    .order('ordem')

  // Sessões da agenda para a esteira
  const { data: sessoes } = await supabase
    .from('sessoes_agenda')
    .select(`
      id, titulo_sessao, tipo_sessao, data_hora_inicio, data_hora_fim,
      local_sessao, status, limite_fotos, fotos_selecionadas, etapa_producao_id, valor_foto_extra,
      data_entrada_etapa, criado_em,
      leads_propostas (id, nome_cliente, whatsapp_cliente)
    `)
    .eq('fotografo_id', perfil.id)
    .order('data_hora_inicio')

  return (
    <LeadsClient
      fotografoId={perfil.id}
      etapasIniciais={etapas ?? []}
      leadsIniciais={leads ?? []}
      tiposSessao={tiposSessao ?? []}
      etapasProducaoIniciais={etapasProducao ?? []}
      sessoesIniciais={(sessoes ?? []) as any[]}
    />
  )
}
