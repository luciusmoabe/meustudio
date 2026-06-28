'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import {
  GripVertical,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  MapPin,
  Image as ImageIcon,
  Settings2,
  Loader2,
  Plus,
  X,
  Trash2
} from 'lucide-react'

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

const PRESET_COLORS = [
  { hex: '#ef4444', label: 'Vermelho' },
  { hex: '#f97316', label: 'Laranja' },
  { hex: '#fbbf24', label: 'Amarelo' },
  { hex: '#84cc16', label: 'Lima' },
  { hex: '#22c55e', label: 'Verde' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#0ea5e9', label: 'Ciano' },
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#a855f7', label: 'Roxo' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#64748b', label: 'Ardósia' },
]

type JornadaClienteKanbanProps = {
  sessoesIniciais: any[]
  etapasProducaoIniciais: any[]
  fotografoId: string
  tiposSessao: any[]
}

export default function JornadaClienteKanban({
  sessoesIniciais,
  etapasProducaoIniciais,
  fotografoId,
  tiposSessao
}: JornadaClienteKanbanProps) {
  const supabase = createClient()
  const [sessoes, setSessoes] = useState(sessoesIniciais)
  const [etapas, setEtapas] = useState(etapasProducaoIniciais)
  
  // Drag and Drop States
  const [draggedSessaoId, setDraggedSessaoId] = useState<string | null>(null)
  const [dragOverEtapaId, setDragOverEtapaId] = useState<string | null>(null)
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)
  const [menuSessao, setMenuSessao] = useState<string | null>(null)
  const [criandoEtapas, setCriandoEtapas] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [formEtapas, setFormEtapas] = useState<any[]>([])
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [draggedFormIdx, setDraggedFormIdx] = useState<number | null>(null)

  const openSettings = () => {
    setFormEtapas(JSON.parse(JSON.stringify(etapas)))
    setShowSettings(true)
  }

  const addFormEtapa = () => {
    setFormEtapas([...formEtapas, { id: `temp_${Date.now()}`, nome_etapa: '', ordem: formEtapas.length + 1, cor_hex: '#64748b', tipo_pipeline: 'producao', pacote_id: null, fotografo_id: fotografoId }])
  }

  const updateFormEtapa = (index: number, field: string, value: any) => {
    const novas = [...formEtapas]
    novas[index][field] = value
    setFormEtapas(novas)
  }

  const removeFormEtapa = (index: number) => {
    const novas = [...formEtapas]
    novas.splice(index, 1)
    setFormEtapas(novas)
  }

  const salvarConfiguracao = async () => {
    setSalvandoConfig(true)
    try {
      const payload = formEtapas.map((e, i) => {
        const item = { ...e, ordem: i + 1 }
        if (item.id && item.id.startsWith('temp_')) delete item.id
        return item
      })

      const idsMantidos = formEtapas.filter(e => e.id && !e.id.startsWith('temp_')).map(e => e.id)
      
      let queryDelete = supabase.from('etapas_pipeline').delete().eq('tipo_pipeline', 'producao').is('pacote_id', null).eq('fotografo_id', fotografoId)
      if (idsMantidos.length > 0) {
        queryDelete = queryDelete.not('id', 'in', `(${idsMantidos.join(',')})`)
      }
      await queryDelete

      if (payload.length > 0) {
        const { data, error } = await supabase.from('etapas_pipeline').upsert(payload).select()
        if (error) throw error
        if (data) setEtapas(data.sort((a, b) => a.ordem - b.ordem))
      } else {
        setEtapas([])
      }

      setShowSettings(false)
    } catch (err: any) {
      alert('Erro ao salvar configuração: ' + err.message)
    }
    setSalvandoConfig(false)
  }

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

  return (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px' }}>
            <button onClick={openSettings} className="btn btn-secondary btn-sm">
              <Settings2 size={14} /> Configurar Esteira
            </button>
          </div>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start', minHeight: '600px' }}>
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
      </div>
      )}

      {showSettings && (
        <div className="modal-overlay animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowSettings(false)} className="btn btn-ghost btn-icon" style={{ position: 'absolute', top: '16px', right: '16px' }}><X size={18} /></button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={20} color="var(--color-accent)" /> Configurar Esteira Padrão
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '20px' }}>
              Defina as etapas de produção que as sessões devem passar. Arraste para reordenar.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {formEtapas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}>Nenhuma etapa configurada.</div>
              ) : (
                formEtapas.map((etapa, idx) => (
                  <div key={idx} 
                    draggable
                    onDragStart={() => setDraggedFormIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedFormIdx === null || draggedFormIdx === idx) return
                      const novas = [...formEtapas]
                      const [moved] = novas.splice(draggedFormIdx, 1)
                      novas.splice(idx, 0, moved)
                      setFormEtapas(novas)
                      setDraggedFormIdx(null)
                    }}
                    style={{ 
                      display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)', padding: '12px', borderRadius: 'var(--radius-md)', gap: '8px', border: '1px solid var(--color-border)',
                      opacity: draggedFormIdx === idx ? 0.4 : 1, transition: 'opacity 0.2s'
                    }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <GripVertical size={16} color="var(--color-text-muted)" style={{ cursor: 'grab' }} />
                      <div style={{ flex: 1 }}>
                        <input type="text" className="form-input" style={{ fontSize: '0.875rem' }} placeholder="Nome da etapa" value={etapa.nome_etapa} onChange={e => updateFormEtapa(idx, 'nome_etapa', e.target.value)} required />
                      </div>
                      <select className="form-select" style={{ width: '120px', fontSize: '0.875rem' }} value={etapa.cor_hex} onChange={e => updateFormEtapa(idx, 'cor_hex', e.target.value)}>
                        {PRESET_COLORS.map(c => <option key={c.hex} value={c.hex}>{c.label}</option>)}
                      </select>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: etapa.cor_hex, flexShrink: 0 }}></span>
                      <button type="button" onClick={() => removeFormEtapa(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} title="Remover Etapa"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))
              )}
              <button type="button" onClick={addFormEtapa} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                <Plus size={14} /> Adicionar Etapa
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
              <button type="button" onClick={() => setShowSettings(false)} className="btn btn-ghost">Cancelar</button>
              <button type="button" onClick={salvarConfiguracao} className="btn btn-primary" disabled={salvandoConfig}>
                {salvandoConfig ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : 'Salvar Etapas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
