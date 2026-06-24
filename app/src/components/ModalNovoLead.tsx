'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, User, Phone, Mail, Calendar,
  DollarSign, Tag, Save, Loader2, AlignLeft
} from 'lucide-react'

const ORIGENS = ['Instagram', 'Indicação', 'Google', 'WhatsApp', 'Facebook', 'Site', 'Feira/Evento', 'Outro']

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

type Etapa = {
  id: string
  nome_etapa: string
  pacote_id?: string | null
}

type Props = {
  fotografoId: string
  etapas: Etapa[]
  onLeadCriado: (lead: Record<string, unknown>) => void
  onClose: () => void
  tiposSessao: TipoSessao[]
}

export default function ModalNovoLead({ fotografoId, etapas, onLeadCriado, onClose, tiposSessao }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const firstService = tiposSessao && tiposSessao.length > 0 ? tiposSessao[0] : null
  
  const [form, setForm] = useState({
    nome_cliente: '',
    whatsapp_cliente: '',
    email_cliente: '',
    tipo_servico: firstService ? firstService.id : '',
    data_pretendida: '',
    valor_estimado: firstService && firstService.valor_sugerido > 0 ? firstService.valor_sugerido.toString() : '',
    origem_lead: '',
    etapa_pipeline_id: '',
  })

  // Estado para armazenar as respostas do formulário dinâmico
  const [respostas, setRespostas] = useState<Record<string, any>>({})

  const selectedService = tiposSessao?.find(t => t.id === form.tipo_servico)
  const formFields = selectedService?.servico_formularios?.sort((a, b) => a.ordem - b.ordem) || []

  // Filtrar o pipeline (se o pacote tiver um funil exclusivo, usa ele. Senão, usa o padrão)
  const funilExclusivo = etapas.filter(e => e.pacote_id === form.tipo_servico)
  const funilPadrão = etapas.filter(e => !e.pacote_id)
  const etapasVisiveis = funilExclusivo.length > 0 ? funilExclusivo : funilPadrão

  useEffect(() => {
    // Ao mudar o serviço, se a etapa selecionada não existir no funil do novo serviço, atualiza para a primeira disponível
    if (etapasVisiveis.length > 0 && !etapasVisiveis.find(e => e.id === form.etapa_pipeline_id)) {
      setForm(prev => ({ ...prev, etapa_pipeline_id: etapasVisiveis[0].id }))
    }
  }, [form.tipo_servico, etapasVisiveis, form.etapa_pipeline_id])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleServiceChange(val: string) {
    const srv = tiposSessao?.find(t => t.id === val)
    setForm(prev => ({
      ...prev,
      tipo_servico: val,
      valor_estimado: srv && srv.valor_sugerido > 0 ? srv.valor_sugerido.toString() : prev.valor_estimado
    }))
    // Limpa as respostas do briefing quando troca o serviço
    setRespostas({})
  }

  function handleRespostaChange(pergunta: string, tipo: string, valor: any) {
    setRespostas(prev => ({ ...prev, [pergunta]: valor }))
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
      
      // Retrocompatibilidade: salvar o ID na nova coluna e o Nome na coluna antiga
      pacote_id: form.tipo_servico || null,
      tipo_servico: selectedService?.nome || 'outros',
      
      data_pretendida: form.data_pretendida || null,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      origem_lead: form.origem_lead || null,
      etapa_pipeline_id: form.etapa_pipeline_id || null,
      status: 'novo',
      
      // Respostas do formulário dinâmico
      respostas_formulario: respostas,
    }

    const { data, error: errInsert } = await supabase
      .from('leads_propostas')
      .insert(payload)
      .select()
      .single()

    if (errInsert) {
      setError('Erro ao criar orçamento: ' + errInsert.message)
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
        width: '100%', maxWidth: '640px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--color-accent-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="var(--color-accent)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Novo Orçamento / Lead</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Crie a jornada do seu cliente</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {error && <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label"><Tag size={12} style={{ display: 'inline', marginRight: '5px' }} /> Pacote / Serviço Pretendido</label>
                <select className="form-select" value={form.tipo_servico} onChange={e => handleServiceChange(e.target.value)} style={{ fontWeight: 600, fontSize: '0.9375rem', padding: '10px 12px' }}>
                  {tiposSessao?.map(t => (
                    <option key={t.id} value={t.id}>{t.is_pacote ? '📦 ' : '📸 '}{t.nome}</option>
                  ))}
                  {(!tiposSessao || tiposSessao.length === 0) && <option value="">Cadastre um serviço nas Configurações</option>}
                </select>
              </div>

              {/* Informações Básicas do Lead */}
              <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-base)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><User size={12} style={{ display: 'inline', marginRight: '5px' }} /> Nome do Cliente *</label>
                  <input type="text" className="form-input" placeholder="Ex: Maria das Graças" value={form.nome_cliente} onChange={e => update('nome_cliente', e.target.value)} required autoFocus />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label"><Phone size={12} style={{ display: 'inline', marginRight: '5px' }} /> WhatsApp</label>
                    <input type="tel" className="form-input" placeholder="+55 11 99999-0000" value={form.whatsapp_cliente} onChange={e => update('whatsapp_cliente', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label"><Mail size={12} style={{ display: 'inline', marginRight: '5px' }} /> E-mail</label>
                    <input type="email" className="form-input" placeholder="maria@email.com" value={form.email_cliente} onChange={e => update('email_cliente', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Formulário Dinâmico (Briefing) */}
              {formFields.length > 0 && (
                <div style={{ padding: '16px', border: '1px solid var(--color-accent-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-subtle)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <AlignLeft size={14} /> Briefing do Pacote
                  </div>
                  {formFields.map(field => (
                    <div key={field.id} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ color: 'var(--color-text-primary)' }}>
                        {field.pergunta} {field.obrigatorio && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                      </label>
                      {field.tipo_resposta === 'texto' && (
                        <input type="text" className="form-input" style={{ background: 'var(--color-bg-surface)' }} required={field.obrigatorio} value={respostas[field.pergunta] || ''} onChange={e => handleRespostaChange(field.pergunta, 'texto', e.target.value)} />
                      )}
                      {field.tipo_resposta === 'numero' && (
                        <input type="number" className="form-input" style={{ background: 'var(--color-bg-surface)' }} required={field.obrigatorio} value={respostas[field.pergunta] || ''} onChange={e => handleRespostaChange(field.pergunta, 'numero', Number(e.target.value))} />
                      )}
                      {field.tipo_resposta === 'data' && (
                        <input type="date" className="form-input" style={{ background: 'var(--color-bg-surface)' }} required={field.obrigatorio} value={respostas[field.pergunta] || ''} onChange={e => handleRespostaChange(field.pergunta, 'data', e.target.value)} />
                      )}
                      {field.tipo_resposta === 'booleano' && (
                        <select className="form-select" style={{ background: 'var(--color-bg-surface)' }} required={field.obrigatorio} value={respostas[field.pergunta] !== undefined ? String(respostas[field.pergunta]) : ''} onChange={e => handleRespostaChange(field.pergunta, 'booleano', e.target.value === 'true')}>
                           <option value="">Selecione...</option>
                           <option value="true">Sim</option>
                           <option value="false">Não</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Informações Comerciais */}
              <div className="form-grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><Calendar size={12} style={{ display: 'inline', marginRight: '5px' }} /> Data do Evento/Sessão</label>
                  <input type="date" className="form-input" value={form.data_pretendida} onChange={e => update('data_pretendida', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label"><DollarSign size={12} style={{ display: 'inline', marginRight: '5px' }} /> Valor da Proposta (R$)</label>
                  <input type="number" className="form-input" min="0" step="0.01" value={form.valor_estimado} onChange={e => update('valor_estimado', e.target.value)} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Origem do Contato</label>
                  <select className="form-select" value={form.origem_lead} onChange={e => update('origem_lead', e.target.value)}>
                    <option value="">Selecione...</option>
                    {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                {etapasVisiveis.length > 0 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Funil / Jornada</label>
                    <select className="form-select" value={form.etapa_pipeline_id} onChange={e => update('etapa_pipeline_id', e.target.value)}>
                      {etapasVisiveis.map(e => <option key={e.id} value={e.id}>{e.nome_etapa}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-surface)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
              {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando Orçamento...</> : <><Save size={14} /> Criar Orçamento no CRM</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
