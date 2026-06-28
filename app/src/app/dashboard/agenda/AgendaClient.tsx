'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar as CalendarIcon, Clock, MapPin, Plus,
  Kanban, Settings2, Loader2, Image as ImageIcon,
  CheckCircle2, X, ChevronLeft, ChevronRight,
  MoreHorizontal, Camera, GripVertical
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ============================================================
// TIPOS
// ============================================================
type Lead = {
  id: string
  nome_cliente: string
  tipo_servico: string
  status: string
}

type Sessao = {
  id: string
  titulo_sessao: string
  tipo_sessao: string
  data_hora_inicio: string
  data_hora_fim: string | null
  local_sessao: string | null
  status: string
  limite_fotos: number | null
  fotos_selecionadas: number | null
  leads_propostas: { id: string; nome_cliente: string; whatsapp_cliente: string | null } | null
  etapa_producao_id: string | null
  data_entrada_etapa?: string
  criado_em?: string
}

type Etapa = {
  id: string
  nome_etapa: string
  ordem: number
  cor_hex: string
}

const STATUS_SESSAO: Record<string, { label: string; color: string }> = {
  reserva_temporaria: { label: 'Reserva', color: '#fbbf24' },
  confirmada:         { label: 'Confirmada', color: '#34d399' },
  em_producao:        { label: 'Em produção', color: '#60a5fa' },
  fotografada:        { label: 'Fotografada', color: '#a78bfa' },
  em_edicao:          { label: 'Em edição', color: '#f472b6' },
  pronta_entrega:     { label: 'Pronta', color: '#14b8a6' },
  entregue:           { label: 'Entregue', color: '#10b981' },
  cancelada:          { label: 'Cancelada', color: '#ef4444' },
}

const ETAPAS_PRODUCAO_DEFAULT = [
  { nome_etapa: 'Agendado / A Fotografar', ordem: 1, cor_hex: '#34d399' },
  { nome_etapa: 'Curadoria', ordem: 2, cor_hex: '#fbbf24' },
  { nome_etapa: 'Edição (Lightroom)', ordem: 3, cor_hex: '#60a5fa' },
  { nome_etapa: 'Retoque Fino (PS)', ordem: 4, cor_hex: '#a78bfa' },
  { nome_etapa: 'Aprovação Cliente', ordem: 5, cor_hex: '#f472b6' },
]

