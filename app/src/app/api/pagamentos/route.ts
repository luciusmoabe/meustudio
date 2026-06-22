import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Usa a service_role key para bypassar RLS — acesso seguro apenas server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, meio_pagamento, parcelas, tipo_cobranca = 'sinal', valor_extra, sessao_id } = body

    // 1. Valida o token mágico e busca o lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads_propostas')
      .select('id, fotografo_id, nome_cliente, valor_sinal, status, link_magico_token, link_magico_expira_em')
      .eq('link_magico_token', token)
      .in('status', ['aprovado', 'confirmado'])
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Token inválido ou lead não encontrado.' }, { status: 403 })
    }

    // 2. Verifica expiração do token (se configurada)
    if (lead.link_magico_expira_em && new Date(lead.link_magico_expira_em) < new Date()) {
      return NextResponse.json({ error: 'Link mágico expirado.' }, { status: 403 })
    }

    // 3. Verifica se já tem sinal pago (se for pagamento de sinal)
    if (tipo_cobranca === 'sinal') {
      const { data: pagamentoExistente } = await supabaseAdmin
        .from('pagamentos')
        .select('id, status')
        .eq('lead_id', lead.id)
        .eq('tipo_cobranca', 'sinal')
        .eq('status', 'pago')
        .single()

      if (pagamentoExistente) {
        return NextResponse.json({ error: 'O sinal já foi pago para este contrato.' }, { status: 400 })
      }
    }

    const valorCobrado = tipo_cobranca === 'sinal' ? (lead.valor_sinal ?? 0) : (valor_extra ?? 0)
    if (valorCobrado <= 0) {
      return NextResponse.json({ error: 'Valor da cobrança inválido.' }, { status: 400 })
    }

    // 4. Monta o payload do pagamento
    const payload: Record<string, unknown> = {
      lead_id: lead.id,
      fotografo_id: lead.fotografo_id,
      tipo_cobranca: tipo_cobranca,
      valor_bruto: valorCobrado,
      valor_taxa_gateway: 0,
      meio_pagamento: meio_pagamento === 'cartao' ? 'cartao_credito' : meio_pagamento,
      status: 'aguardando_compensacao',
      descricao: tipo_cobranca === 'sinal' ? `Sinal do contrato — ${lead.nome_cliente}` : `Fotos extras adicionais — Sessão ${sessao_id || 'Avulsa'}`,
      sessao_id: tipo_cobranca === 'complemento' ? sessao_id : null,
    }

    // 5. Simula dados específicos por meio de pagamento
    if (meio_pagamento === 'pix') {
      // Busca chave pix do perfil do fotógrafo
      const { data: perfil } = await supabaseAdmin
        .from('perfil_fotografo')
        .select('chave_pix, nome_comercial')
        .eq('id', lead.fotografo_id)
        .single()

      const chavePix = perfil?.chave_pix || 'chave-pix-do-studio'
      const nomeStudio = (perfil?.nome_comercial || 'Studio').substring(0, 25)
      const pixPayload = `00020126580014br.gov.bcb.pix0136${chavePix}5204000053039865802BR5925${nomeStudio}6009SAO PAULO62070503***6304ABCD`

      payload.pix_copia_cola = pixPayload
      payload.pix_qrcode_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`
      payload.pix_expira_em = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    }

    if (meio_pagamento === 'boleto') {
      payload.boleto_linha_digitavel = '34191.09008 63521.051046 10002.201097 1 99690000120000'
      payload.boleto_vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }

    if (meio_pagamento === 'cartao' && parcelas) {
      payload.cartao_parcelas = parcelas
    }

    // 6. Insere o pagamento como admin (bypassa RLS)
    const { data: pagamento, error: pgError } = await supabaseAdmin
      .from('pagamentos')
      .insert(payload)
      .select()
      .single()

    if (pgError) {
      console.error('Erro ao inserir pagamento:', pgError)
      return NextResponse.json({ error: 'Erro ao criar pagamento: ' + pgError.message }, { status: 500 })
    }

    return NextResponse.json({ pagamento }, { status: 201 })

  } catch (err) {
    console.error('Erro inesperado na API de pagamentos:', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
