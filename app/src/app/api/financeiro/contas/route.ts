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

    const { data: contas, error } = await supabaseAdmin
      .from('financeiro_contas')
      .select('*')
      .eq('fotografo_id', fotografo_id)
      .order('nome', { ascending: true })

    if (error) throw error
    return NextResponse.json({ contas })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { fotografo_id, nome, tipo, saldo_inicial } = payload

    if (!fotografo_id || !nome || !tipo) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_contas')
      .insert({ fotografo_id, nome, tipo, saldo_inicial: Number(saldo_inicial) || 0 })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conta: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin.from('financeiro_contas').delete().eq('id', id)

    if (error) {
        if (error.code === '23503') return NextResponse.json({ error: 'Esta conta possui lançamentos vinculados e não pode ser excluída.' }, { status: 409 })
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
    const { id, nome, tipo, saldo_inicial } = payload

    if (!id || !nome || !tipo) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_contas')
      .update({ nome, tipo, saldo_inicial: Number(saldo_inicial) || 0 })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conta: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
