'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Link, Copy, CheckCircle2, Clock, AlertCircle,
  DollarSign, TrendingUp, XCircle, Loader2,
  ExternalLink, QrCode, CreditCard, FileText,
  Users, RefreshCw, Send,
} from 'lucide-react'

// ============================================================
// TIPOS
// ============================================================
type Lead = {
  id: string
  nome_cliente: string
  tipo_servico: string
  status: string
  valor_total_contratado: number | null
  valor_sinal: number | null
  link_magico_token: string | null
}

type Pagamento = {
  id: string
  tipo_cobranca: string
  valor_bruto: number
  valor_liquido: number | null
  meio_pagamento: string | null
  status: string
  pago_em: string | null
  criado_em: string
  descricao: string | null
  leads_propostas: {
    id: string
    nome_cliente: string
    tipo_servico: string
    link_magico_token: string | null
  } | null
}

// ============================================================
// HELPERS
// ============================================================
const formatCurrency = (v: number | null) =>
  !v ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatDate = (d: string | null) =>
  !d ? '—' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_COLOR: Record<string, string> = {
  pendente:                 'var(--color-text-muted)',
  aguardando_compensacao:   'var(--color-warning)',
  pago:                     'var(--color-success)',
  estornado:                'var(--color-danger)',
  falhou:                   'var(--color-danger)',
}

const STATUS_LABEL: Record<string, string> = {
  pendente:               'Pendente',
  aguardando_compensacao: 'Aguardando',
  pago:                   'Pago ✓',
  estornado:              'Estornado',
  falhou:                 'Falhou',
}

const MEIO_ICON: Record<string, React.ReactNode> = {
  pix:           <QrCode size={13} />,
  cartao_credito: <CreditCard size={13} />,
  boleto:        <FileText size={13} />,
}

const TIPO_SERVICO_LABEL: Record<string, string> = {
  newborn: 'Newborn', casamento: 'Casamento', corporativo: 'Corporativo',
  maternidade: 'Maternidade', familia: 'Família', gestante: 'Gestante',
  ensaio_externo: 'Ensaio', evento: 'Evento', outros: 'Outros',
}

// ============================================================
// COMPONENTE
// ============================================================
type Props = {
  fotografoId: string
  pagamentosIniciais: Pagamento[]
  leadsIniciais: Lead[]
}

