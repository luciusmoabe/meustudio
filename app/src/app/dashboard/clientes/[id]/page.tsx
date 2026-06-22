import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, Mail, AtSign, Briefcase } from 'lucide-react'

export const metadata = {
  title: 'Detalhes do Cliente | MeuStudio',
}

export default async function ClienteDetalhesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard')

  // Busca cliente e histórico (projetos)
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select(`
      *,
      leads_propostas (
        id,
        tipo_servico,
        status,
        valor_total_contratado,
        data_pretendida,
        criado_em
      )
    `)
    .eq('id', id)
    .eq('fotografo_id', perfil.id)
    .single()

  if (error || !cliente) {
    console.error("ERRO DETALHE CLIENTE:", error)
    return (
      <div style={{ padding: '40px' }}>
        <h2>Cliente não encontrado.</h2>
        {error && <pre style={{ color: 'red' }}>{JSON.stringify(error, null, 2)}</pre>}
      </div>
    )
  }

  const formatCurrency = (v: number | null) => 
    v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

  const getStatusColor = (status: string) => {
    if (status === 'aprovado' || status === 'confirmado') return 'var(--color-success)'
    if (status === 'perdido') return 'var(--color-danger)'
    if (status === 'arquivado') return 'var(--color-text-muted)'
    return 'var(--color-info)'
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/clientes" className="btn btn-ghost btn-icon" style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </Link>
          <span className="topbar-title">Perfil do Cliente</span>
        </div>
      </div>

      <div className="page-content animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* INFO DO CLIENTE */}
        <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-accent-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-accent)',
            flexShrink: 0
          }}>
            <User size={32} color="var(--color-accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 12px 0', color: 'var(--color-text-primary)' }}>
              {cliente.nome}
            </h1>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                <Mail size={16} /> {cliente.email || 'Sem e-mail'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                <Phone size={16} /> 
                {cliente.whatsapp ? (
                  <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-success)', textDecoration: 'none', fontWeight: 500 }}>
                    {cliente.whatsapp} (Conversar)
                  </a>
                ) : 'Sem número'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                <AtSign size={16} /> 
                {cliente.instagram ? (
                  <a href={`https://instagram.com/${cliente.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>
                    {cliente.instagram}
                  </a>
                ) : 'Sem Instagram'}
              </div>
            </div>
          </div>
        </div>

        {/* PROJETOS E HISTÓRICO */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Briefcase size={20} color="var(--color-text-primary)" />
            <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Projetos e Contratos</h2>
          </div>

          <div style={{ padding: '24px' }}>
            {cliente.leads_propostas && cliente.leads_propostas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {cliente.leads_propostas.map((projeto: any) => (
                  <div key={projeto.id} style={{ 
                    border: '1px solid var(--color-border)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize' }}>
                          Sessão {projeto.tipo_servico}
                        </h3>
                        <span style={{ 
                          fontSize: '0.65rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 700, textTransform: 'uppercase',
                          background: `color-mix(in srgb, ${getStatusColor(projeto.status)} 15%, transparent)`,
                          color: getStatusColor(projeto.status), border: `1px solid ${getStatusColor(projeto.status)}`
                        }}>
                          {projeto.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        Data base: {projeto.data_pretendida ? new Date(projeto.data_pretendida).toLocaleDateString('pt-BR') : 'A definir'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {formatCurrency(projeto.valor_total_contratado)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>
                Nenhum projeto encontrado para este cliente.
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
