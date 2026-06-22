import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key_result_id = searchParams.get('key_result_id')

    if (!key_result_id) {
      return NextResponse.json({ error: 'key_result_id é obrigatório' }, { status: 400 })
    }

    const { data: checkins, error } = await supabaseAdmin
      .from('okr_checkins')
      .select('*')
      .eq('key_result_id', key_result_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ checkins })
  } catch (error: any) {
    console.error('Erro ao buscar checkins:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { key_result_id, fotografo_id, valor_registrado, comentario } = payload

    if (!key_result_id || fotografo_id == null || valor_registrado == null) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data: checkin, error } = await supabaseAdmin
      .from('okr_checkins')
      .insert({
        key_result_id,
        fotografo_id,
        valor_registrado,
        comentario
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ checkin }, { status: 201 })
  } catch (error: any) {
    console.error('Erro ao registrar checkin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, valor_registrado, comentario } = payload

    if (!id || valor_registrado == null) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const { data: checkin, error } = await supabaseAdmin
      .from('okr_checkins')
      .update({ valor_registrado, comentario })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ checkin })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('okr_checkins')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

