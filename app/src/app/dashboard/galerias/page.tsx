import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GaleriasClient from './GaleriasClient'

export const metadata = {
  title: 'Galerias de Seleção | MeuStudio',
  description: 'Faça upload das fotos e acompanhe a seleção dos seus clientes',
}

export default async function GaleriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard/perfil')

  // Traz as sessões que estão em fase de entrega (fotografadas ou pra frente)
  const { data: sessoes } = await supabase
    .from('sessoes_agenda')
    .select(`
      id, titulo_sessao, status, limite_fotos, fotos_selecionadas,
      leads_propostas (nome_cliente, link_magico_token)
    `)
    .eq('fotografo_id', perfil.id)
    .in('status', ['fotografada', 'em_edicao', 'pronta_entrega', 'entregue'])
    .order('data_hora_inicio', { ascending: false })

  // Traz as fotos de todas essas sessões
  const sessaoIds = sessoes?.map(s => s.id) ?? []
  
  const { data: midias } = sessaoIds.length > 0 
    ? await supabase
        .from('midias_galeria')
        .select('*')
        .in('sessao_id', sessaoIds)
        .order('ordem_exibicao', { ascending: true })
    : { data: [] }

  return (
    <GaleriasClient
      fotografoId={perfil.id}
      sessoesIniciais={(sessoes ?? []) as any[]}
      midiasIniciais={midias ?? []}
    />
  )
}
