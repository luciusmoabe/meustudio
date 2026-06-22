import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fotografo_id = searchParams.get('fotografo_id')

    if (!fotografo_id) return NextResponse.json({ error: 'fotografo_id é obrigatório' }, { status: 400 })

    const { data: cartoes, error } = await supabaseAdmin
      .from('financeiro_cartoes')
      .select('*')
      .eq('fotografo_id', fotografo_id)
      .order('nome', { ascending: true })

    if (error) throw error
    return NextResponse.json({ cartoes })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { fotografo_id, nome, dia_fechamento, dia_vencimento, limite } = payload

    if (!fotografo_id || !nome || !dia_fechamento || !dia_vencimento) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_cartoes')
      .insert({ 
        fotografo_id, 
        nome, 
        dia_fechamento: Number(dia_fechamento), 
        dia_vencimento: Number(dia_vencimento), 
        limite: limite ? Number(limite) : null 
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ cartao: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin.from('financeiro_cartoes').delete().eq('id', id)

    if (error) {
        if (error.code === '23503') return NextResponse.json({ error: 'Este cartão possui lançamentos vinculados e não pode ser excluído.' }, { status: 409 })
        throw error
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, nome, dia_fechamento, dia_vencimento, limite } = payload

    if (!id || !nome || !dia_fechamento || !dia_vencimento) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_cartoes')
      .update({ 
        nome, 
        dia_fechamento: Number(dia_fechamento), 
        dia_vencimento: Number(dia_vencimento), 
        limite: limite ? Number(limite) : null 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ cartao: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