const TIPO_SERVICO_LABEL: Record<string, string> = {
  newborn: 'Newborn', casamento: 'Casamento', corporativo: 'Corporativo',
  maternidade: 'Maternidade', familia: 'Família', gestante: 'Gestante',
  ensaio_externo: 'Ensaio', evento: 'Evento', outros: 'Outros',
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
type TipoSessao = {
  id: string
  nome: string
  duracao_minutos: number
  valor_sugerido: number
  valor_foto_extra: number
  limite_fotos_def: number
  cor_hex: string
}

type Props = {
  fotografoId: string
  fusoHorario: string
  sessoesIniciais: Sessao[]
  leadsDisponiveis: Lead[]
  etapasProducaoIniciais: Etapa[]
  tiposSessao: TipoSessao[]
}

export default function AgendaClient({ fotografoId, sessoesIniciais, leadsDisponiveis, etapasProducaoIniciais, tiposSessao }: Props) {
  const supabase = createClient()
  const [sessoes, setSessoes] = useState<Sessao[]>(sessoesIniciais)
  const [etapas, setEtapas] = useState<Etapa[]>(etapasProducaoIniciais)
  const [view, setView] = useState<'calendario' | 'kanban'>('calendario')
  const [draggedSessaoId, setDraggedSessaoId] = useState<string | null>(null)
  const [dragOverEtapaId, setDragOverEtapaId] = useState<string | null>(null)
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  
  // Calendário State
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [novaSessao, setNovaSessao] = useState({
    lead_id: '',
    titulo_sessao: '',
    tipo_sessao: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].id : 'outros',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '14:00',
    duracao: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].duracao_minutos.toString() : '120',
    local: '',
    limite: tiposSessao && tiposSessao.length > 0 && tiposSessao[0].limite_fotos_def > 0 ? tiposSessao[0].limite_fotos_def.toString() : ''
  })
  const [salvando, setSalvando] = useState(false)
  const [criandoEtapas, setCriandoEtapas] = useState(false)
  const [menuSessao, setMenuSessao] = useState<string | null>(null)

  function getServiceColor(value: string, statusColor: string) {
    const found = tiposSessao.find(t => t.id === value || t.nome.toLowerCase() === value.toLowerCase())
    return found ? found.cor_hex : statusColor
  }

  function handleServiceChange(val: string) {
    const found = tiposSessao.find(t => t.id === val || t.nome.toLowerCase() === val.toLowerCase())
    setNovaSessao(prev => ({
      ...prev,
      tipo_sessao: val,
      duracao: found ? found.duracao_minutos.toString() : prev.duracao,
      limite: found && found.limite_fotos_def > 0 ? found.limite_fotos_def.toString() : prev.limite
    }))
  }

  // ============================================================
  // CALENDÁRIO
  // ============================================================
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  })

  // ============================================================
  // KANBAN (Esteira de Produção)
  // ============================================================
  async function criarEtapasPadrao() {
    setCriandoEtapas(true)
    const novas = []
    for (const e of ETAPAS_PRODUCAO_DEFAULT) {
      const { data } = await supabase
        .from('etapas_pipeline')
        .insert({ ...e, fotografo_id: fotografoId, tipo_pipeline: 'producao' })
        .select()
        .single()
      if (data) novas.push(data)
    }
    setEtapas(novas)
    setCriandoEtapas(false)
  }

  // Mapeamento etapa → status conforme BPM
  const ETAPA_STATUS_MAP: Record<string, string> = {
    'Agendado / A Fotografar': 'confirmada',
    'Curadoria':               'fotografada',
    'Edição (Lightroom)':      'em_edicao',
    'Retoque Fino (PS)':       'em_edicao',
    'Aprovação Cliente':       'pronta_entrega',
  }

  async function moverParaEtapa(sessaoId: string, etapaId: string) {
    const etapa = etapas.find(e => e.id === etapaId)
    const novoStatus = (etapa && ETAPA_STATUS_MAP[etapa.nome_etapa]) ? ETAPA_STATUS_MAP[etapa.nome_etapa] : 'em_producao'
    await supabase.from('sessoes_agenda').update({ etapa_producao_id: etapaId, status: novoStatus }).eq('id', sessaoId)
    setSessoes(prev => prev.map(s => s.id === sessaoId ? { 
      ...s, 
      etapa_producao_id: etapaId, 
      status: novoStatus,
      data_entrada_etapa: new Date().toISOString()
    } : s))
    
    setDraggedSessaoId(null)
    setDragOverEtapaId(null)
    setMenuSessao(null)
  }

  async function reordenarEtapas(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    
    const newEtapas = [...etapas]
    const draggedIndex = newEtapas.findIndex(e => e.id === draggedId)
    const targetIndex = newEtapas.findIndex(e => e.id === targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) return
    
    const [draggedItem] = newEtapas.splice(draggedIndex, 1)
    newEtapas.splice(targetIndex, 0, draggedItem)
    
    const updatedEtapas = newEtapas.map((e, index) => ({
      ...e,
      ordem: index + 1
    }))
    
    setEtapas(updatedEtapas)
    
    for (const e of updatedEtapas) {
      await supabase.from('etapas_pipeline').update({ ordem: e.ordem }).eq('id', e.id)
    }
  }

  async function marcarStatus(sessaoId: string, status: string) {
    await supabase.from('sessoes_agenda').update({ status }).eq('id', sessaoId)
    setSessoes(prev => prev.map(s => s.id === sessaoId ? { ...s, status } : s))
    setMenuSessao(null)
  }

  // ============================================================
  // CRIAR SESSÃO
  // ============================================================
  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!novaSessao.lead_id || !novaSessao.titulo_sessao) return
    setSalvando(true)

    const inicio = new Date(`${novaSessao.data_inicio}T${novaSessao.hora_inicio}:00`)
    const fim = new Date(inicio.getTime() + parseInt(novaSessao.duracao) * 60000)
    
    const servico = tiposSessao.find(t => t.id === novaSessao.tipo_sessao)
    const valorFotoExtra = servico?.valor_foto_extra ?? 25.00

    const payload = {
      fotografo_id: fotografoId,
      lead_id: novaSessao.lead_id,
      titulo_sessao: novaSessao.titulo_sessao,
      tipo_sessao: novaSessao.tipo_sessao,
      data_hora_inicio: inicio.toISOString(),
      data_hora_fim: fim.toISOString(),
      duracao_minutos: parseInt(novaSessao.duracao),
      local_sessao: novaSessao.local || null,
      limite_fotos: novaSessao.limite ? parseInt(novaSessao.limite) : null,
      valor_foto_extra: valorFotoExtra,
      status: 'reserva_temporaria', // P-02: sessão criada manualmente começa como reserva até sinal ser pago
      etapa_producao_id: etapas.length > 0 ? etapas[0].id : null,
    }

    const { data, error } = await supabase.from('sessoes_agenda').insert(payload).select(`
      *, leads_propostas (id, nome_cliente, whatsapp_cliente)
    `).single()

    if (!error && data) {
      setSessoes(prev => [...prev, data])
      setShowModal(false)
      setNovaSessao({
        lead_id: '',
        titulo_sessao: '',
        tipo_sessao: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].id : 'outros',
        data_inicio: format(new Date(), 'yyyy-MM-dd'),
        hora_inicio: '14:00',
        duracao: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].duracao_minutos.toString() : '120',
        local: '',
        limite: tiposSessao && tiposSessao.length > 0 && tiposSessao[0].limite_fotos_def > 0 ? tiposSessao[0].limite_fotos_def.toString() : ''
      })
    } else {
      alert('Erro ao criar sessão: ' + error?.message)
    }
    setSalvando(false)
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Agenda & Produção</span>
        <div className="topbar-actions">
          <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg-base)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            {(['calendario', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-secondary' : 'btn-ghost'}`} style={{ padding: '5px 12px' }}>
                {v === 'calendario' ? <><CalendarIcon size={14} /> Calendário</> : <><Kanban size={14} /> Esteira</>}
              </button>
            ))}
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Nova Sessão
          </button>
        </div>
      </div>

      <div className="page-content animate-fade-in">

        {/* ===== CALENDÁRIO ===== */}
        {view === 'calendario' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, textTransform: 'capitalize' }}>
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn btn-ghost btn-icon"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentDate(new Date())} className="btn btn-ghost btn-sm" style={{ fontWeight: 500 }}>Hoje</button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn btn-ghost btn-icon"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border)' }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, auto)' }}>
              {daysInMonth.map((day, i) => {
                const sessoesDia = sessoes.filter(s => isSameDay(parseISO(s.data_hora_inicio), day))
                const hoje = isToday(day)
                return (
                  <div key={day.toISOString()} style={{
                    borderRight: '1px solid var(--color-border-subtle)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    padding: '8px',
                    background: !isSameMonth(day, currentDate) ? 'var(--color-bg-base)' : 'var(--color-bg-surface)',
                    opacity: !isSameMonth(day, currentDate) ? 0.5 : 1,
                    gridColumnStart: i === 0 ? day.getDay() + 1 : 'auto',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <span style={{
                        width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%', fontSize: '0.8125rem', fontWeight: 600,
                        background: hoje ? 'var(--color-accent)' : 'transparent',
                        color: hoje ? 'white' : 'var(--color-text-primary)'
                      }}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {sessoesDia.map(sessao => {
                        const st = STATUS_SESSAO[sessao.status] ?? STATUS_SESSAO.reserva_temporaria
                        const eventColor = getServiceColor(sessao.tipo_sessao, st.color)
                        return (
                          <div key={sessao.id} style={{
                            background: `${eventColor}15`,
                            borderLeft: `2px solid ${eventColor}`,
                            padding: '4px 6px', borderRadius: '0 4px 4px 0',
                            fontSize: '0.7rem', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: '2px',
                          }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {format(parseISO(sessao.data_hora_inicio), 'HH:mm')} • {sessao.titulo_sessao}
                            </div>
                            <div style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sessao.leads_propostas?.nome_cliente}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ===== ESTEIRA DE PRODUÇÃO (KANBAN) ===== */}
        {view === 'kanban' && (
          <>
            {etapas.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Settings2 size={24} color="var(--color-accent)" />
                </div>
                <h3 style={{ marginBottom: '8px' }}>Configure sua esteira de produção</h3>
                <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto 24px' }}>
                  Crie as colunas para gerenciar o pós-venda: curadoria, edição, retoque, entrega.
                </p>
                <button onClick={criarEtapasPadrao} className="btn btn-primary" disabled={criandoEtapas}>
                  {criandoEtapas ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Criando...</> : <><Plus size={14} /> Criar esteira padrão</>}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
                {etapas.map(etapa => {
                  const sessoesEtapa = sessoes.filter(s => s.etapa_producao_id === etapa.id && !['cancelada', 'entregue'].includes(s.status))
                  return (
                    <div key={etapa.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!draggedColumnId && !draggedSessaoId) return;
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

                        const sessaoId = e.dataTransfer.getData('sessaoId');
                        if (sessaoId) moverParaEtapa(sessaoId, etapa.id);
                      }}
                      data-type="column"
                      style={{
                      minWidth: '280px', width: '280px',
                      background: dragOverEtapaId === etapa.id ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)',
                      border: `1px solid ${dragOverEtapaId === etapa.id ? etapa.cor_hex : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex', flexDirection: 'column',
                      maxHeight: 'calc(100vh - 180px)',
                      transition: 'all 0.2s ease',
                      opacity: draggedColumnId === etapa.id ? 0.5 : 1,
                    }}>
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
                        padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderTop: `3px solid ${etapa.cor_hex}`, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                        cursor: 'grab',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <GripVertical size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{etapa.nome_etapa}</span>
                          <span style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600 }}>
                            {sessoesEtapa.length}
                          </span>
                        </div>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sessoesEtapa.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            Nenhuma sessão aqui
                          </div>
                        )}
                        {sessoesEtapa.map(sessao => (
                          <div key={sessao.id} 
                            draggable={true}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData('sessaoId', sessao.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setTimeout(() => setDraggedSessaoId(sessao.id), 0)
                            }}
                            onDragEnd={() => setDraggedSessaoId(null)}
                            style={{ 
                              background: 'var(--color-bg-elevated)', 
                              border: '1px solid var(--color-border)', 
                              borderRadius: 'var(--radius-md)', 
                              padding: '12px', position: 'relative',
                              cursor: 'grab',
                              opacity: draggedSessaoId === sessao.id ? 0.4 : 1,
                              transition: 'border-color 0.2s, opacity 0.2s'
                            }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{sessao.titulo_sessao}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>{sessao.leads_propostas?.nome_cliente}</div>
                              </div>
                              <div style={{ position: 'relative' }}>
                                <button onClick={() => setMenuSessao(menuSessao === sessao.id ? null : sessao.id)} className="btn btn-ghost btn-icon" style={{ padding: '3px' }}>
                                  <MoreHorizontal size={15} />
                                </button>
                                {menuSessao === sessao.id && (
                                  <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: '160px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '4px 8px', fontWeight: 600, textTransform: 'uppercase' }}>Mover para etapa</div>
                                    {etapas.map(e => (
                                      <button key={e.id} onClick={() => moverParaEtapa(sessao.id, e.id)} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', fontSize: '0.8125rem' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.cor_hex, marginRight: '6px' }} /> {e.nome_etapa}
                                      </button>
                                    ))}
                                    <hr className="divider" style={{ margin: '4px 0' }} />
                                    <button onClick={() => marcarStatus(sessao.id, 'pronta_entrega')} className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--color-success)', fontSize: '0.8125rem' }}>
                                      <CheckCircle2 size={13} style={{ marginRight: '6px' }} /> Marcar Pronta
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {(() => {
                              const dataRef = sessao.data_entrada_etapa || sessao.criado_em || sessao.data_hora_inicio;
                              const diasNaEtapa = Math.floor((Date.now() - new Date(dataRef).getTime()) / (1000 * 60 * 60 * 24));
                              return (
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'right', marginBottom: '6px' }}>
                                  ⏳ {diasNaEtapa} {diasNaEtapa === 1 ? 'dia' : 'dias'} na etapa
                                </div>
                              );
                            })()}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                <Clock size={11} /> {format(parseISO(sessao.data_hora_inicio), 'dd/MM/yyyy HH:mm')}
                              </div>
                              {sessao.local_sessao && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  <MapPin size={11} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessao.local_sessao}</span>
                                </div>
                              )}
                              {sessao.limite_fotos && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                  <ImageIcon size={11} /> {sessao.fotos_selecionadas ?? 0} / {sessao.limite_fotos} selecionadas
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Coluna Prontas / Entregues */}
                <div style={{ minWidth: '280px', width: '280px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '3px solid var(--color-success)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="var(--color-success)" />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-success)' }}>Prontas / Entregues</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sessoes.filter(s => ['pronta_entrega', 'entregue'].includes(s.status)).map(sessao => (
                      <div key={sessao.id} style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', padding: '12px', boxShadow: '0 0 10px rgba(52,211,153,0.1)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px', color: 'var(--color-success)' }}>{sessao.titulo_sessao}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{sessao.leads_propostas?.nome_cliente}</div>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          {sessao.status === 'entregue' ? 'Entregue ✓' : 'Aguardando seleção'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* ===== MODAL NOVA SESSÃO ===== */}
      {showModal && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon" style={{ position: 'absolute', top: '16px', right: '16px' }}><X size={18} /></button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={20} color="var(--color-accent)" /> Agendar Sessão
            </h2>
            
            <form onSubmit={handleSalvar} className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Contrato / Cliente *</label>
                <select className="form-select" required value={novaSessao.lead_id} onChange={e => setNovaSessao(p => ({ ...p, lead_id: e.target.value }))}>
                  <option value="">Selecione um cliente aprovado...</option>
                  {leadsDisponiveis.map(l => (
                    <option key={l.id} value={l.id}>{l.nome_cliente} ({l.status})</option>
                  ))}
                </select>
                {leadsDisponiveis.length === 0 && <span className="form-hint" style={{ color: 'var(--color-warning)' }}>Nenhum contrato aprovado ainda.</span>}
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Título da Sessão *</label>
                <input type="text" className="form-input" required placeholder="Ex: Ensaio Gestante Externa" value={novaSessao.titulo_sessao} onChange={e => setNovaSessao(p => ({ ...p, titulo_sessao: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Sessão</label>
                <select className="form-select" value={novaSessao.tipo_sessao} onChange={e => handleServiceChange(e.target.value)}>
                  {tiposSessao && tiposSessao.length > 0
                    ? tiposSessao.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)
                    : Object.entries(TIPO_SERVICO_LABEL).map(([val, label]) => <option key={val} value={val}>{label}</option>)
                  }
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Data de Início *</label>
                <input type="date" className="form-input" required value={novaSessao.data_inicio} onChange={e => setNovaSessao(p => ({ ...p, data_inicio: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Horário *</label>
                <input type="time" className="form-input" required value={novaSessao.hora_inicio} onChange={e => setNovaSessao(p => ({ ...p, hora_inicio: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Duração (min)</label>
                <input type="number" className="form-input" required min="15" step="15" value={novaSessao.duracao} onChange={e => setNovaSessao(p => ({ ...p, duracao: e.target.value }))} />
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Local</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input type="text" className="form-input" placeholder="Endereço ou local da foto" style={{ paddingLeft: '34px' }} value={novaSessao.local} onChange={e => setNovaSessao(p => ({ ...p, local: e.target.value }))} />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Limite de Fotos (Galeria) - Opcional</label>
                <input type="number" className="form-input" placeholder="Ex: 30" value={novaSessao.limite} onChange={e => setNovaSessao(p => ({ ...p, limite: e.target.value }))} />
                <span className="form-hint">Ativa cobrança extra se o cliente selecionar mais fotos (RF18)</span>
              </div>

              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando || leadsDisponiveis.length === 0}>
                  {salvando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : 'Criar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
