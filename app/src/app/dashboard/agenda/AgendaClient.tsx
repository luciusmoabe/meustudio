'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar as CalendarIcon, Clock, MapPin, Plus,
  Loader2, Image as ImageIcon,
  CheckCircle2, X, ChevronLeft, ChevronRight,
  MoreHorizontal, Camera
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday
} from 'date-fns'
import { CalendarSync } from 'lucide-react'
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
  tiposSessao: TipoSessao[]
}

export default function AgendaClient({ fotografoId, sessoesIniciais, leadsDisponiveis, tiposSessao }: Props) {
  const supabase = createClient()
  const [sessoes, setSessoes] = useState<Sessao[]>(sessoesIniciais)
  
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
      etapa_producao_id: null,
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
        <span className="topbar-title">Agenda</span>
        <div className="topbar-actions">
          <button onClick={() => alert('Integração com Google Calendar será ativada na próxima fase (OAuth).')} className="btn btn-secondary btn-sm" title="Sincronizar com Google Calendar">
            <CalendarSync size={15} /> Sincronizar Google
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Nova Sessão
          </button>
        </div>
      </div>

      <div className="page-content animate-fade-in">

        {/* ===== CALENDÁRIO ===== */}
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
