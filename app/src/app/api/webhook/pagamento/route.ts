import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente com service role para bypassar RLS nos webhooks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * RF11 — Webhook de confirmação de pagamento
 * Recebe eventos dos gateways (Stripe / Asaas) e atualiza o status
 *
 * Stripe:  POST /api/webhook/pagamento?gateway=stripe
 * Asaas:   POST /api/webhook/pagamento?gateway=asaas
 */
export async function POST(request: NextRequest) {
  const gateway = request.nextUrl.searchParams.get('gateway') ?? 'stripe'
  const payload = await request.json()

  try {
    if (gateway === 'stripe') {
      await handleStripe(payload)
    } else if (gateway === 'asaas') {
      await handleAsaas(payload)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[Webhook] Erro:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ============================================================
// Handler Stripe
// ============================================================
async function handleStripe(payload: Record<string, unknown>) {
  const event = payload as { type: string; data: { object: Record<string, unknown> } }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    await confirmarPagamento({
      gateway_charge_id: pi.id as string,
      gateway: 'stripe',
      webhook_payload: payload,
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    await supabaseAdmin
      .from('pagamentos')
      .update({ status: 'falhou', webhook_payload: payload, webhook_recebido_em: new Date().toISOString() })
      .eq('gateway_charge_id', pi.id as string)
  }
}

// ============================================================
// Handler Asaas
// ============================================================
async function handleAsaas(payload: Record<string, unknown>) {
  const event = payload as { event: string; payment: Record<string, unknown> }

  if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
    const pagamento = event.payment
    await confirmarPagamento({
      gateway_charge_id: pagamento.id as string,
      gateway: 'asaas',
      webhook_payload: payload,
    })
  }

  if (event.event === 'PAYMENT_OVERDUE') {
    const pagamento = event.payment
    await supabaseAdmin
      .from('pagamentos')
      .update({ status: 'falhou', webhook_payload: payload, webhook_recebido_em: new Date().toISOString() })
      .eq('gateway_charge_id', pagamento.id as string)
  }
}

// ============================================================
// Atualiza o pagamento e dispara ações pós-confirmação
// ============================================================
async function confirmarPagamento({
  gateway_charge_id,
  gateway,
  webhook_payload,
}: {
  gateway_charge_id: string
  gateway: string
  webhook_payload: Record<string, unknown>
}) {
  const agora = new Date().toISOString()

  // 1. Marca o pagamento como pago
  const { data: pagamento } = await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'pago',
      pago_em: agora,
      webhook_recebido_em: agora,
      webhook_payload,
    })
    .eq('gateway_charge_id', gateway_charge_id)
    .select()
    .single()

  if (!pagamento) return

  // 2. Se for o sinal, atualiza o status do lead para "confirmado"
  if (pagamento.tipo_cobranca === 'sinal') {
    await supabaseAdmin
      .from('leads_propostas')
      .update({ status: 'confirmado', data_aprovacao: agora })
      .eq('id', pagamento.lead_id)

    // 3. Muda as sessões de "reserva_temporaria" para "confirmada"
    await supabaseAdmin
      .from('sessoes_agenda')
      .update({ status: 'confirmada' })
      .eq('lead_id', pagamento.lead_id)
      .eq('status', 'reserva_temporaria')
  }

  // Se for complemento (fotos extras), marca a sessão como em_edicao
  if (pagamento.tipo_cobranca === 'complemento' && pagamento.sessao_id) {
    const selecionadas = await supabaseAdmin
      .from('midias_galeria')
      .select('id')
      .eq('sessao_id', pagamento.sessao_id)
      .eq('selecionada', true)
      .then(res => res.data?.length ?? 0)

    await supabaseAdmin
      .from('sessoes_agenda')
      .update({ 
        status: 'em_edicao', 
        fotos_selecionadas: selecionadas 
      })
      .eq('id', pagamento.sessao_id)
  }
}
