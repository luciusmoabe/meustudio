import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PagamentosClient from './PagamentosClient'

export const metadata = {
  title: 'Pagamentos | MeuStudio',
  description: 'Gerencie cobranças e gere links de pagamento para seus clientes',
}

export default async function PagamentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard/perfil')

  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select(`
      id, tipo_cobranca, valor_bruto, valor_liquido, meio_pagamento,
      status, pago_em, criado_em, descricao,
      leads_propostas (
        id, nome_cliente, tipo_servico, link_magico_token
      )
    `)
    .eq('fotografo_id', perfil.id)
    .order('criado_em', { ascending: false })

  // Leads SEM link mágico ainda (para gerar)
  const { data: leads } = await supabase
    .from('leads_propostas')
    .select('id, nome_cliente, tipo_servico, status, valor_total_contratado, valor_sinal, link_magico_token')
    .eq('fotografo_id', perfil.id)
    .in('status', ['aprovado', 'confirmado'])
    .order('criado_em', { ascending: false })

  return (
    <PagamentosClient
      fotografoId={perfil.id}
      pagamentosIniciais={(pagamentos ?? []) as any[]}
      leadsIniciais={leads ?? []}
    />
  )
}
