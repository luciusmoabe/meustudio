import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoriasClient from './CategoriasClient'

export const metadata = {
  title: 'Categorias Financeiras | MeuStudio',
  description: 'Personalize suas categorias de receitas e despesas.',
}

export default async function CategoriasPage() {
  const supabase = await createClient()

  // 1. Verificar autenticação
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Buscar Perfil do Fotógrafo
  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id, nome_comercial')
    .eq('user_id', user.id)
    .single()

  if (!perfil) {
    // Se não tem perfil, manda pro onboarding
    redirect('/dashboard')
  }

  return (
    <CategoriasClient fotografoId={perfil.id} />
  )
}
