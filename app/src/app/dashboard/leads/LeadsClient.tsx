'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Kanban, List, Search,
  Phone, Calendar, DollarSign,
  ThumbsUp, ThumbsDown, MoreHorizontal,
  Users, TrendingUp, Settings2, Loader2, ExternalLink,
} from 'lucide-react'
import ModalNovoLead from '@/components/ModalNovoLead'
import ModalPerdeu from '@/components/ModalPerdeu'
import ModalGanhou from '@/components/ModalGanhou'

type Etapa = {
  id: string
  nome_etapa: string
  ordem: number
  cor_hex: string
  tipo_pipeline: string
  pacote_id?: string | null
}

type Lead = {
  id: string
  nome_cliente: string
  whatsapp_cliente: string | null
  email_cliente: string | null
  tipo_servico: string
  data_pretendida: string | null
  valor_estimado: number | null
  status: string
  etapa_pipeline_id: string | null
  origem_lead: string | null
  motivo_perda: string | null
  criado_em: string
}

const STATUS_COLORS: Record<string, string> = {
  novo:             'var(--color-info)',
  em_negociacao:    'var(--color-warning)',
  proposta_enviada: 'var(--color-accent)',
  aprovado:         'var(--color-success)',
  confirmado:       'var(--color-success)',
  perdido:          'var(--color-danger)',
  arquivado:        'var(--color-text-muted)',
}

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo', em_negociacao: 'Em negociação',
  proposta_enviada: 'Proposta enviada', aprovado: 'Aprovado',
  confirmado: 'Confirmado', perdido: 'Perdido', arquivado: 'Arquivado',
}

const TIPO_LABELS: Record<string, string> = {
  newborn: 'Newborn', casamento: 'Casamento', corporativo: 'Corporativo',
  maternidade: 'Maternidade', familia: 'Família', gestante: 'Gestante',
  ensaio_externo: 'Ensaio', evento: 'Evento', outros: 'Outros',
}

const ETAPAS_DEFAULT = [
  { nome_etapa: 'Novo Lead', ordem: 1, cor_hex: '#60a5fa' },
  { nome_etapa: 'Reunião Agendada', ordem: 2, cor_hex: '#fbbf24' },
  { nome_etapa: 'Proposta Enviada', ordem: 3, cor_hex: '#a78bfa' },
  { nome_etapa: 'Aguardando Sinal', ordem: 4, cor_hex: '#34d399' },
]

