import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper: parseia YYYY-MM-DD sem bug de fuso horário (UTC offset)
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d) // Local time, sem offset UTC
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// GET: Lista lançamentos financeiros com status ATRASADO calculado dinamicamente
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fotografo_id = searchParams.get('fotografo_id')
    const mes = searchParams.get('mes') // formato: YYYY-MM
    const tipo = searchParams.get('tipo') // RECEITA ou DESPESA
    const status = searchParams.get('status')

    if (!fotografo_id) {
      return NextResponse.json({ error: 'fotografo_id é obrigatório' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('financeiro_lancamentos')
      .select('*, financeiro_categorias(nome, icone, cor), financeiro_contas(nome), financeiro_cartoes(nome)')
      .eq('fotografo_id', fotografo_id)
      .order('data_vencimento', { ascending: true })

    if (tipo) query = query.eq('tipo', tipo)
    if (status) query = query.eq('status', status)

    if (mes) {
      const [ano, m] = mes.split('-').map(Number)
      const inicio = toDateStr(new Date(ano, m - 1, 1))
      const fim = toDateStr(new Date(ano, m, 0))
      query = query.gte('data_vencimento', inicio).lte('data_vencimento', fim)
    }

    const { data: lancamentos, error } = await query
    if (error) throw error

    // Calcular status ATRASADO dinamicamente para lançamentos PENDENTE com vencimento passado
    const hoje = toDateStr(new Date())
    const lancamentosComStatus = (lancamentos || []).map(l => {
      if (l.status === 'PENDENTE' && l.data_vencimento < hoje) {
        return { ...l, status: 'ATRASADO' }
      }
      return l
    })

    return NextResponse.json({ lancamentos: lancamentosComStatus })
  } catch (error: any) {
    console.error('Erro ao buscar lançamentos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Cria novo lançamento (despesa ou receita)
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const {
      fotografo_id, categoria_id, tipo: tipoLanc, descricao, valor_previsto, data_vencimento,
      status: statusInicial, observacao,
      natureza, recorrente, recorrencia_meses, recorrente_ate,
      conta_id, cartao_id, forma_pagamento, total_parcelas
    } = payload

    if (!fotografo_id || !descricao || !valor_previsto || !data_vencimento) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const tipo = tipoLanc || 'DESPESA'
    const lancamentosToInsert = []
    const grupo_recorrencia = crypto.randomUUID()

    // ========================================================================
    // LÓGICA 1: PAGAMENTO NO CARTÃO DE CRÉDITO (Parcelado ou à vista)
    // ========================================================================
    if (forma_pagamento === 'CREDITO' && cartao_id) {
      const { data: cartao } = await supabaseAdmin
        .from('financeiro_cartoes').select('*').eq('id', cartao_id).single()
      if (!cartao) return NextResponse.json({ error: 'Cartão não encontrado' }, { status: 404 })

      const dtCompra = parseDate(data_vencimento)
      const diaCompra = dtCompra.getDate()
      const totalP = Number(total_parcelas) || 1
      const valorTotal = Number(valor_previsto)
      const valorBase = Math.floor((valorTotal / totalP) * 100) / 100
      const valorUltima = Math.round((valorTotal - valorBase * (totalP - 1)) * 100) / 100

      for (let p = 1; p <= totalP; p++) {
        // Se comprou antes/no dia do fechamento → cai na fatura do mês seguinte
        // Se comprou depois → cai na fatura daqui a 2 meses
        const mesesPulo = diaCompra <= cartao.dia_fechamento ? 1 : 2
        const dataFatura = new Date(dtCompra.getFullYear(), dtCompra.getMonth() + mesesPulo + (p - 1), cartao.dia_vencimento)

        lancamentosToInsert.push({
          fotografo_id,
          categoria_id: categoria_id || null,
          tipo: 'DESPESA',
          natureza: 'VARIAVEL',
          descricao: totalP > 1 ? `${descricao} (${p}/${totalP})` : descricao,
          valor_previsto: p === totalP ? valorUltima : valorBase, // Última parcela absorve arredondamento
          data_vencimento: toDateStr(dataFatura),
          status: 'PENDENTE',
          observacao: observacao || null,
          conta_id: null,
          cartao_id,
          forma_pagamento,
          parcela_atual: p,
          total_parcelas: totalP,
          grupo_recorrencia
        })
      }
    }
    // ========================================================================
    // LÓGICA 2: RECORRENTE OU PONTUAL (OUTROS MEIOS DE PAGAMENTO)
    // ========================================================================
    else {
      const isRecorrente = recorrente && recorrencia_meses > 0 && recorrente_ate
      let currentDate = parseDate(data_vencimento)
      const endDate = isRecorrente ? parseDate(recorrente_ate) : parseDate(data_vencimento)

      do {
        const dataVencimentoStr = toDateStr(currentDate)
        const isPrimeiro = dataVencimentoStr === data_vencimento
        const isPago = statusInicial === 'PAGO' && isPrimeiro

        lancamentosToInsert.push({
          fotografo_id,
          categoria_id: categoria_id || null,
          tipo,
          natureza: natureza || 'VARIAVEL',
          descricao,
          valor_previsto: Number(valor_previsto),
          data_vencimento: dataVencimentoStr,
          status: isPago ? 'PAGO' : 'PENDENTE',
          observacao: observacao || null,
          recorrente: isRecorrente,
          recorrencia_meses: isRecorrente ? Number(recorrencia_meses) : null,
          recorrente_ate: isRecorrente ? recorrente_ate : null,
          grupo_recorrencia: isRecorrente ? grupo_recorrencia : null,
          conta_id: conta_id || null,
          cartao_id: null,
          forma_pagamento: forma_pagamento || 'OUTROS',
          ...(isPago ? {
            valor_realizado: Number(valor_previsto),
            data_pagamento: dataVencimentoStr
          } : {})
        })

        if (isRecorrente) {
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + Number(recorrencia_meses), currentDate.getDate())
        } else break

      } while (isRecorrente && currentDate <= endDate)
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_lancamentos')
      .insert(lancamentosToInsert)
      .select()

    if (error) throw error

    return NextResponse.json({ lancamentos: data })
  } catch (error: any) {
    console.error('Erro ao criar lançamento(s):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Atualiza lançamento (edição ou dar baixa)
export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, ...updates } = payload

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    // Se estiver marcando como PAGO e não tiver valor_realizado, usar valor_previsto
    if (updates.status === 'PAGO' && !updates.valor_realizado) {
      const { data: lancAtual } = await supabaseAdmin
        .from('financeiro_lancamentos').select('valor_previsto').eq('id', id).single()
      if (lancAtual) updates.valor_realizado = updates.valor_realizado || lancAtual.valor_previsto
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_lancamentos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ lancamento: data })
  } catch (error: any) {
    console.error('Erro ao atualizar lançamento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: Remove lançamento
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('financeiro_lancamentos')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Este lançamento possui registros vinculados e não pode ser excluído.' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao excluir lançamento:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
