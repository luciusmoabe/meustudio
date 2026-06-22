import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PortalCliente from './PortalCliente'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: lead } = await supabase
    .from('leads_propostas')
    .select('nome_cliente')
    .eq('link_magico_token', token)
    .single()
  return {
    title: lead ? `Portal ${lead.nome_cliente} | MeuStudio` : 'Portal do Cliente',
    description: 'Seu portal exclusivo de acompanhamento e pagamento.',
  }
}

export default async function ClientePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  // Busca o lead pelo token mágico (acesso público — sem auth)
  const { data: lead } = await supabase
    .from('leads_propostas')
    .select(`
      id, nome_cliente, email_cliente, whatsapp_cliente,
      tipo_servico, data_pretendida, status,
      valor_total_contratado, valor_sinal,
      modelo_contrato_id, contrato_html_gerado,
      link_magico_token, link_magico_expira_em,
      fotografo_id
    `)
    .eq('link_magico_token', token)
    .in('status', ['aprovado', 'confirmado'])
    .single()

  if (!lead) return notFound()

  // Busca dados do fotógrafo/estúdio
  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('nome_comercial, chave_pix, whatsapp, cor_primaria, cor_secundaria, logo_url')
    .eq('id', lead.fotografo_id)
    .single()

  // Busca sessões do lead
  const { data: sessoes } = await supabase
    .from('sessoes_agenda')
    .select('id, titulo_sessao, tipo_sessao, data_hora_inicio, local_sessao, status, limite_fotos, fotos_selecionadas, valor_foto_extra')
    .eq('lead_id', lead.id)
    .order('data_hora_inicio')

  // Busca pagamentos existentes
  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('id, tipo_cobranca, valor_bruto, meio_pagamento, status, pago_em, pix_copia_cola, pix_qrcode_url, boleto_url, boleto_linha_digitavel')
    .eq('lead_id', lead.id)
    .order('criado_em')

  // Busca as fotos liberadas (visivel_cliente = true) para a galeria
  const sessaoIds = sessoes?.map(s => s.id) ?? []
  const { data: midias } = sessaoIds.length > 0
    ? await supabase
        .from('midias_galeria')
        .select('id, sessao_id, nome_arquivo, storage_path_watermark, storage_path, selecionada, favorita, visivel_cliente')
        .in('sessao_id', sessaoIds)
        .eq('visivel_cliente', true)
        .order('ordem_exibicao', { ascending: true })
    : { data: [] }

  return (
    <PortalCliente
      lead={lead}
      perfil={perfil ?? { nome_comercial: 'Estúdio', chave_pix: '', whatsapp: '', cor_primaria: '#7c6af7', cor_secundaria: '#a78bfa', logo_url: null }}
      sessoes={sessoes ?? []}
      pagamentos={pagamentos ?? []}
      midiasIniciais={midias ?? []}
      token={token}
    />
  )
}