export default function PagamentosClient({ fotografoId, pagamentosIniciais, leadsIniciais }: Props) {
  const supabase = createClient()
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(pagamentosIniciais)
  const [leads, setLeads] = useState<Lead[]>(leadsIniciais)
  const [gerando, setGerando] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [aba, setAba] = useState<'extrato' | 'links'>('extrato')

  // Métricas
  const totalRecebido = pagamentos.filter(p => p.status === 'pago').reduce((a, p) => a + p.valor_bruto, 0)
  const totalPendente = pagamentos.filter(p => ['pendente', 'aguardando_compensacao'].includes(p.status)).reduce((a, p) => a + p.valor_bruto, 0)
  const totalFalhou   = pagamentos.filter(p => p.status === 'falhou').reduce((a, p) => a + p.valor_bruto, 0)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroMeio, setFiltroMeio] = useState('')

  const pagamentosFiltrados = pagamentos.filter(p => {
    if (filtroStatus && p.status !== filtroStatus) return false
    if (filtroMeio && p.meio_pagamento !== filtroMeio) return false
    if (busca) {
      const termo = busca.toLowerCase()
      if (!p.leads_propostas?.nome_cliente?.toLowerCase().includes(termo) &&
          !p.descricao?.toLowerCase().includes(termo)) {
        return false
      }
    }
    return true
  })

  // Gera/renova o link mágico do portal do cliente (RF09)
  // O token já é gerado pelo banco no INSERT — apenas atualizamos a expiração
  async function gerarLinkMagico(lead: Lead) {
    setGerando(lead.id)

    // Verifica se o lead tem valor_sinal definido
    if (!lead.valor_sinal || lead.valor_sinal <= 0) {
      alert('⚠️ Defina o valor do sinal antes de gerar o link.\nAcesse o CRM → aprovação do lead para configurar os valores.')
      setGerando(null)
      return
    }

    const expira = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 dias

    // Se o token já existe, só renova a expiração
    // Se não existe, o banco já gerou automaticamente no INSERT — buscamos o token atual
    const { data: leadAtual } = await supabase
      .from('leads_propostas')
      .select('link_magico_token')
      .eq('id', lead.id)
      .single()

    const tokenAtual = leadAtual?.link_magico_token

    const { error } = await supabase
      .from('leads_propostas')
      .update({
        link_magico_expira_em: expira,
        status: 'aprovado',
      })
      .eq('id', lead.id)

    if (!error && tokenAtual) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, link_magico_token: tokenAtual } : l))
    }
    setGerando(null)
  }

  async function copiarLink(token: string, leadId: string) {
    const url = `${window.location.origin}/cliente/${token}`
    await navigator.clipboard.writeText(url)
    setCopiado(leadId)
    setTimeout(() => setCopiado(null), 3000)
  }

  // Simula confirmação manual do pagamento (dev mode)
  async function confirmarManual(pagamentoId: string) {
    const { error } = await supabase
      .from('pagamentos')
      .update({ status: 'pago', pago_em: new Date().toISOString() })
      .eq('id', pagamentoId)

    if (!error) {
      setPagamentos(prev => prev.map(p => p.id === pagamentoId ? { ...p, status: 'pago', pago_em: new Date().toISOString() } : p))
    }
  }

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Pagamentos</span>
        <div className="topbar-actions">
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-base)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            {[{ id: 'extrato', label: 'Extrato' }, { id: 'links', label: 'Links de Cobrança' }].map(t => (
              <button key={t.id} onClick={() => setAba(t.id as typeof aba)}
                className={`btn btn-sm ${aba === t.id ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '5px 14px' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-content animate-fade-in">

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total recebido', value: formatCurrency(totalRecebido), icon: CheckCircle2, color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
            { label: 'Aguardando', value: formatCurrency(totalPendente), icon: Clock, color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
            { label: 'Cobranças falhas', value: formatCurrency(totalFalhou), icon: AlertCircle, color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)' },
          ].map((m, i) => {
            const Icon = m.icon
            return (
              <div key={i} className="card" style={{ padding: '18px 20px', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={m.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '2px' }}>{m.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{m.label}</div>
              </div>
            )
          })}
        </div>

        {/* ===== ABA: EXTRATO ===== */}
        {aba === 'extrato' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={16} color="var(--color-accent)" />
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Histórico de cobranças</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                <input
                  type="text"
                  placeholder="Buscar cliente ou descrição..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="form-input"
                  style={{ maxWidth: '240px', padding: '6px 12px', fontSize: '0.8125rem' }}
                />
                <select className="form-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: 'auto', padding: '6px 28px 6px 12px', fontSize: '0.8125rem' }}>
                  <option value="">Status (Todos)</option>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="aguardando_compensacao">Aguardando</option>
                  <option value="falhou">Falhou</option>
                  <option value="estornado">Estornado</option>
                </select>
                <select className="form-select" value={filtroMeio} onChange={e => setFiltroMeio(e.target.value)} style={{ width: 'auto', padding: '6px 28px 6px 12px', fontSize: '0.8125rem' }}>
                  <option value="">Meio (Todos)</option>
                  <option value="pix">Pix</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Cliente', 'Tipo', 'Meio', 'Valor', 'Status', 'Data', 'Ação'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagamentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Nenhum pagamento encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
                {pagamentosFiltrados.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < pagamentosFiltrados.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.leads_propostas?.nome_cliente ?? '—'}</div>
                      {p.descricao && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.descricao}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>
                        {p.tipo_cobranca === 'sinal' ? 'Sinal' : p.tipo_cobranca === 'complemento' ? 'Extra' : 'Outro'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.meio_pagamento ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                          {MEIO_ICON[p.meio_pagamento]}
                          {p.meio_pagamento === 'pix' ? 'Pix' : p.meio_pagamento === 'cartao_credito' ? 'Cartão' : 'Boleto'}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.875rem' }}>
                      {formatCurrency(p.valor_bruto)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge" style={{ background: `${STATUS_COLOR[p.status]}20`, color: STATUS_COLOR[p.status], fontSize: '0.7rem' }}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                      {formatDate(p.pago_em ?? p.criado_em)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.status === 'aguardando_compensacao' && (
                        <button onClick={() => confirmarManual(p.id)} className="btn btn-sm" title="Confirmar manualmente (dev mode)"
                          style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', border: 'none', padding: '5px 10px', fontSize: '0.75rem' }}>
                          <CheckCircle2 size={12} /> Confirmar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== ABA: LINKS DE COBRANÇA ===== */}
        {aba === 'links' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: 'var(--color-accent-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)' }}>
              <Link size={16} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: 'var(--color-accent)', fontWeight: 500, marginBottom: '2px', fontSize: '0.875rem' }}>Portal do Cliente via Link Mágico (RF09)</p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                  Gere um link único e seguro para cada cliente acessar o portal de pagamento, visualizar sessões e assinar o contrato.
                </p>
              </div>
            </div>

            {leads.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--color-border)' }}>
                <Users size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--color-text-muted)' }}>Nenhum lead aprovado ainda.<br />Aprove um lead no CRM para gerar o link.</p>
                <a href="/dashboard/leads" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>Ir para o CRM →</a>
              </div>
            )}

            {leads.map(lead => (
              <div key={lead.id} className="card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{lead.nome_cliente}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>{TIPO_SERVICO_LABEL[lead.tipo_servico] ?? lead.tipo_servico}</span>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{lead.status}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Sinal</div>
                    <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(lead.valor_sinal)}</div>
                  </div>
                </div>

                {lead.link_magico_token ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                      flex: 1, padding: '9px 12px',
                      background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
                      color: 'var(--color-text-muted)', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/cliente/${lead.link_magico_token}` : `/cliente/${lead.link_magico_token}`}
                    </div>
                    <button
                      onClick={() => copiarLink(lead.link_magico_token!, lead.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                    >
                      {copiado === lead.id ? <><CheckCircle2 size={13} /> Copiado!</> : <><Copy size={13} /> Copiar</>}
                    </button>
                    <a
                      href={`/cliente/${lead.link_magico_token}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ flexShrink: 0 }}
                    >
                      <ExternalLink size={13} /> Abrir
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => gerarLinkMagico(lead)}
                    className="btn btn-primary btn-sm"
                    disabled={gerando === lead.id}
                    style={{ width: '100%' }}
                  >
                    {gerando === lead.id
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                      : <><Link size={14} /> Gerar Link do Portal</>
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
