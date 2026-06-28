'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Kanban, List, Search,
  Phone, Calendar, DollarSign,
  ThumbsUp, ThumbsDown, MoreHorizontal, Trash2,
  Users, TrendingUp, Settings2, Loader2, ExternalLink,
  GripVertical,
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
  meta_acoes?: number
  transicoes_permitidas?: number[] | null
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
  historico_acoes: { titulo: string; data: string; etapa_id: string }[] | null
  cliente_id?: string | null
  data_entrada_etapa?: string
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
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [pipelineAtivo, setPipelineAtivo] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  const [modalPerdeu, setModalPerdeu] = useState<Lead | null>(null)
  const [modalGanhou, setModalGanhou] = useState<Lead | null>(null)
  const [modalNovaAcao, setModalNovaAcao] = useState<Lead | null>(null)
  const [modalHistorico, setModalHistorico] = useState<Lead | null>(null)
  const [novaAcaoTitulo, setNovaAcaoTitulo] = useState('')
  const [salvandoAcao, setSalvandoAcao] = useState(false)
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
    let finalEtapaId = etapaId
    if (etapaId.includes(',')) {
      const lead = leads.find(l => l.id === leadId)
      if (lead) {
        const servicoId = tiposSessao.find(t => t.nome.toLowerCase() === lead.tipo_servico.toLowerCase() || t.id === lead.tipo_servico)?.id
        const ids = etapaId.split(',')
        const especifica = etapas.find(e => ids.includes(e.id) && e.pacote_id === servicoId)
        if (especifica) {
          finalEtapaId = especifica.id
        } else {
          const padrao = etapas.find(e => ids.includes(e.id) && !e.pacote_id)
          finalEtapaId = padrao ? padrao.id : ids[0]
        }
      }
    }
    
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { 
      ...l, 
      etapa_pipeline_id: finalEtapaId,
      data_entrada_etapa: new Date().toISOString()
    } : l))
    
    setDraggedLeadId(null)
    setDragOverEtapaId(null)
    
    await supabase.from('leads_propostas').update({ etapa_pipeline_id: finalEtapaId }).eq('id', leadId)
  }

  async function reordenarEtapas(draggedId: string, targetId: string) {
    if (draggedId === targetId) return

    // Reordena sobre as colunas visíveis. No modo "Todos os Funis" cada coluna
    // representa um grupo de etapas (id = "id1,id2,..."); fora dele é uma etapa única.
    const cols = [...etapasKanban]
    const draggedIndex = cols.findIndex(c => c.id === draggedId)
    const targetIndex = cols.findIndex(c => c.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const [movido] = cols.splice(draggedIndex, 1)
    cols.splice(targetIndex, 0, movido)

    // Expande os grupos: cada etapa real recebe a ordem da sua coluna.
    const novaOrdem = new Map<string, number>()
    cols.forEach((c, index) => {
      c.id.split(',').forEach(realId => novaOrdem.set(realId, index + 1))
    })

    // Optimistic update
    setEtapas(prev => prev.map(e => novaOrdem.has(e.id) ? { ...e, ordem: novaOrdem.get(e.id)! } : e))

    // Persiste apenas as etapas afetadas (constraint de ordem já foi removida)
    await Promise.all(
      [...novaOrdem.entries()].map(([id, ordem]) =>
        supabase.from('etapas_pipeline').update({ ordem }).eq('id', id)
      )
    )
  }

  async function excluirLead(leadId: string) {
    if (!window.confirm('Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.')) return
    
    // Optimistic update
    setLeads(prev => prev.filter(l => l.id !== leadId))
    
    await supabase.from('leads_propostas').delete().eq('id', leadId)
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

  async function registrarAcao(e: React.FormEvent) {
    e.preventDefault()
    if (!modalNovaAcao || !novaAcaoTitulo.trim()) return
    setSalvandoAcao(true)
    const nova = { titulo: novaAcaoTitulo, data: new Date().toISOString(), etapa_id: modalNovaAcao.etapa_pipeline_id! }
    const historicoAtual = modalNovaAcao.historico_acoes || []
    const novoHistorico = [...historicoAtual, nova]
    const { error } = await supabase.from('leads_propostas').update({ historico_acoes: novoHistorico }).eq('id', modalNovaAcao.id)
    if (!error) {
      setLeads(prev => prev.map(l => l.id === modalNovaAcao.id ? { ...l, historico_acoes: novoHistorico } : l))
    }
    setModalNovaAcao(null)
    setNovaAcaoTitulo('')
    setSalvandoAcao(false)
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

  // Pipelines disponíveis e filtro
  const funisDisponiveis = [
    { id: 'todos', nome: 'Todos os Funis' },
    { id: 'padrao', nome: 'Funil Padrão' },
    ...tiposSessao
      .filter(t => etapas.some(e => e.pacote_id === t.id))
      .map(t => ({ id: t.id, nome: `Funil: ${t.nome}` }))
  ]

  let etapasKanban: Etapa[] = []
  if (pipelineAtivo === 'todos') {
    const grupos = new Map<string, Etapa[]>()
    etapas.forEach(e => {
      const key = e.nome_etapa.trim().toLowerCase()
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(e)
    })
    etapasKanban = Array.from(grupos.values()).map(grupo => {
      const p = grupo[0]
      return {
        id: grupo.map(g => g.id).join(','),
        nome_etapa: p.nome_etapa,
        ordem: Math.min(...grupo.map(g => g.ordem)),
        cor_hex: p.cor_hex,
        tipo_pipeline: p.tipo_pipeline,
        meta_acoes: p.meta_acoes,
        transicoes_permitidas: p.transicoes_permitidas
      }
    }).sort((a, b) => a.ordem - b.ordem)
  } else {
    etapasKanban = etapas.filter(e => pipelineAtivo === 'padrao' ? !e.pacote_id : e.pacote_id === pipelineAtivo)
  }
  
  const leadsGanhosAtuais = leads.filter(l => {
    if (!['aprovado', 'confirmado'].includes(l.status)) return false;
    if (pipelineAtivo === 'todos') return true;
    const etapa = etapas.find(e => e.id === l.etapa_pipeline_id);
    if (pipelineAtivo === 'padrao') return !etapa || !etapa.pacote_id;
    return etapa?.pacote_id === pipelineAtivo;
  })

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
          <div className="animate-fade-in">
            {funisDisponiveis.length > 1 && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Visualizando:</span>
                <select 
                  className="form-select form-select-sm" 
                  style={{ width: 'auto', minWidth: '180px', padding: '6px 12px', fontSize: '0.8125rem' }}
                  value={pipelineAtivo} 
                  onChange={e => setPipelineAtivo(e.target.value)}
                >
                  {funisDisponiveis.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
              {etapasKanban.map(etapa => {
                const leadsEtapa = leadsKanban.filter(l => l.etapa_pipeline_id && etapa.id.includes(l.etapa_pipeline_id))
                
                const leadArrastado = draggedLeadId ? leads.find(l => l.id === draggedLeadId) : null
                let isAllowed = true
                if (leadArrastado) {
                  const etapaOrigem = etapas.find(e => e.id === leadArrastado.etapa_pipeline_id)
                  if (etapaOrigem && etapaOrigem.transicoes_permitidas && etapaOrigem.transicoes_permitidas.length > 0) {
                    isAllowed = etapaOrigem.transicoes_permitidas.includes(etapa.ordem) || etapa.id.includes(etapaOrigem.id)
                  }
                }

                return (
                <div key={etapa.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!draggedColumnId && !isAllowed) return;
                    setDragOverEtapaId(etapa.id)
                  }}
                  onDragLeave={() => setDragOverEtapaId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverEtapaId(null);

                    const colId = e.dataTransfer.getData('colId');
                    if (colId) {
                      reordenarEtapas(colId, etapa.id);
                      return;
                    }

                    if (!isAllowed) return;
                    const leadId = e.dataTransfer.getData('leadId');
                    if (leadId) moverParaEtapa(leadId, etapa.id);
                  }}
                  data-type="column"
                  style={{
                  minWidth: '260px', width: '260px',
                  background: dragOverEtapaId === etapa.id ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
                  border: `1px solid ${dragOverEtapaId === etapa.id ? etapa.cor_hex : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', flexDirection: 'column',
                  maxHeight: 'calc(100vh - 280px)',
                  transition: 'all 0.2s ease',
                  opacity: draggedLeadId && !isAllowed ? 0.3 : (draggedColumnId === etapa.id ? 0.5 : 1),
                  filter: draggedLeadId && !isAllowed ? 'grayscale(100%)' : 'none',
                  pointerEvents: draggedLeadId && !isAllowed ? 'none' : 'auto',
                }}>
                  {/* Header da coluna (alça de arraste para reordenar) */}
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('colId', etapa.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setTimeout(() => setDraggedColumnId(etapa.id), 0);
                    }}
                    onDragEnd={() => setDraggedColumnId(null)}
                    title="Arraste para reordenar a etapa"
                    style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderTop: `3px solid ${etapa.cor_hex}`,
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                    cursor: 'grab',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GripVertical size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
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
                        onExcluir={() => excluirLead(lead.id)}
                        onNovaAcao={() => setModalNovaAcao(lead)}
                        onVerHistorico={() => setModalHistorico(lead)}
                        menuOpen={leadMenuOpen === lead.id}
                        onMenuToggle={() => setLeadMenuOpen(leadMenuOpen === lead.id ? null : lead.id)}
                        isDragging={draggedLeadId === lead.id}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('leadId', lead.id)
                          e.dataTransfer.effectAllowed = 'move'
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
            {leadsGanhosAtuais.length > 0 && (
              <div style={{ minWidth: '260px', width: '260px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 280px)' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid var(--color-success)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ThumbsUp size={14} color="var(--color-success)" />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-success)' }}>Ganhos</span>
                    <span style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {leadsGanhosAtuais.length}
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leadsGanhosAtuais.map(lead => (
                    <LeadCard key={lead.id} lead={lead} etapas={etapas} onMover={moverParaEtapa} onGanhou={() => setModalGanhou(lead)} onPerdeu={() => setModalPerdeu(lead)} onExcluir={() => excluirLead(lead.id)} onNovaAcao={() => {}} onVerHistorico={() => setModalHistorico(lead)} menuOpen={leadMenuOpen === lead.id} onMenuToggle={() => setLeadMenuOpen(leadMenuOpen === lead.id ? null : lead.id)} getServiceLabel={getServiceLabel} />
                  ))}
                </div>
              </div>
            )}
          </div>
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
      {modalNovaAcao && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: 'var(--shadow-xl)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Registrar Ação</h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Qual ação você realizou para o lead <strong>{modalNovaAcao.nome_cliente}</strong>?</p>
            
            <form onSubmit={registrarAcao} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Título da Ação (Ex: Mensagem, Ligação)</label>
                <input type="text" className="form-input" value={novaAcaoTitulo} onChange={e => setNovaAcaoTitulo(e.target.value)} required autoFocus placeholder="Ex: Follow up 1" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setModalNovaAcao(null)} className="btn btn-ghost" disabled={salvandoAcao}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoAcao}>{salvandoAcao ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Registrar Ação'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalHistorico && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: 'var(--shadow-xl)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Histórico de Ações</h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Lead: <strong>{modalHistorico.nome_cliente}</strong></p>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
              {!modalHistorico.historico_acoes || modalHistorico.historico_acoes.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', padding: '20px 0' }}>Nenhuma ação registrada neste lead.</div>
              ) : (
                Array.from(new Set(modalHistorico.historico_acoes.map(a => a.etapa_id))).map(etapaId => {
                  const etapa = etapas.find(e => e.id === etapaId)
                  const acoes = modalHistorico.historico_acoes!.filter(a => a.etapa_id === etapaId)
                  return (
                    <div key={etapaId} style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: etapa?.cor_hex || 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{etapa?.nome_etapa || 'Etapa Desconhecida'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-base)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                          {acoes.length} {etapa?.meta_acoes ? `/ ${etapa.meta_acoes}` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {acoes.map((acao, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                            <span>{acao.titulo}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{new Date(acao.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button onClick={() => setModalHistorico(null)} className="btn btn-ghost">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// Sub-componente: Card do Lead no Kanban
// ============================================================
function LeadCard({
  lead, etapas, onMover, onGanhou, onPerdeu, onExcluir, onNovaAcao, onVerHistorico, menuOpen, onMenuToggle, isDragging, onDragStart, onDragEnd, getServiceLabel
}: {
  lead: Lead
  etapas: Etapa[]
  onMover: (leadId: string, etapaId: string) => void
  onGanhou: () => void
  onPerdeu: () => void
  onExcluir: () => void
  onNovaAcao: () => void
  onVerHistorico: () => void
  menuOpen: boolean
  onMenuToggle: () => void
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void
  getServiceLabel: (val: string) => string
}) {
  const isGanho = ['aprovado', 'confirmado'].includes(lead.status)
  const etapaAtual = etapas.find(e => e.id === lead.etapa_pipeline_id)
  const metaAcoes = etapaAtual?.meta_acoes || 0
  const acoesNestaEtapa = (lead.historico_acoes || []).filter(a => a.etapa_id === lead.etapa_pipeline_id)
  const pctCompleto = metaAcoes > 0 ? Math.min(100, Math.round((acoesNestaEtapa.length / metaAcoes) * 100)) : 0
  
  const diasNaEtapa = Math.floor((Date.now() - new Date(lead.data_entrada_etapa || lead.criado_em).getTime()) / (1000 * 60 * 60 * 24))

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
            {lead.cliente_id && (
              <span title="Cliente Recorrente" style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center', color: '#eab308' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </span>
            )}
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

      {/* Ações Rápidas (Inline Expansion) */}
      {menuOpen && !isGanho && (
        <div 
          className="animate-fade-in"
          style={{
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
        }}>
          <button 
            onClick={onGanhou} 
            className="btn btn-ghost" 
            style={{ justifyContent: 'flex-start', color: 'var(--color-text-primary)', fontSize: '0.8125rem', padding: '6px 10px', fontWeight: 500, borderRadius: 'var(--radius-sm)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--color-success-subtle)', color: 'var(--color-success)', marginRight: '10px' }}>
              <ThumbsUp size={14} />
            </div>
            Marcar como Ganho
          </button>
          <button 
            onClick={onPerdeu} 
            className="btn btn-ghost" 
            style={{ justifyContent: 'flex-start', color: 'var(--color-text-primary)', fontSize: '0.8125rem', padding: '6px 10px', fontWeight: 500, borderRadius: 'var(--radius-sm)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', marginRight: '10px' }}>
              <ThumbsDown size={14} />
            </div>
            Marcar como Perdido
          </button>
          <button 
            onClick={onExcluir} 
            className="btn btn-ghost" 
            style={{ justifyContent: 'flex-start', color: 'var(--color-text-primary)', fontSize: '0.8125rem', padding: '6px 10px', fontWeight: 500, borderRadius: 'var(--radius-sm)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)', marginRight: '10px' }}>
              <Trash2 size={14} />
            </div>
            Excluir Orçamento
          </button>
        </div>
      )}

      {metaAcoes > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onVerHistorico(); }} 
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
              title="Ver Histórico de Ações"
            >
              Ações: {acoesNestaEtapa.length} / {metaAcoes}
            </button>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'right', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>⏳ {diasNaEtapa}d</span>
              <span>{pctCompleto}%</span>
              {!isGanho && <button onClick={(e) => { e.stopPropagation(); onNovaAcao(); }} className="btn btn-ghost btn-icon btn-sm" style={{ padding: 0, height: 'auto', color: 'var(--color-accent)' }} title="Registrar nova ação"><Plus size={14} /></button>}
            </div>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'var(--color-bg-base)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${pctCompleto}%`, height: '100%', background: pctCompleto >= 100 ? 'var(--color-success)' : 'var(--color-accent)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {isGanho && lead.historico_acoes && lead.historico_acoes.length > 0 && !metaAcoes && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); onVerHistorico(); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
            Ver histórico de ações
          </button>
        </div>
      )}

      {/* Indicador de dias se não houver metas (e não for ganho) */}
      {metaAcoes === 0 && !isGanho && (
        <div style={{ marginTop: '8px', fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
          ⏳ {diasNaEtapa} {diasNaEtapa === 1 ? 'dia' : 'dias'} na etapa
        </div>
      )}

      {isGanho && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600 }}>
          <ThumbsUp size={12} /> Aprovado
        </div>
      )}
    </div>
  )
}
