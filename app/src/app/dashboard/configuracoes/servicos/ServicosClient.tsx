'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Tag, Trash2, Edit3, Clock, DollarSign,
  TrendingUp, Save, X, Loader2, ArrowLeft, Camera, Image as ImageIcon, Briefcase, Car,
  ChevronRight, Palette, FileText, BarChart2, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

type Cost = {
  id?: string
  nome_custo: string
  valor: number
  categoria: string
}

type Service = {
  id: string
  nome: string
  duracao_minutos: number
  valor_sugerido: number
  valor_foto_extra: number
  limite_fotos_def: number
  cor_hex: string
  descricao: string | null
  custos_servico?: Cost[]
}

type Props = {
  fotografoId: string
  servicosIniciais: Service[]
}

const PRESET_COLORS = [
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#f43f5e', label: 'Rubi' },
  { hex: '#f97316', label: 'Laranja' },
  { hex: '#f59e0b', label: 'Âmbar' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#0ea5e9', label: 'Céu' },
  { hex: '#64748b', label: 'Slate' },
]

const CATEGORY_OPTIONS = [
  { value: 'entrega', label: 'Álbum / Entrega' },
  { value: 'producao', label: 'Cenografia / Produção' },
  { value: 'equipe', label: 'Equipe / Assistentes' },
  { value: 'deslocamento', label: 'Transporte / Viagem' },
]

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 300, label: '5 horas' },
  { value: 480, label: '8h (Diária)' },
]

