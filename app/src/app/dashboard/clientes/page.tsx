import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientesClient from './ClientesClient'

export const metadata = {
  title: 'Clientes | MeuStudio',
  description: 'Gestão da sua carteira de clientes',
}

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) return <div>Configure seu perfil primeiro.</div>

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*, leads_propostas(id)')
    .eq('fotografo_id', perfil.id)
    .order('nome', { ascending: true })
    
  if (error) console.error("Erro ao buscar clientes:", error.message)

  return <ClientesClient clientes={clientes || []} />
}
