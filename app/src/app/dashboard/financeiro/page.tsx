import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanceiroClient from './FinanceiroClient'

export const metadata = {
  title: 'Financeiro | MeuStudio',
  description: 'Fluxo de Caixa, Contas a Pagar/Receber e DRE – Regime de Caixa',
}

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id, nome_comercial')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard')

  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]

  return (
    <FinanceiroClient
      fotografoId={perfil.id}
      nomeStudio={perfil.nome_comercial}
      hojeStr={hojeStr}
    />
  )
}
