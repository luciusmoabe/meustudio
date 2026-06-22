import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Users, FileText, Calendar, Camera, Plus, CalendarDays, Wallet, Target } from 'lucide-react'
import Link from 'next/link'
import EstrategiaClient from './estrategia/EstrategiaClient'

export const metadata = {
  title: 'Dashboard | MeuStudio',
  description: 'Painel principal do MeuStudio',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfil_fotografo')
    .select('id, nome_comercial')
    .eq('user_id', user?.id ?? '')
    .single()

  const nomeStudio = perfil?.nome_comercial ?? 'seu estúdio'
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // Métricas reais (só executa se o perfil existir)
  let leadsDoMes = 0
  let contratosAtivos = 0
  let sessoesAgendadas = 0
  let receitaMes = 0

  if (perfil?.id) {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    // Leads criados este mês
    const { count: cLeads } = await supabase
      .from('leads_propostas')
      .select('id', { count: 'exact', head: true })
      .eq('fotografo_id', perfil.id)
      .gte('criado_em', inicioMes.toISOString())
    leadsDoMes = cLeads ?? 0

    // Contratos ativos (aprovado ou confirmado)
    const { count: cContratos } = await supabase
      .from('leads_propostas')
      .select('id', { count: 'exact', head: true })
      .eq('fotografo_id', perfil.id)
      .in('status', ['aprovado', 'confirmado'])
    contratosAtivos = cContratos ?? 0

    // Sessões agendadas (futuras ou confirmadas)
    const { count: cSessoes } = await supabase
      .from('sessoes_agenda')
      .select('id', { count: 'exact', head: true })
      .eq('fotografo_id', perfil.id)
      .in('status', ['confirmada', 'reserva_temporaria'])
    sessoesAgendadas = cSessoes ?? 0

    // Receita do mês — usa financeiro_lancamentos como fonte única (Opção B)
    // Inclui receitas de contratos, pagamentos do portal e receitas avulsas
    const fimMes = new Date(inicioMes)
    fimMes.setMonth(fimMes.getMonth() + 1)
    const { data: receitasLanc } = await supabase
      .from('financeiro_lancamentos')
      .select('valor_realizado, valor_previsto')
      .eq('fotografo_id', perfil.id)
      .eq('tipo', 'RECEITA')
      .eq('status', 'PAGO')
      .gte('data_pagamento', inicioMes.toISOString().split('T')[0])
      .lt('data_pagamento', fimMes.toISOString().split('T')[0])
    receitaMes = receitasLanc?.reduce((acc, l) => acc + (l.valor_realizado ?? l.valor_previsto ?? 0), 0) ?? 0
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const stats = [
    { label: 'Leads este mês',    value: String(leadsDoMes),          icon: Users,       color: 'var(--color-info)',    bg: 'var(--color-info-subtle)' },
    { label: 'Contratos ativos',  value: String(contratosAtivos),      icon: FileText,    color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
    { label: 'Sessões agendadas', value: String(sessoesAgendadas),     icon: Calendar,    color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
    { label: 'Receita do mês',    value: formatCurrency(receitaMes),   icon: TrendingUp,  color: 'var(--color-accent)',  bg: 'var(--color-accent-subtle)' },
  ]

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Dashboard</span>
        <div className="topbar-actions">
          <div className="avatar" title={user?.email ?? 'Usuário Teste'}>
            {(user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        {/* Boas-vindas */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--color-accent), #8a2be2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(138, 43, 226, 0.25)',
            }}>
              <Camera size={24} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.375rem', marginBottom: '2px' }}>
                {saudacao}, {nomeStudio}! 👋
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Aqui está um resumo do seu estúdio hoje.
              </p>
            </div>
          </div>
        </div>

        {/* Ações Rápidas (Pílulas Premium) */}
        {perfil && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <Link href="/dashboard/leads" className="btn btn-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <Plus size={14} color="var(--color-accent)" style={{ marginRight: '6px' }}/> Novo Lead
            </Link>
            <Link href="/dashboard/agenda" className="btn btn-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <CalendarDays size={14} color="var(--color-warning)" style={{ marginRight: '6px' }}/> Ver Agenda
            </Link>
            <Link href="/dashboard/pagamentos" className="btn btn-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <Wallet size={14} color="var(--color-success)" style={{ marginRight: '6px' }}/> Pagamentos
            </Link>
            <Link href="/dashboard/contratos" className="btn btn-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: '20px', padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <FileText size={14} color="var(--color-info)" style={{ marginRight: '6px' }}/> Contratos
            </Link>
          </div>
        )}

        {/* Cards de métricas com Glassmorphism */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '40px',
        }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="card premium-card" style={{ padding: '24px' }}>
                {/* Glow de fundo sutil */}
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: stat.color, filter: 'blur(50px)', opacity: 0.15, borderRadius: '50%' }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${stat.bg}`
                  }}>
                    <Icon size={20} color={stat.color} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: '4px', letterSpacing: '-0.03em' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {stat.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Componente Integrado de Estratégia */}
        {perfil && (
          <EstrategiaClient fotografoId={perfil.id} />
        )}

        {/* Estado vazio — convite para configurar */}
        {!perfil && (
          <div className="card" style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'linear-gradient(135deg, var(--color-bg-surface), var(--color-bg-elevated))',
            border: '1px dashed var(--color-border)',
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <Camera size={28} color="var(--color-accent)" />
            </div>
            <h3 style={{ marginBottom: '8px' }}>Configure seu estúdio</h3>
            <p style={{ marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
              Complete o perfil do seu estúdio para começar a usar o MeuStudio.
              Leva menos de 2 minutos!
            </p>
            <a href="/dashboard/perfil" className="btn btn-primary">
              Configurar agora →
            </a>
          </div>
        )}
      </div>
    </>
  )
}
