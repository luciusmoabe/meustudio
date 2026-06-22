import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    // Para segurança, uma chave de API secreta poderia ser validada aqui
    // const { searchParams } = new URL(request.url)
    // if (searchParams.get('token') !== process.env.CRON_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const hoje = new Date()
    const tresDiasFrente = new Date()
    tresDiasFrente.setDate(hoje.getDate() + 3)
    const targetDateStr = tresDiasFrente.toISOString().split('T')[0]

    // Busca parcelas que vencem em exatamente 3 dias e ainda estão pendentes
    const { data: parcelasVencendo, error } = await supabaseAdmin
      .from('parcelas')
      .select(`
        id,
        numero_parcela,
        valor,
        data_vencimento,
        clientes ( nome, email, whatsapp ),
        leads_propostas ( link_magico_token )
      `)
      .eq('status', 'pendente')
      .eq('data_vencimento', targetDateStr)
      .is('cobrada_em', null) // Evita cobrar duas vezes

    if (error) throw error

    if (!parcelasVencendo || parcelasVencendo.length === 0) {
      return NextResponse.json({ message: 'Nenhuma parcela vencendo em 3 dias para cobrar hoje.' })
    }

    const cobrancasEnviadas = []

    for (const p of parcelasVencendo) {
      const cliente = p.clientes as any
      const lead = p.leads_propostas as any
      
      const linkPagamento = lead?.link_magico_token 
        ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/cliente/${lead.link_magico_token}`
        : 'Link Indisponível'

      const msg = `Olá ${cliente.nome}! Passando para lembrar que a Parcela ${p.numero_parcela} do seu ensaio no valor de R$ ${p.valor} vence em 3 dias (${p.data_vencimento}). Você pode realizar o pagamento acessando seu portal: ${linkPagamento}`

      // ---------------------------------------------------------
      // MOCK: Envio de WhatsApp / Email
      // Na vida real, aqui chamaríamos a API do Z-API ou SendGrid
      // ---------------------------------------------------------
      console.log(`[CRON] 🚀 Disparando cobrança para ${cliente.whatsapp || cliente.email}:`, msg)
      
      cobrancasEnviadas.push({
        id: p.id,
        cliente: cliente.nome,
        contato: cliente.whatsapp || cliente.email,
        mensagem: msg
      })

      // Atualiza o banco marcando que já avisou
      await supabaseAdmin
        .from('parcelas')
        .update({ cobrada_em: new Date().toISOString() })
        .eq('id', p.id)
    }

    return NextResponse.json({ 
      success: true, 
      cobrados_count: cobrancasEnviadas.length,
      detalhes: cobrancasEnviadas 
    })

  } catch (error: any) {
    console.error('Erro na rotina de cobrança:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
