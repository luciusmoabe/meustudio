'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, AlertTriangle, Loader2, ThumbsDown } from 'lucide-react'

const MOTIVOS = [
  { value: 'preco', label: '💸 Preço — achou caro' },
  { value: 'falta_de_data', label: '📅 Falta de data disponível' },
  { value: 'escolheu_concorrente', label: '🏃 Escolheu concorrente' },
  { value: 'sumiu', label: '👻 Sumiu / sem resposta' },
  { value: 'outro', label: '📝 Outro motivo' },
]

type Props = {
  lead: { id: string; nome_cliente: string }
  onClose: () => void
  onConfirm: (leadId: string, motivo: string, obs: string) => void
}

export default function ModalPerdeu({ lead, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!motivo) return
    setSaving(true)
    await onConfirm(lead.id, motivo, observacao)
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="animate-fade-in" style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: '440px',
        boxShadow: '0 0 40px rgba(248,113,113,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'var(--color-danger-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ThumbsDown size={15} color="var(--color-danger)" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Lead Perdido</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px', background: 'var(--color-danger-subtle)', borderRadius: 'var(--radius-md)' }}>
            <AlertTriangle size={16} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', margin: 0 }}>
              O lead <strong>{lead.nome_cliente}</strong> será arquivado. Registre o motivo para alimentar suas métricas de perda.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo da Perda *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {MOTIVOS.map(m => (
                <label key={m.value} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px',
                  border: `1px solid ${motivo === m.value ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: motivo === m.value ? 'var(--color-danger-subtle)' : 'var(--color-bg-elevated)',
                  transition: 'all var(--transition-fast)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                }}>
                  <input
                    type="radio" name="motivo"
                    value={m.value}
                    checked={motivo === m.value}
                    onChange={() => setMotivo(m.value)}
                    style={{ accentColor: 'var(--color-danger)' }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observações internas (opcional)</label>
            <textarea
              className="form-textarea"
              placeholder="Detalhes adicionais sobre a perda..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              style={{ minHeight: '80px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn btn-danger"
              style={{ flex: 2 }}
              disabled={!motivo || saving}
            >
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Arquivando...</>
                : <><ThumbsDown size={14} /> Confirmar Perda</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
