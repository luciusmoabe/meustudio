import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fotografo_id = searchParams.get('fotografo_id')
    const trimestre = searchParams.get('trimestre')

    if (!fotografo_id) {
      return NextResponse.json({ error: 'fotografo_id é obrigatório' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('okr_objectives')
      .select(`
        *, 
        okr_key_results (
          *,
          okr_checkins (count)
        )
      `)
      .eq('fotografo_id', fotografo_id)
      .order('created_at', { ascending: false })

    if (trimestre) {
      query = query.eq('trimestre', trimestre)
    }

    const { data: objetivos, error } = await query

    if (error) throw error

    return NextResponse.json({ objetivos })
  } catch (error: any) {
    console.error('Erro ao buscar OKRs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { type, ...data } = payload

    if (type === 'objective') {
      const { data: obj, error } = await supabaseAdmin
        .from('okr_objectives')
        .insert(data)
        .select()
        .single()
        
      if (error) throw error
      return NextResponse.json({ objective: obj }, { status: 201 })
    } 
    
    if (type === 'key_result') {
      const { data: kr, error } = await supabaseAdmin
        .from('okr_key_results')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ key_result: kr }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tipo inválido. Use "objective" ou "key_result"' }, { status: 400 })
  } catch (error: any) {
    console.error('Erro ao criar OKR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { type, id, ...data } = payload

    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const table = type === 'objective' ? 'okr_objectives' : 'okr_key_results'

    const { data: result, error } = await supabaseAdmin
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ result }, { status: 200 })
  } catch (error: any) {
    console.error('Erro ao atualizar OKR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type) {
      return NextResponse.json({ error: 'id e type são obrigatórios' }, { status: 400 })
    }

    if (type === 'key_result') {
      // 1. Apaga os check-ins vinculados ao KR (Cascata manual)
      await supabaseAdmin.from('okr_checkins').delete().eq('key_result_id', id)
      
      // 2. Apaga o KR
      const { error } = await supabaseAdmin.from('okr_key_results').delete().eq('id', id)
      if (error) throw error
      
    } else if (type === 'objective') {
      // 1. Busca os KRs vinculados ao objetivo
      const { data: krs } = await supabaseAdmin.from('okr_key_results').select('id').eq('objective_id', id)
      
      if (krs && krs.length > 0) {
        const krIds = krs.map(kr => kr.id)
        // 2. Apaga os check-ins de todos esses KRs
        await supabaseAdmin.from('okr_checkins').delete().in('key_result_id', krIds)
        // 3. Apaga os KRs
        await supabaseAdmin.from('okr_key_results').delete().in('id', krIds)
      }
      
      // 4. Apaga o objetivo
      const { error } = await supabaseAdmin.from('okr_objectives').delete().eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao deletar OKR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
