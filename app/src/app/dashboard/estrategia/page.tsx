import EstrategiaClient from './EstrategiaClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Estratégia e OKRs | MeuStudio',
  description: 'Acompanhe seus objetivos e metas trimestrais',
}

export default async function EstrategiaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) {
    return <div>Configure seu perfil de fotógrafo primeiro.</div>
  }

  return <EstrategiaClient fotografoId={perfil.id} />
}
