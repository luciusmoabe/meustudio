import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendaClient from './AgendaClient'

export const metadata = {
  title: 'Agenda | MeuStudio',
  description: 'Gerencie suas sessões fotográficas e esteira de produção',
}

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id, fuso_horario')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard/perfil')

  // Sessões do próximo e anterior mês
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

  // Leads aprovados/confirmados para vincular sessões
  const { data: leads } = await supabase
    .from('leads_propostas')
    .select('id, nome_cliente, tipo_servico, status')
    .eq('fotografo_id', perfil.id)
    .in('status', ['aprovado', 'confirmado'])
    .order('nome_cliente')

  // Etapas de produção
  const { data: etapasProducao } = await supabase
    .from('etapas_pipeline')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .eq('tipo_pipeline', 'producao')
    .order('ordem')

  // Carrega os tipos de sessão customizados do fotógrafo
  const { data: tiposSessao } = await supabase
    .from('tipos_sessao')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .order('nome', { ascending: true })

  return (
    <AgendaClient
      fotografoId={perfil.id}
      fusoHorario={perfil.fuso_horario ?? 'America/Sao_Paulo'}
      sessoesIniciais={(sessoes ?? []) as any[]}
      leadsDisponiveis={leads ?? []}
      etapasProducaoIniciais={etapasProducao ?? []}
      tiposSessao={tiposSessao ?? []}
    />
  )
}
