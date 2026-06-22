import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// GET: Lista parcelas de contratos do fotógrafo
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fotografo_id = searchParams.get('fotografo_id')

    if (!fotografo_id) {
      return NextResponse.json({ error: 'fotografo_id é obrigatório' }, { status: 400 })
    }

    const { data: parcelas, error } = await supabaseAdmin
      .from('parcelas')
      .select(`*, clientes(nome), leads_propostas(tipo_servico)`)
      .eq('fotografo_id', fotografo_id)
      .order('data_vencimento', { ascending: true })

    if (error) throw error

    return NextResponse.json({ parcelas })
  } catch (error: any) {
    console.error('Erro ao buscar parcelas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Dar baixa em uma parcela (Contas a Receber)
export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, valor_pago, data_pagamento, conta_id, forma_pagamento } = payload

    if (!id) {
      return NextResponse.json({ error: 'ID da parcela é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('parcelas')
      .update({
        status: 'pago',
        cobrada_em: data_pagamento || new Date().toISOString().split('T')[0],
        conta_id: conta_id || null,
        forma_pagamento: forma_pagamento || null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ parcela: data })
  } catch (error: any) {
    console.error('Erro ao dar baixa na parcela:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
