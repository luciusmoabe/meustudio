import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const CATEGORIAS_PADRAO = [
  { nome: 'Aluguel / Estúdio', tipo: 'DESPESA', icone: 'building', cor: '#f87171' },
  { nome: 'Equipamentos', tipo: 'DESPESA', icone: 'camera', cor: '#60a5fa' },
  { nome: 'Marketing', tipo: 'DESPESA', icone: 'megaphone', cor: '#a78bfa' },
  { nome: 'Equipe / Assistentes', tipo: 'DESPESA', icone: 'users', cor: '#fbbf24' },
  { nome: 'Impostos', tipo: 'DESPESA', icone: 'receipt', cor: '#fb923c' },
  { nome: 'Software / Assinaturas', tipo: 'DESPESA', icone: 'monitor', cor: '#34d399' },
  { nome: 'Deslocamento', tipo: 'DESPESA', icone: 'car', cor: '#38bdf8' },
  { nome: 'Outros (Despesa)', tipo: 'DESPESA', icone: 'circle', cor: '#94a3b8' },
  { nome: 'Serviços Fotográficos', tipo: 'RECEITA', icone: 'dollar-sign', cor: '#34d399' },
  { nome: 'Fotos Extras', tipo: 'RECEITA', icone: 'image', cor: '#60a5fa' },
  { nome: 'Produtos / Álbuns', tipo: 'RECEITA', icone: 'book', cor: '#a78bfa' },
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fotografo_id = searchParams.get('fotografo_id')

    if (!fotografo_id) {
      return NextResponse.json({ error: 'fotografo_id é obrigatório' }, { status: 400 })
    }

    // Verifica se já existem categorias; se não, cria as padrão
    const { data: existing } = await supabaseAdmin
      .from('financeiro_categorias')
      .select('id')
      .eq('fotografo_id', fotografo_id)
      .limit(1)

    if (!existing || existing.length === 0) {
      const rows = CATEGORIAS_PADRAO.map(c => ({ ...c, fotografo_id }))
      await supabaseAdmin.from('financeiro_categorias').insert(rows)
    }

    const { data: categorias, error } = await supabaseAdmin
      .from('financeiro_categorias')
      .select('*')
      .eq('fotografo_id', fotografo_id)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true })

    if (error) throw error

    return NextResponse.json({ categorias })
  } catch (error: any) {
    console.error('Erro ao buscar categorias:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fotografo_id, nome, tipo, icone, cor } = body

    if (!fotografo_id || !nome || !tipo) {
      return NextResponse.json({ error: 'fotografo_id, nome e tipo são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_categorias')
      .insert([{ fotografo_id, nome, tipo, icone: icone || 'circle', cor: cor || '#94a3b8' }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ categoria: data })
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, nome, tipo, icone, cor } = body

    if (!id || !nome || !tipo) {
      return NextResponse.json({ error: 'id, nome e tipo são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('financeiro_categorias')
      .update({ nome, tipo, icone, cor })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ categoria: data })
  } catch (error: any) {
    console.error('Erro ao atualizar categoria:', error)
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

    // Opcional: verificar se existem lançamentos vinculados (neste caso ON DELETE SET NULL cuidaria, mas para UX podemos impedir)
    const { count, error: countError } = await supabaseAdmin
      .from('financeiro_lancamentos')
      .select('*', { count: 'exact', head: true })
      .eq('categoria_id', id)

    if (countError) throw countError

    if (count && count > 0) {
      return NextResponse.json({ error: 'Não é possível excluir esta categoria pois existem lançamentos vinculados a ela.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('financeiro_categorias')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao deletar categoria:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
