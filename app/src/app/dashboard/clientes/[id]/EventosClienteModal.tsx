'use client'

import { useState } from 'react'
import { CalendarHeart, X, Save, Loader2, Edit3, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Evento = {
  id?: string
  tipo_evento: string
  nome_pessoas: string
  data_evento: string
  observacao: string | null
}

export default function EventosClienteModal({ 
  clienteId, 
  eventoEdicao 
}: { 
  clienteId: string, 
  eventoEdicao?: Evento 
}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const [tipoEvento, setTipoEvento] = useState(eventoEdicao?.tipo_evento || 'aniversario')
  const [nomePessoas, setNomePessoas] = useState(eventoEdicao?.nome_pessoas || '')
  const [dataEvento, setDataEvento] = useState(eventoEdicao?.data_evento || '')
  const [observacao, setObservacao] = useState(eventoEdicao?.observacao || '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nomePessoas.trim() || !dataEvento) {
      setError('Nome e data são obrigatórios.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (eventoEdicao?.id) {
        // Edit existing
        const { error: updateError } = await supabase
          .from('clientes_eventos')
          .update({
            tipo_evento: tipoEvento,
            nome_pessoas: nomePessoas,
            data_evento: dataEvento,
            observacao: observacao || null
          })
          .eq('id', eventoEdicao.id)

        if (updateError) throw updateError
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('clientes_eventos')
          .insert({
            cliente_id: clienteId,
            tipo_evento: tipoEvento,
            nome_pessoas: nomePessoas,
            data_evento: dataEvento,
            observacao: observacao || null
          })

        if (insertError) throw insertError
        
        // Clear form after creation
        setTipoEvento('aniversario')
        setNomePessoas('')
        setDataEvento('')
        setObservacao('')
      }

      setShowModal(false)
      router.refresh()
    } catch (err: any) {
      setError('Erro ao salvar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!eventoEdicao?.id) return
    
    if (confirm('Tem certeza que deseja excluir este evento?')) {
      setIsDeleting(true)
      try {
        const { error: delError } = await supabase
          .from('clientes_eventos')
          .delete()
          .eq('id', eventoEdicao.id)
          
        if (delError) throw delError
        
        setShowModal(false)
        router.refresh()
      } catch (err: any) {
        setError('Erro ao excluir: ' + err.message)
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <>
      {eventoEdicao ? (
        <button onClick={() => setShowModal(true)} className="btn btn-ghost btn-icon btn-sm" title="Editar Evento">
          <Edit3 size={16} />
        </button>
      ) : (
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
          <Plus size={15} /> Adicionar Evento
        </button>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarHeart size={20} color="var(--color-accent)" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                  {eventoEdicao ? 'Editar Evento' : 'Novo Evento Relevante'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon" type="button"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && <div className="alert alert-danger" style={{ fontSize: '0.875rem' }}>{error}</div>}
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tipo de Evento *</label>
                <select className="form-input" value={tipoEvento} onChange={e => setTipoEvento(e.target.value)} required>
                  <option value="aniversario">Aniversário do Cliente</option>
                  <option value="aniversario_filho">Aniversário (Filho/Filha)</option>
                  <option value="bodas">Bodas / Aniversário de Casamento</option>
                  <option value="formatura">Formatura</option>
                  <option value="outros">Outros Eventos</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome da(s) Pessoa(s) *</label>
                <input type="text" className="form-input" required value={nomePessoas} onChange={e => setNomePessoas(e.target.value)} placeholder="Ex: Mariazinha" />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  De quem é esse evento? Ajuda a personalizar suas mensagens futuras.
                </div>
              </div>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Data Oficial do Evento *</label>
                <input type="date" className="form-input" required value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Coloque o ano exato de nascimento/casamento para calcular a idade/anos de casados.
                </div>
              </div>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Observações (Opcional)</label>
                <textarea className="form-input" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Detalhes que ajudam na hora da venda..." rows={2}></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <div>
                  {eventoEdicao && (
                    <button type="button" onClick={handleDelete} disabled={isDeleting} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                      {isDeleting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />} Excluir
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                    Salvar Evento
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
