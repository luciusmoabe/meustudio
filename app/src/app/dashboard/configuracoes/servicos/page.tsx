import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ServicosClient from './ServicosClient'

export const metadata = {
  title: 'Tipos de Serviço & Custos | MeuStudio',
  description: 'Gerencie seus pacotes de foto, durações padrão, custos e margens de lucro.',
}

export default async function ServicosConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard/perfil')

  // Busca os tipos de sessão cadastrados com seus respectivos custos vinculados
  const { data: servicos } = await supabase
    .from('tipos_sessao')
    .select(`
      *,
      custos_servico (*)
    `)
    .eq('fotografo_id', perfil.id)
    .order('criado_em', { ascending: true })

  return (
    <ServicosClient
      fotografoId={perfil.id}
      servicosIniciais={servicos ?? []}
    />
  )
}
