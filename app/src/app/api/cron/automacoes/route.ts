import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Bypass RLS para jobs rodando no servidor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// A Vercel Cron aciona este endpoint com GET
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    // Simples proteção, a Vercel injeta CRON_SECRET se configurado
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const logs = []

    // 1. ========================================================
    // FOLLOW-UP DE PROPOSTA (> 3 dias na etapa 'proposta_enviada')
    // ========================================================
    
    // Busca leads cuja data de criação ou atualização os coloca há mais de 3 dias sem aceite.
    // Para simplificar a lógica na POC, vamos pegar leads em "proposta_enviada" atualizados há mais de 3 dias.
    const tresDiasAtras = new Date()
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3)

    const { data: leadsEstagnados } = await supabase
      .from('leads_propostas')
      .select('id, fotografo_id, nome_cliente, whatsapp_cliente')
      .eq('status', 'proposta_enviada')
      .lte('atualizado_em', tresDiasAtras.toISOString())

    if (leadsEstagnados) {
      for (const lead of leadsEstagnados) {
        // Verifica se já não disparamos automação para este lead
        const { data: logExistente } = await supabase
          .from('automacoes_log')
          .select('id')
          .eq('referencia_id', lead.id)
          .eq('tipo_automacao', 'follow_up_proposta')
          .single()

        if (!logExistente) {
          // Aqui faríamos a requisição para Z-API ou Evolution API!
          console.log(`[Automacao] Disparando WhatsApp de Follow-Up para ${lead.nome_cliente} (${lead.whatsapp_cliente})`)
          
          // Registra disparo
          await supabase.from('automacoes_log').insert({
            fotografo_id: lead.fotografo_id,
            tipo_automacao: 'follow_up_proposta',
            referencia_id: lead.id
          })

          logs.push(`Follow-up Lead: ${lead.nome_cliente}`)
        }
      }
    }

    // 2. ========================================================
    // LEMBRETE DE SESSÃO DA AGENDA (próximas 24 horas)
    // ========================================================
    const vinteQuatroHorasFuturo = new Date()
    vinteQuatroHorasFuturo.setHours(vinteQuatroHorasFuturo.getHours() + 24)
    
    // Margem de 1 hora para pegar sessões
    const limiteSuperior = new Date(vinteQuatroHorasFuturo.getTime() + 60 * 60 * 1000)

    const { data: sessoesProximas } = await supabase
      .from('sessoes_agenda')
      .select(`
        id, fotografo_id, titulo_sessao, data_hora_inicio, local_sessao,
        leads_propostas (nome_cliente, whatsapp_cliente)
      `)
      .in('status', ['confirmada', 'reserva_temporaria'])
      .gte('data_hora_inicio', vinteQuatroHorasFuturo.toISOString())
      .lte('data_hora_inicio', limiteSuperior.toISOString())

    if (sessoesProximas) {
      for (const sessao of sessoesProximas) {
        const { data: logExistente } = await supabase
          .from('automacoes_log')
          .select('id')
          .eq('referencia_id', sessao.id)
          .eq('tipo_automacao', 'lembrete_sessao')
          .single()

        if (!logExistente && sessao.leads_propostas) {
          console.log(`[Automacao] Disparando Lembrete de Sessão (${sessao.titulo_sessao}) para ${(sessao.leads_propostas as any).nome_cliente}`)
          
          await supabase.from('automacoes_log').insert({
            fotografo_id: sessao.fotografo_id,
            tipo_automacao: 'lembrete_sessao',
            referencia_id: sessao.id
          })
          
          logs.push(`Lembrete Sessão: ${sessao.titulo_sessao}`)
        }
      }
    }

    return NextResponse.json({ success: true, processed: logs })

  } catch (err) {
    console.error('Erro na CRON de Automação:', err)
    return NextResponse.json({ error: 'Erro ao processar automações' }, { status: 500 })
  }
}
