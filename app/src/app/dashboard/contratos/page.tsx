import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContratosClient from './ContratosClient'

export const metadata = {
  title: 'Contratos | MeuStudio',
  description: 'Biblioteca de modelos de contrato com variáveis dinâmicas',
}

export default async function ContratosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id, nome_comercial, cpf_cnpj, chave_pix, whatsapp, email_comercial')
    .eq('user_id', user.id)
    .single()

  if (!perfil) {
    return (
      <>
        <div className="topbar"><span className="topbar-title">Contratos</span></div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '16px' }}>Configure o perfil do seu estúdio antes de criar contratos.</p>
            <a href="/dashboard/perfil" className="btn btn-primary">Ir para o Perfil →</a>
          </div>
        </div>
      </>
    )
  }

  const { data: modelos } = await supabase
    .from('modelos_contrato')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .order('criado_em', { ascending: false })

  const { data: tiposSessao } = await supabase
    .from('tipos_sessao')
    .select('*')
    .eq('fotografo_id', perfil.id)
    .order('nome', { ascending: true })

  return (
    <ContratosClient
      fotografoId={perfil.id}
      perfilDados={perfil}
      modelosIniciais={modelos ?? []}
      tiposSessao={tiposSessao ?? []}
    />
  )
}