export default function ServicosClient({ fotografoId, servicosIniciais }: Props) {
  const supabase = createClient()
  const [servicos, setServicos] = useState<Service[]>(servicosIniciais)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [appError, setAppError] = useState<string | null>(null)

  const showError = (msg: string) => {
    setAppError(msg)
    setTimeout(() => setAppError(null), 7000)
  }
  const [error, setError] = useState('')

  // Form State
  const [formName, setFormName] = useState('')
  const [formDuration, setFormDuration] = useState(60)
  const [formPrice, setFormPrice] = useState(0)
  const [formExtraPhotoPrice, setFormExtraPhotoPrice] = useState(25)
  const [formPhotos, setFormPhotos] = useState(0)
  const [formColor, setFormColor] = useState('#6366f1')
  const [formDescription, setFormDescription] = useState('')
  const [formCosts, setFormCosts] = useState<Cost[]>([])
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null)
  const [newCategoryDraft, setNewCategoryDraft] = useState('')

  function handleOpenModal(service: Service | null = null) {
    setError('')
    if (service) {
      setEditingService(service)
      setFormName(service.nome)
      setFormDuration(service.duracao_minutos)
      setFormPrice(service.valor_sugerido)
      setFormExtraPhotoPrice(service.valor_foto_extra ?? 25)
      setFormPhotos(service.limite_fotos_def)
      setFormColor(service.cor_hex)
      setFormDescription(service.descricao ?? '')
      setFormCosts(service.custos_servico ? [...service.custos_servico] : [])
    } else {
      setEditingService(null)
      setFormName('')
      setFormDuration(60)
      setFormPrice(0)
      setFormExtraPhotoPrice(25)
      setFormPhotos(0)
      setFormColor('#6366f1')
      setFormDescription('')
      setFormCosts([])
    }
    setCustomCategories([])
    setEditingCategoryIdx(null)
    setNewCategoryDraft('')
    setShowModal(true)
  }

  function addCostItem() {
    setFormCosts(prev => [...prev, { nome_custo: '', valor: 0, categoria: 'outros' }])
  }

  function updateCostItem(index: number, field: keyof Cost, value: any) {
    setFormCosts(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function removeCostItem(index: number) {
    setFormCosts(prev => prev.filter((_, i) => i !== index))
  }

  const totalCost = formCosts.reduce((sum, c) => sum + (c.valor || 0), 0)
  const estimatedProfit = formPrice - totalCost
  const profitMargin = formPrice > 0 ? (estimatedProfit / formPrice) * 100 : 0

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setSaving(true)
    setError('')

    const servicePayload = {
      fotografo_id: fotografoId,
      nome: formName,
      duracao_minutos: formDuration,
      valor_sugerido: formPrice,
      valor_foto_extra: formExtraPhotoPrice,
      limite_fotos_def: formPhotos,
      cor_hex: formColor,
      descricao: formDescription || null,
    }

    try {
      let savedService: Service

      if (editingService) {
        const { data, error: errUpdate } = await supabase
          .from('tipos_sessao')
          .update(servicePayload)
          .eq('id', editingService.id)
          .select()
          .single()
        if (errUpdate) throw errUpdate
        savedService = data
      } else {
        const { data, error: errInsert } = await supabase
          .from('tipos_sessao')
          .insert(servicePayload)
          .select()
          .single()
        if (errInsert) throw errInsert
        savedService = data
      }

      if (editingService) {
        const { error: errDelCosts } = await supabase
          .from('custos_servico')
          .delete()
          .eq('tipo_sessao_id', editingService.id)
        if (errDelCosts) throw errDelCosts
      }

      let savedCosts: Cost[] = []
      const costsPayload = formCosts
        .filter(c => c.nome_custo.trim())
        .map(c => ({
          tipo_sessao_id: savedService.id,
          nome_custo: c.nome_custo,
          valor: c.valor,
          categoria: c.categoria,
        }))

      if (costsPayload.length > 0) {
        const { data: insertedCosts, error: errInsCosts } = await supabase
          .from('custos_servico')
          .insert(costsPayload)
          .select()
        if (errInsCosts) throw errInsCosts
        savedCosts = insertedCosts
      }

      const finalService: Service = { ...savedService, custos_servico: savedCosts }

      if (editingService) {
        setServicos(prev => prev.map(s => s.id === editingService.id ? finalService : s))
      } else {
        setServicos(prev => [...prev, finalService])
      }

      setShowModal(false)
    } catch (err: any) {
      setError('Erro ao salvar serviço: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir este tipo de serviço? Isso removerá permanentemente todos os custos vinculados.')) return
    setDeletingId(id)
    try {
      const { error: errDel } = await supabase.from('tipos_sessao').delete().eq('id', id)
      if (errDel) throw errDel
      setServicos(prev => prev.filter(s => s.id !== id))
    } catch (err: any) {
      if (err.code === '23503') {
        showError('Não é possível excluir este serviço pois existem outros dados vinculados a ele (ex: custos). Remova-os primeiro.')
      } else {
        showError('Erro ao excluir serviço: ' + err.message)
      }
    } finally {
      setDeletingId(null)
    }
  }

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  function getMarginColor(p: number) {
    if (p >= 60) return '#10b981'
    if (p >= 35) return '#f59e0b'
    return '#f43f5e'
  }

  function durationLabel(min: number) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}min` : ''}`
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/dashboard/configuracoes" className="btn btn-ghost btn-icon">
            <ArrowLeft size={16} />
          </Link>
          <span className="topbar-title">Configuração de Serviços</span>
        </div>
        <div className="topbar-actions">
          <button onClick={() => handleOpenModal()} className="btn btn-primary btn-sm">
            <Plus size={15} /> Novo Serviço
          </button>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        <div className="page-header">
          <h1 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Pacotes do Estúdio</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Configure os tipos de ensaio, seus custos diretos e visualize a margem de lucro em tempo real.
          </p>
        </div>

        {servicos.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '56px 24px', border: '1px dashed var(--color-border)' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <Tag size={26} color="var(--color-accent)" />
            </div>
            <h3 style={{ marginBottom: '8px' }}>Nenhum serviço cadastrado</h3>
            <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 24px' }}>
              Cadastre seus ensaios e coberturas para personalizar leads, propostas, contratos e agenda.
            </p>
            <button onClick={() => handleOpenModal()} className="btn btn-primary">
              <Plus size={14} /> Cadastrar Meu Primeiro Serviço
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
            {servicos.map((s) => {
              const sc = s.custos_servico ?? []
              const sCost = sc.reduce((sum, c) => sum + c.valor, 0)
              const sProfit = s.valor_sugerido - sCost
              const sMargin = s.valor_sugerido > 0 ? (sProfit / s.valor_sugerido) * 100 : 0

              return (
                <div key={s.id} className="card" style={{
                  padding: 0, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column', position: 'relative',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                }}>
                  {/* Color strip header */}
                  <div style={{
                    height: '5px',
                    background: `linear-gradient(90deg, ${s.cor_hex || '#6366f1'}, ${s.cor_hex || '#6366f1'}88)`,
                  }} />

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: s.cor_hex || '#6366f1', display: 'inline-block',
                          boxShadow: `0 0 0 3px ${s.cor_hex || '#6366f1'}30`
                        }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{s.nome}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={() => handleOpenModal(s)} className="btn btn-ghost btn-icon btn-sm" title="Editar">
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          disabled={deletingId === s.id}
                          title="Excluir"
                        >
                          {deletingId === s.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {s.descricao && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.55 }}>
                        {s.descricao}
                      </p>
                    )}

                    {/* Tags row */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.75rem', color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-base)', borderRadius: '20px',
                        padding: '3px 10px', border: '1px solid var(--color-border-subtle)'
                      }}>
                        <Clock size={11} /> {durationLabel(s.duracao_minutos)}
                      </span>
                      {s.limite_fotos_def > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.75rem', color: 'var(--color-text-secondary)',
                          background: 'var(--color-bg-base)', borderRadius: '20px',
                          padding: '3px 10px', border: '1px solid var(--color-border-subtle)'
                        }}>
                          <ImageIcon size={11} /> {s.limite_fotos_def} fotos
                        </span>
                      )}
                      {sc.length > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.75rem', color: 'var(--color-text-secondary)',
                          background: 'var(--color-bg-base)', borderRadius: '20px',
                          padding: '3px 10px', border: '1px solid var(--color-border-subtle)'
                        }}>
                          <BarChart2 size={11} /> {sc.length} {sc.length === 1 ? 'custo' : 'custos'}
                        </span>
                      )}
                    </div>

                    {/* Margin area */}
                    <div style={{
                      marginTop: 'auto',
                      background: 'var(--color-bg-base)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Preço Base</div>
                          <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{formatCurrency(s.valor_sugerido)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Lucro Líquido</div>
                          <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: sProfit >= 0 ? getMarginColor(sMargin) : 'var(--color-danger)' }}>
                            {formatCurrency(sProfit)}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ width: '100%', height: '5px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{
                          width: `${Math.max(0, Math.min(100, sMargin))}%`,
                          height: '100%',
                          background: getMarginColor(sMargin),
                          borderRadius: '3px',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Custos: {formatCurrency(sCost)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700,
                          color: getMarginColor(sMargin),
                        }}>
                          {sMargin.toFixed(0)}% margem
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>

          <div className="animate-fade-in" style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '680px',
            maxHeight: '94vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>

            {/* ── Modal Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid var(--color-border)',
              background: formColor ? `linear-gradient(135deg, ${formColor}14 0%, transparent 60%)` : undefined,
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              transition: 'background 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px',
                  background: formColor,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${formColor}55`,
                  transition: 'all 0.3s ease',
                }}>
                  <Tag size={17} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    {editingService ? 'Editar Serviço' : 'Novo Tipo de Serviço'}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {formName || 'Configure os detalhes do pacote'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* ── Scrollable Body ── */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

                {error && <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>{error}</div>}

                {/* ── Section 1: Identidade ── */}
                <section>
                  <SectionTitle icon={<Tag size={14} />} label="Identidade do Serviço" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Nome */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Nome do Serviço *</label>
                      <input
                        type="text" className="form-input" required
                        placeholder="Ex: Ensaio Gestante Externo, Cobertura de Casamento…"
                        value={formName} onChange={e => setFormName(e.target.value)}
                        style={{ fontSize: '0.9375rem' }}
                      />
                    </div>

                    {/* Descrição */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Descrição / Checklist Rápido</label>
                      <textarea
                        className="form-input" rows={2} style={{ resize: 'vertical' }}
                        placeholder="Entregáveis incluídos, dicas para a sessão, o que o cliente deve trazer…"
                        value={formDescription} onChange={e => setFormDescription(e.target.value)}
                      />
                    </div>

                    {/* Cor */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Palette size={13} /> Cor no Calendário
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.hex} type="button"
                            onClick={() => setFormColor(c.hex)}
                            title={c.label}
                            style={{
                              width: '30px', height: '30px', borderRadius: '50%',
                              background: c.hex,
                              border: formColor === c.hex ? `3px solid var(--color-text-primary)` : '2px solid transparent',
                              outline: formColor === c.hex ? `2px solid ${c.hex}` : 'none',
                              outlineOffset: '2px',
                              transform: formColor === c.hex ? 'scale(1.2)' : 'scale(1)',
                              cursor: 'pointer', transition: 'all 0.15s ease',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Section 2: Operacional ── */}
                <section>
                  <SectionTitle icon={<Clock size={14} />} label="Dados Operacionais" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Preço Sugerido (R$)</label>
                      <input
                        type="number" className="form-input" min="0" step="0.01"
                        placeholder="0,00"
                        value={formPrice || ''} onChange={e => setFormPrice(e.target.value ? parseFloat(e.target.value) : 0)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Duração</label>
                      <select className="form-select" value={formDuration} onChange={e => setFormDuration(parseInt(e.target.value))}>
                        {DURATION_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Fotos Inclusas</label>
                      <input
                        type="number" className="form-input" min="0" placeholder="Ex: 30"
                        value={formPhotos || ''} onChange={e => setFormPhotos(e.target.value ? parseInt(e.target.value) : 0)}
                      />
                    </div>
                  </div>
                </section>

                {/* ── Section 3: Custos de Execução ── */}
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <SectionTitle icon={<DollarSign size={14} />} label="Custos Diretos (COGS)" noMargin />
                    <button type="button" onClick={addCostItem} className="btn btn-secondary btn-sm">
                      <Plus size={13} /> Adicionar Custo
                    </button>
                  </div>

                  {formCosts.length === 0 ? (
                    <div style={{
                      border: '1.5px dashed var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.8125rem',
                    }}>
                      Nenhum custo direto cadastrado. Adicione itens como álbum, transporte ou equipe.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {/* Header */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1.2fr 120px 220px 36px',
                        gap: '8px', padding: '6px 10px',
                        fontSize: '0.6875rem', color: 'var(--color-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        <span>Descrição do Custo</span>
                        <span>Valor (R$)</span>
                        <span>Categoria</span>
                        <span />
                      </div>
                      {formCosts.map((cost, idx) => (
                        <div key={idx} style={{
                          display: 'grid', gridTemplateColumns: '1.2fr 120px 220px 36px',
                          gap: '8px', alignItems: 'center', padding: '6px 0',
                          borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                        }}>
                          <input
                            type="text" className="form-input"
                            style={{ fontSize: '0.875rem', padding: '7px 12px' }}
                            placeholder="Ex: Álbum Premium"
                            required
                            value={cost.nome_custo}
                            onChange={e => updateCostItem(idx, 'nome_custo', e.target.value)}
                          />
                          <input
                            type="number" className="form-input"
                            style={{ fontSize: '0.875rem', padding: '7px 12px' }}
                            placeholder="0,00" min="0" step="0.01" required
                            value={cost.valor || ''}
                            onChange={e => updateCostItem(idx, 'valor', e.target.value ? parseFloat(e.target.value) : 0)}
                          />
                          {editingCategoryIdx === idx ? (
                            <input
                              autoFocus
                              type="text"
                              className="form-input"
                              style={{ fontSize: '0.8125rem', padding: '7px 10px' }}
                              placeholder="Nome da categoria…"
                              value={newCategoryDraft}
                              onChange={e => setNewCategoryDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const val = newCategoryDraft.trim()
                                  if (val) {
                                    updateCostItem(idx, 'categoria', val)
                                    setCustomCategories(prev => prev.includes(val) ? prev : [...prev, val])
                                  }
                                  setEditingCategoryIdx(null)
                                  setNewCategoryDraft('')
                                }
                                if (e.key === 'Escape') {
                                  setEditingCategoryIdx(null)
                                  setNewCategoryDraft('')
                                }
                              }}
                              onBlur={() => {
                                const val = newCategoryDraft.trim()
                                if (val) {
                                  updateCostItem(idx, 'categoria', val)
                                  setCustomCategories(prev => prev.includes(val) ? prev : [...prev, val])
                                }
                                setEditingCategoryIdx(null)
                                setNewCategoryDraft('')
                              }}
                            />
                          ) : (
                            <select
                              className="form-select"
                              style={{ fontSize: '0.8125rem', padding: '7px 10px' }}
                              value={cost.categoria}
                              onChange={e => {
                                if (e.target.value === '__custom__') {
                                  setNewCategoryDraft('')
                                  setEditingCategoryIdx(idx)
                                } else {
                                  updateCostItem(idx, 'categoria', e.target.value)
                                }
                              }}
                            >
                              {CATEGORY_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                              {[...customCategories].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              <option disabled>──────────────</option>
                              <option value="__custom__">＋ Nova categoria…</option>
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => removeCostItem(idx)}
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Section 4: Resumo Financeiro ── */}
                <section>
                  <SectionTitle icon={<TrendingUp size={14} />} label="Resumo da Margem" />
                  <div style={{
                    background: `linear-gradient(135deg, ${getMarginColor(profitMargin)}10 0%, var(--color-bg-base) 60%)`,
                    border: `1px solid ${getMarginColor(profitMargin)}40`,
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                  }}>
                    {/* 3 col stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                      <FinStat label="Preço de Venda" value={formatCurrency(formPrice)} neutral />
                      <FinStat label="Custo Total" value={formatCurrency(totalCost)} negative={totalCost > 0} />
                      <FinStat
                        label="Lucro Líquido"
                        value={formatCurrency(estimatedProfit)}
                        color={estimatedProfit >= 0 ? getMarginColor(profitMargin) : '#f43f5e'}
                        large
                      />
                    </div>

                    {/* Progress */}
                    <div style={{ width: '100%', height: '8px', background: 'var(--color-bg-surface)', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{
                        width: `${Math.max(0, Math.min(100, profitMargin))}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${getMarginColor(profitMargin)}, ${getMarginColor(profitMargin)}bb)`,
                        borderRadius: '4px',
                        transition: 'all 0.4s ease',
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {profitMargin < 35 ? '⚠️ Margem baixa — revise os custos ou preço' :
                          profitMargin < 60 ? '✅ Margem razoável' :
                            '🚀 Excelente margem de lucro'}
                      </span>
                      <span style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: getMarginColor(profitMargin),
                      }}>
                        {profitMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </section>

              </div>

              {/* ── Footer ── */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                padding: '16px 24px', borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)',
                borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
              }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '140px' }} disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</>
                    : <><Save size={14} /> Salvar Serviço</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ── Small helper components ────────────────────────────────────────────────────

function SectionTitle({ icon, label, noMargin }: { icon: React.ReactNode; label: string; noMargin?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '7px',
      marginBottom: noMargin ? 0 : '14px',
    }}>
      <span style={{ color: 'var(--color-accent)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  )
}

function FinStat({
  label, value, color, large, neutral, negative,
}: {
  label: string
  value: string
  color?: string
  large?: boolean
  neutral?: boolean
  negative?: boolean
}) {
  return (
    <div style={{
      background: 'var(--color-bg-surface)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      display: 'flex', flexDirection: 'column', gap: '3px',
    }}>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{
        fontSize: large ? '1.125rem' : '0.9375rem',
        fontWeight: 700,
        color: color || (negative ? 'var(--color-text-secondary)' : 'var(--color-text-primary)'),
      }}>
        {value}
      </span>
    </div>
  )
}
