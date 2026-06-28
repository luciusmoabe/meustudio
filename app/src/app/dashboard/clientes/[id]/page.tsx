import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, Mail, AtSign, Briefcase, FileText, CalendarHeart, Plus, Calendar } from 'lucide-react'
import EditClienteModal from '../EditClienteModal'
import EventosClienteModal from './EventosClienteModal'

export const metadata = {
  title: 'Detalhes do Cliente | MeuStudio',
}

export default async function ClienteDetalhesPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const searchParamsResolved = await searchParams
  const activeTab = (searchParamsResolved.tab as string) || 'informacoes'
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!perfil) redirect('/dashboard')

  // Busca cliente e histórico (projetos e eventos)
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
      ),
      clientes_eventos (
        id,
        tipo_evento,
        nome_pessoas,
        data_evento,
        observacao,
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

  const formatTipoEvento = (tipo: string) => {
    const tipos: any = {
      aniversario: 'Aniversário',
      aniversario_filho: 'Aniversário (Filho/a)',
      bodas: 'Bodas',
      formatura: 'Formatura',
      outros: 'Outros'
    }
    return tipos[tipo] || tipo
  }

  const eventosOrdenados = [...(cliente.clientes_eventos || [])].sort((a, b) => 
    new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime()
  )

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/clientes" className="btn btn-ghost btn-icon" style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </Link>
          <span className="topbar-title">Perfil do Cliente</span>
        </div>
        <div className="topbar-actions">
          <EditClienteModal cliente={cliente} />
        </div>
      </div>

      <div className="page-content animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* INFO DO CLIENTE HEADER */}
        <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '32px', alignItems: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-accent-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-accent)',
            flexShrink: 0
          }}>
            <User size={32} color="var(--color-accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
              {cliente.nome}
            </h1>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {cliente.email || '—'}</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {cliente.whatsapp || '—'}</div>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--color-border)', marginBottom: '24px' }}>
          <Link href={`/dashboard/clientes/${cliente.id}?tab=informacoes`} style={{
            padding: '12px 0', fontWeight: activeTab === 'informacoes' ? 600 : 500,
            color: activeTab === 'informacoes' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'informacoes' ? '2px solid var(--color-accent)' : '2px solid transparent',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <User size={16} /> Informações & Contato
          </Link>
          <Link href={`/dashboard/clientes/${cliente.id}?tab=documentos`} style={{
            padding: '12px 0', fontWeight: activeTab === 'documentos' ? 600 : 500,
            color: activeTab === 'documentos' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'documentos' ? '2px solid var(--color-accent)' : '2px solid transparent',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <FileText size={16} /> Documentos
          </Link>
          <Link href={`/dashboard/clientes/${cliente.id}?tab=projetos`} style={{
            padding: '12px 0', fontWeight: activeTab === 'projetos' ? 600 : 500,
            color: activeTab === 'projetos' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'projetos' ? '2px solid var(--color-accent)' : '2px solid transparent',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Briefcase size={16} /> Projetos
          </Link>
        </div>

        {/* CONTEÚDO DA ABA INFORMAÇÕES */}
        {activeTab === 'informacoes' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <h2 style={{ fontSize: '1.125rem', margin: '0 0 16px 0', fontWeight: 600 }}>Dados de Contato</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>E-mail</div>
                  <div>{cliente.email || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>WhatsApp</div>
                  <div>
                    {cliente.whatsapp ? (
                      <a href={`https://wa.me/${cliente.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-success)', textDecoration: 'none', fontWeight: 500 }}>
                        {cliente.whatsapp} (Abrir Chat)
                      </a>
                    ) : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Instagram</div>
                  <div>
                    {cliente.instagram ? (
                      <a href={`https://instagram.com/${cliente.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>
                        {cliente.instagram}
                      </a>
                    ) : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CalendarHeart size={20} color="var(--color-text-primary)" />
                  <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Datas Comemorativas</h2>
                </div>
                <EventosClienteModal clienteId={cliente.id} />
              </div>
              
              <div style={{ padding: '24px' }}>
                {eventosOrdenados.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {eventosOrdenados.map((evento: any) => (
                      <div key={evento.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-base)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-info-subtle)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calendar size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{evento.nome_pessoas}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              {formatTipoEvento(evento.tipo_evento)} • {new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </div>
                            {evento.observacao && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Obs: {evento.observacao}</div>}
                          </div>
                        </div>
                        <EventosClienteModal clienteId={cliente.id} eventoEdicao={evento} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>
                    Nenhum evento importante cadastrado. Adicione aniversários ou bodas!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA DOCUMENTOS */}
        {activeTab === 'documentos' && (
          <div className="card animate-fade-in">
            <h2 style={{ fontSize: '1.125rem', margin: '0 0 16px 0', fontWeight: 600 }}>Documentos & Endereço</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>CPF</div>
                <div style={{ fontWeight: 500 }}>{cliente.cpf || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>RG</div>
                <div style={{ fontWeight: 500 }}>{cliente.rg || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Data de Nascimento</div>
                <div style={{ fontWeight: 500 }}>{cliente.data_nascimento ? new Date(cliente.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Endereço Completo</div>
                <div style={{ fontWeight: 500 }}>{cliente.endereco || '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA PROJETOS */}
        {activeTab === 'projetos' && (
          <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Briefcase size={20} color="var(--color-text-primary)" />
              <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Histórico de Projetos</h2>
            </div>
            <div style={{ padding: '24px' }}>
              {cliente.leads_propostas && cliente.leads_propostas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {cliente.leads_propostas.map((projeto: any) => (
                    <div key={projeto.id} style={{ 
                      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px',
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
                          Data base: {projeto.data_pretendida ? new Date(projeto.data_pretendida).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'A definir'}
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
        )}

      </div>
    </>
  )
}
