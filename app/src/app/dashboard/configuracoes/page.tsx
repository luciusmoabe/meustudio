import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Bell, Shield, Palette, Globe, ChevronRight, Tag, PieChart } from 'lucide-react'

export const metadata = {
  title: 'Configurações | MeuStudio',
  description: 'Configurações gerais do sistema MeuStudio',
}

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grupos = [
    {
      titulo: 'Perfil e Estúdio',
      descricao: 'Dados do seu estúdio, logo, cores e informações de contato.',
      icon: Palette,
      href: '/dashboard/perfil',
      cor: 'var(--color-accent)',
      bg: 'var(--color-accent-subtle)',
    },
    {
      titulo: 'Tipos de Serviço & Custos',
      descricao: 'Gerencie seus pacotes de foto, durações padrão, custos e margens de lucro.',
      icon: Tag,
      href: '/dashboard/configuracoes/servicos',
      cor: 'var(--color-accent)',
      bg: 'var(--color-accent-subtle)',
    },
    {
      titulo: 'Categorias Financeiras',
      descricao: 'Personalize nomes, cores e ícones das suas receitas e despesas.',
      icon: PieChart,
      href: '/dashboard/configuracoes/categorias',
      cor: 'var(--color-success)',
      bg: 'var(--color-success-subtle)',
    },
    {
      titulo: 'Segurança',
      descricao: 'Altere sua senha e configure a autenticação da conta.',
      icon: Shield,
      href: '#',
      cor: 'var(--color-success)',
      bg: 'var(--color-success-subtle)',
      badge: 'Em breve',
    },
    {
      titulo: 'Notificações',
      descricao: 'Escolha quando e como receber alertas do sistema.',
      icon: Bell,
      href: '#',
      cor: 'var(--color-warning)',
      bg: 'var(--color-warning-subtle)',
      badge: 'Em breve',
    },
    {
      titulo: 'Integrações',
      descricao: 'Google Calendar, gateway de pagamento e outras conexões.',
      icon: Globe,
      href: '#',
      cor: 'var(--color-info)',
      bg: 'var(--color-info-subtle)',
      badge: 'Em breve',
    },
  ]

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Configurações</span>
      </div>

      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-elevated)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--color-border)',
            }}>
              <Settings size={20} color="var(--color-text-secondary)" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', marginBottom: '2px' }}>Configurações do Sistema</h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Gerencie preferências, integrações e dados do seu estúdio.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {grupos.map((g) => {
            const Icon = g.icon
            if (g.href === '#') {
              return (
                <div
                  key={g.titulo}
                  className="card"
                  style={{
                    padding: '22px',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    opacity: 0.7,
                  }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                    background: g.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={20} color={g.cor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{g.titulo}</span>
                      {g.badge && (
                        <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>{g.badge}</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {g.descricao}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={g.titulo}
                href={g.href}
                className="card"
                style={{
                  padding: '22px',
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                  background: g.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color={g.cor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{g.titulo}</span>
                    {g.badge && (
                      <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>{g.badge}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                    {g.descricao}
                  </p>
                </div>
                <ChevronRight size={16} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '4px' }} />
              </Link>
            )
          })}
        </div>

        <div className="card" style={{ marginTop: '24px', padding: '20px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
            🔐 Conta conectada: <strong style={{ color: 'var(--color-text-primary)' }}>{user.email}</strong>
            <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
            ID: <code style={{ fontSize: '0.75rem', background: 'var(--color-bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{user.id.substring(0, 8)}…</code>
          </p>
        </div>
      </div>
    </>
  )
}
