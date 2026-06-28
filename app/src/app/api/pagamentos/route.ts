import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// 1. SCHEMA DE VALIDAÇÃO (ZOD) - Primeira camada de segurança
const paymentSchema = z.object({
  token: z.string().min(10, 'Token inválido.'),
  meio_pagamento: z.enum(['cartao', 'pix', 'boleto']),
  parcelas: z.number().int().min(1).max(12).optional(),
  tipo_cobranca: z.enum(['sinal', 'complemento']).default('sinal'),
  valor_extra: z.number().positive().optional(),
  sessao_id: z.string().uuid().optional(),
})

type PaymentRequest = z.infer<typeof paymentSchema>

// Factory para garantir que as ENV vars sejam avaliadas de forma segura no runtime
const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 2. VALIDAÇÃO DE ENTRADA (Sanitização)
    const validation = paymentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados de entrada inválidos.', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data
    const supabaseAdmin = getSupabaseAdmin()

    // 3. VALIDAÇÃO DA REGRA DE NEGÓCIO (Guard Clauses)
    const lead = await fetchAndValidateLead(supabaseAdmin, data.token)
    if (!lead) {
      return NextResponse.json({ error: 'Acesso negado ou link mágico expirado.' }, { status: 403 })
    }

    if (data.tipo_cobranca === 'sinal') {
      const isAlreadyPaid = await checkExistingDownPayment(supabaseAdmin, lead.id)
      if (isAlreadyPaid) {
        return NextResponse.json({ error: 'O sinal já foi pago para este contrato.' }, { status: 409 })
      }
    }

    const valorCobrado = data.tipo_cobranca === 'sinal' ? (lead.valor_sinal ?? 0) : (data.valor_extra ?? 0)
    if (valorCobrado <= 0) {
      return NextResponse.json({ error: 'Valor da cobrança inválido.' }, { status: 400 })
    }

    // 4. PROCESSAMENTO E PERSISTÊNCIA
    const paymentPayload = await buildPaymentPayload(supabaseAdmin, lead, data, valorCobrado)
    
    const { data: pagamento, error: pgError } = await supabaseAdmin
      .from('pagamentos')
      .insert(paymentPayload)
      .select()
      .single()

    if (pgError) {
      // AppSec: Ocultado o pgError.message do cliente para evitar vazamento do Schema
      console.error('[Payment API Error]: Erro ao inserir pagamento no banco.', pgError.message)
      return NextResponse.json({ error: 'Falha interna ao processar o pagamento.' }, { status: 500 })
    }

    return NextResponse.json({ pagamento }, { status: 201 })

  } catch (err) {
    // AppSec: Prevenção de crash silencioso e vazamento de stacktrace
    console.error('[Payment API Fatal]:', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}


// ============================================================
// FUNÇÕES AUXILIARES (SINGLE RESPONSIBILITY PRINCIPLE)
// ============================================================

async function fetchAndValidateLead(supabase: SupabaseClient, token: string) {
  const { data: lead } = await supabase
    .from('leads_propostas')
    .select('id, fotografo_id, nome_cliente, valor_sinal, status, link_magico_expira_em')
    .eq('link_magico_token', token)
    .in('status', ['aprovado', 'confirmado'])
    .single()

  if (!lead) return null
  
  if (lead.link_magico_expira_em && new Date(lead.link_magico_expira_em) < new Date()) {
    return null
  }

  return lead
}

async function checkExistingDownPayment(supabase: SupabaseClient, leadId: string): Promise<boolean> {
  const { data } = await supabase
    .from('pagamentos')
    .select('id')
    .eq('lead_id', leadId)
    .eq('tipo_cobranca', 'sinal')
    .eq('status', 'pago')
    .single()

  return !!data
}

async function buildPaymentPayload(supabase: SupabaseClient, lead: any, input: PaymentRequest, valor: number) {
  const payload: Record<string, unknown> = {
    lead_id: lead.id,
    fotografo_id: lead.fotografo_id,
    tipo_cobranca: input.tipo_cobranca,
    valor_bruto: valor,
    valor_taxa_gateway: 0,
    meio_pagamento: input.meio_pagamento === 'cartao' ? 'cartao_credito' : input.meio_pagamento,
    status: 'aguardando_compensacao',
    descricao: input.tipo_cobranca === 'sinal' 
      ? `Sinal do contrato — ${lead.nome_cliente}` 
      : `Fotos extras adicionais — Sessão ${input.sessao_id || 'Avulsa'}`,
    sessao_id: input.tipo_cobranca === 'complemento' ? input.sessao_id : null,
  }

  // Strategy Pattern instintivo: No futuro, isso pode ser extraído para classes GatewayPix, GatewayCartao, etc.
  if (input.meio_pagamento === 'pix') {
    const { data: perfil } = await supabase
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

  if (input.meio_pagamento === 'boleto') {
    payload.boleto_linha_digitavel = '34191.09008 63521.051046 10002.201097 1 99690000120000'
    payload.boleto_vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }

  if (input.meio_pagamento === 'cartao' && input.parcelas) {
    payload.cartao_parcelas = input.parcelas
  }

  return payload
}