function formatCurrency(val: number | null) {
  if (!val) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(date: string | null) {
  if (!date) return '—'
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')
}

type TipoSessao = {
  id: string
  nome: string
  valor_sugerido: number
  duracao_minutos: number
  limite_fotos_def: number
  cor_hex: string
  descricao: string | null
  is_pacote?: boolean
  servico_formularios?: { id: string; pergunta: string; tipo_resposta: string; obrigatorio: boolean; ordem: number }[]
}

type Props = {
  fotografoId: string
  etapasIniciais: Etapa[]
  leadsIniciais: Lead[]
  tiposSessao: TipoSessao[]
}

export default function LeadsClient({ fotografoId, etapasIniciais, leadsIniciais, tiposSessao }: Props) {
  const supabase = createClient()
  const [etapas, setEtapas] = useState<Etapa[]>(etapasIniciais)
  const [leads, setLeads] = useState<Lead[]>(leadsIniciais)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [dragOverEtapaId, setDragOverEtapaId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  const [modalPerdeu, setModalPerdeu] = useState<Lead | null>(null)
  const [modalGanhou, setModalGanhou] = useState<Lead | null>(null)
  const [leadMenuOpen, setLeadMenuOpen] = useState<string | null>(null)
  const [criandoEtapas, setCriandoEtapas] = useState(false)

  useEffect(() => {
    console.log('LeadsClient mounted!');
  }, [])

  function getServiceLabel(value: string) {
    const found = tiposSessao.find(t => t.nome.toLowerCase() === value.toLowerCase() || t.id === value)
    if (found) return found.nome
    return TIPO_LABELS[value] ?? value
  }

  // Cria as etapas padrão se não existirem
  async function criarEtapasPadrao() {
    setCriandoEtapas(true)
    const novas = []
    for (const e of ETAPAS_DEFAULT) {
      const { data } = await supabase
        .from('etapas_pipeline')
        .insert({ ...e, fotografo_id: fotografoId, tipo_pipeline: 'vendas' })
        .select()
        .single()
      if (data) novas.push(data)
    }
    setEtapas(novas)
    setCriandoEtapas(false)
  }

  function handleLeadCriado(lead: Record<string, unknown>) {
    setLeads(prev => [lead as Lead, ...prev])
  }

  async function moverParaEtapa(leadId: string, etapaId: string) {
    await supabase.from('leads_propostas').update({ etapa_pipeline_id: etapaId }).eq('id', leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, etapa_pipeline_id: etapaId } : l))
  }

  function marcarGanhou(lead: Lead) {
    setModalGanhou(lead)
    setLeadMenuOpen(null)
  }

  function handleLeadAprovado(leadAtualizado: Record<string, unknown>) {
    setLeads(prev => prev.map(l =>
      l.id === leadAtualizado.id
        ? { ...l, status: 'aprovado', ...leadAtualizado } as Lead
        : l
    ))
  }

  async function confirmarPerda(leadId: string, motivo: string, obs: string) {
    const { error } = await supabase
      .from('leads_propostas')
      .update({
        status: 'perdido',
        motivo_perda: motivo,
        observacao_perda: obs,
        data_perda: new Date().toISOString(),
      })
      .eq('id', leadId)
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'perdido', motivo_perda: motivo } : l))
    }
    setModalPerdeu(null)
  }

  // Filtros
  const leadsFiltrados = leads.filter(l => {
    const matchSearch = l.nome_cliente.toLowerCase().includes(search.toLowerCase()) ||
      (l.email_cliente ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || l.status === filtroStatus
    return matchSearch && matchStatus
  })

  const leadsAtivos = leadsFiltrados.filter(l => !['perdido', 'arquivado'].includes(l.status))
  const leadsKanban = leadsFiltrados.filter(l => !['perdido', 'arquivado', 'aprovado', 'confirmado'].includes(l.status))

  // Métricas rápidas
  const totalLeads = leads.filter(l => l.status !== 'perdido').length
  const ganhos = leads.filter(l => ['aprovado', 'confirmado'].includes(l.status)).length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const valorPipeline = leads
    .filter(l => !['perdido', 'arquivado'].includes(l.status))
    .reduce((acc, l) => acc + (l.valor_estimado ?? 0), 0)

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">CRM — Leads</span>
        <div className="topbar-actions">
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-base)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '5px 12px' }}>
                {v === 'kanban' ? <><Kanban size={14} /> Kanban</> : <><List size={14} /> Lista</>}
              </button>
            ))}
          </div>
          <button onClick={() => { console.log('CLICKED BUTTON!'); setShowModal(true); }} className="btn btn-primary btn-sm" data-testid="btn-novo-lead">
            <Plus size={15} /> Novo Lead
          </button>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Leads Ativos', value: totalLeads, icon: Users, color: 'var(--color-info)', bg: 'var(--color-info-subtle)' },
            { label: 'Ganhos', value: ganhos, icon: ThumbsUp, color: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
            { label: 'Perdidos', value: perdidos, icon: ThumbsDown, color: 'var(--color-danger)', bg: 'var(--color-danger-subtle)' },
            { label: 'Pipeline', value: formatCurrency(valorPipeline), icon: TrendingUp, color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
          ].map((m, i) => {
            const Icon = m.icon
            return (
              <div key={i} className="card" style={{ padding: '16px 20px', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={m.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>{m.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{m.label}</div>
              </div>
            )
          })}
        </div>

        {/* Barra de busca + filtros */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['todos', 'novo', 'em_negociacao', 'proposta_enviada', 'aprovado', 'perdido'].map(s => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className="btn btn-sm"
                style={{
                  background: filtroStatus === s ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                  color: filtroStatus === s ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  border: `1px solid ${filtroStatus === s ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Estado vazio: sem etapas */}
        {etapas.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Settings2 size={24} color="var(--color-accent)" />
            </div>
            <h3 style={{ marginBottom: '8px' }}>Configure seu funil de vendas</h3>
            <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto 24px' }}>
              Crie as colunas do seu Kanban para organizar seus leads. Você pode personalizar depois.
            </p>
            <button onClick={criarEtapasPadrao} className="btn btn-primary" disabled={criandoEtapas}>
              {criandoEtapas ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Plus size={14} /> Criar funil padrão</>}
            </button>
          </div>
        )}

        {/* KANBAN VIEW */}
        {view === 'kanban' && etapas.length > 0 && (
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
            {etapas.map(etapa => {
              const leadsEtapa = leadsKanban.filter(l => l.etapa_pipeline_id === etapa.id)
              return (
                <div key={etapa.id} 
                  onDragOver={(e) => { e.preventDefault(); setDragOverEtapaId(etapa.id) }}
                  onDragLeave={() => setDragOverEtapaId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverEtapaId(null);
                    const leadId = e.dataTransfer.getData('leadId');
                    if (leadId) moverParaEtapa(leadId, etapa.id);
                  }}
                  style={{
                  minWidth: '260px', width: '260px',
                  background: dragOverEtapaId === etapa.id ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
                  border: `1px solid ${dragOverEtapaId === etapa.id ? etapa.cor_hex : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', flexDirection: 'column',
                  maxHeight: 'calc(100vh - 280px)',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Header da coluna */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: `3px solid ${etapa.cor_hex}`,
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{etapa.nome_etapa}</span>
                      <span style={{
                        background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)',
                        padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {leadsEtapa.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards da coluna */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leadsEtapa.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                        Nenhum lead aqui
                      </div>
                    )}
                    {leadsEtapa.map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        etapas={etapas}
                        onMover={moverParaEtapa}
                        onGanhou={() => marcarGanhou(lead)}
                        onPerdeu={() => setModalPerdeu(lead)}
                        menuOpen={leadMenuOpen === lead.id}
                        onMenuToggle={() => setLeadMenuOpen(leadMenuOpen === lead.id ? null : lead.id)}
                        isDragging={draggedLeadId === lead.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('leadId', lead.id)
                          e.dataTransfer.effectAllowed = 'move'
                          // Timeout to allow the drag image to be generated before hiding the original
                          setTimeout(() => setDraggedLeadId(lead.id), 0)
                        }}
                        onDragEnd={() => setDraggedLeadId(null)}
                        getServiceLabel={getServiceLabel}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Coluna Aprovados */}
            {leads.some(l => ['aprovado', 'confirmado'].includes(l.status)) && (
              <div style={{ minWidth: '260px', width: '260px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 280px)' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid var(--color-success)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ThumbsUp size={14} color="var(--color-success)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-success)' }}>Ganhos</span>
                    <span style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {leads.filter(l => ['aprovado', 'confirmado'].includes(l.status)).length}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leads.filter(l => ['aprovado', 'confirmado'].includes(l.status)).map(lead => (
                    <LeadCard key={lead.id} lead={lead} etapas={etapas} onMover={moverParaEtapa} onGanhou={() => {}} onPerdeu={() => {}} menuOpen={false} onMenuToggle={() => {}} isDragging={false} getServiceLabel={getServiceLabel} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LISTA VIEW */}
        {view === 'lista' && etapas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Cliente', 'Tipo', 'Data', 'Valor', 'Etapa', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Nenhum lead encontrado
                    </td>
                  </tr>
                )}
                {leadsFiltrados.map((lead, i) => {
                  const etapa = etapas.find(e => e.id === lead.etapa_pipeline_id)
                  return (
                    <tr key={lead.id} style={{
                      borderBottom: i < leadsFiltrados.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      transition: 'background var(--transition-fast)',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '2px' }}>{lead.nome_cliente}</div>
                        {lead.whatsapp_cliente && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{lead.whatsapp_cliente}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>{getServiceLabel(lead.tipo_servico)}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {formatDate(lead.data_pretendida)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 500 }}>
                        {formatCurrency(lead.valor_estimado)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {etapa ? (
                          <span style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: etapa.cor_hex, flexShrink: 0 }} />
                            {etapa.nome_etapa}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge" style={{ background: `${STATUS_COLORS[lead.status]}20`, color: STATUS_COLORS[lead.status], fontSize: '0.7rem' }}>
                          {STATUS_LABELS[lead.status] ?? lead.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {!['aprovado', 'confirmado', 'perdido'].includes(lead.status) && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => marcarGanhou(lead)} className="btn btn-sm" title="Marcar como Ganho" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', border: 'none', padding: '5px 8px' }}>
                              <ThumbsUp size={13} />
                            </button>
                            <button onClick={() => setModalPerdeu(lead)} className="btn btn-sm" title="Marcar como Perdido" style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: 'none', padding: '5px 8px' }}>
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        )}
                        {lead.status === 'aprovado' && <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>✓ Aprovado</span>}
                        {lead.status === 'perdido' && <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>✗ Perdido</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ModalNovoLead
          fotografoId={fotografoId}
          etapas={etapas}
          onLeadCriado={handleLeadCriado}
          onClose={() => setShowModal(false)}
          tiposSessao={tiposSessao}
        />
      )}
      {modalPerdeu && (
        <ModalPerdeu
          lead={modalPerdeu}
          onClose={() => setModalPerdeu(null)}
          onConfirm={confirmarPerda}
        />
      )}
      {modalGanhou && (
        <ModalGanhou
          fotografoId={fotografoId}
          lead={modalGanhou}
          onConfirmado={handleLeadAprovado}
          onClose={() => setModalGanhou(null)}
        />
      )}
    </>
  )
}

// ============================================================
// Sub-componente: Card do Lead no Kanban
// ============================================================
function LeadCard({
  lead, etapas, onMover, onGanhou, onPerdeu, menuOpen, onMenuToggle, isDragging, onDragStart, onDragEnd, getServiceLabel
}: {
  lead: Lead
  etapas: Etapa[]
  onMover: (leadId: string, etapaId: string) => void
  onGanhou: () => void
  onPerdeu: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
  getServiceLabel: (val: string) => string
}) {
  const isGanho = ['aprovado', 'confirmado'].includes(lead.status)

  return (
    <div 
      draggable={!isGanho}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
      background: 'var(--color-bg-elevated)',
      border: `1px solid ${isGanho ? 'var(--color-success)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      position: 'relative',
      cursor: isGanho ? 'default' : 'grab',
      opacity: isDragging ? 0.4 : 1,
      transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast), opacity 0.2s',
      boxShadow: isGanho ? '0 0 12px rgba(52,211,153,0.1)' : 'none',
    }}
      onMouseEnter={e => { if (!isGanho) e.currentTarget.style.borderColor = 'var(--color-border-focus)' }}
      onMouseLeave={e => { if (!isGanho) e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      {/* Header do card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nome_cliente}
          </div>
          <span className="badge" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', fontSize: '0.7rem', padding: '1px 6px' }}>
            {getServiceLabel(lead.tipo_servico)}
          </span>
        </div>
        {!isGanho && (
          <div style={{ position: 'relative' }}>
            <button onClick={onMenuToggle} className="btn btn-ghost" style={{ padding: '3px', borderRadius: 'var(--radius-sm)' }}>
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 200,
                background: 'var(--color-bg-overlay)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '160px',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '4px 8px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mover para</div>
                  {etapas.map(e => (
                    <button key={e.id} onClick={() => onMover(lead.id, e.id)} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.cor_hex, flexShrink: 0 }} />
                      {e.nome_etapa}
                    </button>
                  ))}
                  <hr className="divider" style={{ margin: '4px 0' }} />
                  <button onClick={onGanhou} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--color-success)', fontSize: '0.8125rem' }}>
                    <ThumbsUp size={13} /> Marcar como Ganho
                  </button>
                  <button onClick={onPerdeu} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--color-danger)', fontSize: '0.8125rem' }}>
                    <ThumbsDown size={13} /> Marcar como Perdido
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detalhes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {lead.whatsapp_cliente && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <Phone size={11} /> {lead.whatsapp_cliente}
          </div>
        )}
        {lead.data_pretendida && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <Calendar size={11} /> {formatDate(lead.data_pretendida)}
          </div>
        )}
        {lead.valor_estimado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 600, color: isGanho ? 'var(--color-success)' : 'var(--color-text-primary)', marginTop: '4px' }}>
            <DollarSign size={12} /> {formatCurrency(lead.valor_estimado)}
          </div>
        )}
      </div>

      {isGanho && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600 }}>
          <ThumbsUp size={12} /> Aprovado
        </div>
      )}
    </div>
  )
}
