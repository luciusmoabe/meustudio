'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, User, Phone, Mail, Calendar,
  DollarSign, Tag, Save, Loader2
} from 'lucide-react'

const TIPOS_SESSAO = [
  { value: 'newborn', label: 'Newborn' },
  { value: 'casamento', label: 'Casamento' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'maternidade', label: 'Maternidade' },
  { value: 'familia', label: 'Família' },
  { value: 'gestante', label: 'Gestante' },
  { value: 'ensaio_externo', label: 'Ensaio Externo' },
  { value: 'evento', label: 'Evento' },
  { value: 'outros', label: 'Outros' },
]

const ORIGENS = ['Instagram', 'Indicação', 'Google', 'WhatsApp', 'Facebook', 'Site', 'Feira/Evento', 'Outro']

type TipoSessao = {
  id: string
  nome: string
  valor_sugerido: number
  duracao_minutos: number
  limite_fotos_def: number
  cor_hex: string
  descricao: string | null
}

type Props = {
  fotografoId: string
  etapas: { id: string; nome_etapa: string }[]
  onLeadCriado: (lead: Record<string, unknown>) => void
  onClose: () => void
  tiposSessao: TipoSessao[]
}

export default function ModalNovoLead({ fotografoId, etapas, onLeadCriado, onClose, tiposSessao }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nome_cliente: '',
    whatsapp_cliente: '',
    email_cliente: '',
    tipo_servico: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].id : 'outros',
    data_pretendida: '',
    valor_estimado: tiposSessao && tiposSessao.length > 0 && tiposSessao[0].valor_sugerido > 0 
      ? tiposSessao[0].valor_sugerido.toString() 
      : '',
    origem_lead: '',
    etapa_pipeline_id: etapas[0]?.id ?? '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleServiceChange(val: string) {
    const selectedService = tiposSessao?.find(t => t.id === val || t.nome.toLowerCase() === val.toLowerCase())
    setForm(prev => ({
      ...prev,
      tipo_servico: val,
      valor_estimado: selectedService && selectedService.valor_sugerido > 0
        ? selectedService.valor_sugerido.toString()
        : prev.valor_estimado
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      fotografo_id: fotografoId,
      nome_cliente: form.nome_cliente,
      whatsapp_cliente: form.whatsapp_cliente || null,
      email_cliente: form.email_cliente || null,
      tipo_servico: form.tipo_servico,
      data_pretendida: form.data_pretendida || null,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      origem_lead: form.origem_lead || null,
      etapa_pipeline_id: form.etapa_pipeline_id || null,
      status: 'novo',
    }

    const { data, error } = await supabase
      .from('leads_propostas')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setError('Erro ao salvar lead: ' + error.message)
      setSaving(false)
    } else {
      onLeadCriado(data)
      onClose()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky', top: 0,
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'var(--color-accent-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={16} color="var(--color-accent)" />
            </div>
            <h2 data-testid="modal-title-novo-lead" style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', fontWeight: 600, margin: 0 }}>Novo Lead</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">
              <User size={12} style={{ display: 'inline', marginRight: '5px' }} />
              Nome do Cliente *
            </label>
            <input
              data-testid="input-nome-cliente"
              type="text" className="form-input"
              placeholder="Nome completo"
              value={form.nome_cliente}
              onChange={e => update('nome_cliente', e.target.value)}
              required autoFocus
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                <Phone size={12} style={{ display: 'inline', marginRight: '5px' }} />
                WhatsApp
              </label>
              <input
                data-testid="input-whatsapp-cliente"
                type="tel" className="form-input"
                placeholder="+55 11 99999-0000"
                value={form.whatsapp_cliente}
                onChange={e => update('whatsapp_cliente', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Mail size={12} style={{ display: 'inline', marginRight: '5px' }} />
                E-mail
              </label>
              <input
                data-testid="input-email-cliente"
                type="email" className="form-input"
                placeholder="cliente@email.com"
                value={form.email_cliente}
                onChange={e => update('email_cliente', e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                <Tag size={12} style={{ display: 'inline', marginRight: '5px' }} />
                Tipo de Serviço
              </label>
              <select data-testid="select-tipo-servico" className="form-select" value={form.tipo_servico} onChange={e => handleServiceChange(e.target.value)}>
                {tiposSessao && tiposSessao.length > 0
                  ? tiposSessao.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)
                  : TIPOS_SESSAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                }
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <Calendar size={12} style={{ display: 'inline', marginRight: '5px' }} />
                Data Pretendida
              </label>
              <input
                type="date" className="form-input"
                value={form.data_pretendida}
                onChange={e => update('data_pretendida', e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">
                <DollarSign size={12} style={{ display: 'inline', marginRight: '5px' }} />
                Valor Estimado (R$)
              </label>
              <input
                data-testid="input-valor-estimado"
                type="number" className="form-input"
                placeholder="1200"
                min="0" step="0.01"
                value={form.valor_estimado}
                onChange={e => update('valor_estimado', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Origem do Lead</label>
              <select className="form-select" value={form.origem_lead} onChange={e => update('origem_lead', e.target.value)}>
                <option value="">Selecione...</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {etapas.length > 0 && (
            <div className="form-group">
              <label className="form-label">Etapa do Funil</label>
              <select className="form-select" value={form.etapa_pipeline_id} onChange={e => update('etapa_pipeline_id', e.target.value)}>
                {etapas.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving} data-testid="btn-salvar-lead">
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
                : <><Save size={14} /> Salvar Lead</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
