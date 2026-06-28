'use client'

import { useState } from 'react'
import { Edit3, X, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Cliente = {
  id: string
  nome: string
  email: string | null
  whatsapp: string | null
  instagram: string | null
  cidade: string | null
  cpf?: string | null
  rg?: string | null
  data_nascimento?: string | null
  endereco?: string | null
}

export default function EditClienteModal({ cliente }: { cliente: Cliente }) {
  const router = useRouter()
  const supabase = createClient()
  
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [nome, setNome] = useState(cliente.nome || '')
  const [email, setEmail] = useState(cliente.email || '')
  const [whatsapp, setWhatsapp] = useState(cliente.whatsapp || '')
  const [instagram, setInstagram] = useState(cliente.instagram || '')
  const [cidade, setCidade] = useState(cliente.cidade || '')
  const [cpf, setCpf] = useState(cliente.cpf || '')
  const [rg, setRg] = useState(cliente.rg || '')
  const [dataNascimento, setDataNascimento] = useState(cliente.data_nascimento || '')
  const [endereco, setEndereco] = useState(cliente.endereco || '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setError('O nome é obrigatório.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          nome,
          email: email || null,
          whatsapp: whatsapp || null,
          instagram: instagram || null,
          cidade: cidade || null,
          cpf: cpf || null,
          rg: rg || null,
          data_nascimento: dataNascimento || null,
          endereco: endereco || null
        })
        .eq('id', cliente.id)

      if (updateError) throw updateError

      setShowModal(false)
      router.refresh() // Atualiza os dados na tela principal (Server Component)
    } catch (err: any) {
      setError('Erro ao salvar os dados: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} className="btn btn-secondary btn-sm">
        <Edit3 size={15} /> Editar Dados
      </button>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Editar Cliente</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon" type="button"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && <div className="alert alert-danger" style={{ fontSize: '0.875rem' }}>{error}</div>}
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome Completo *</label>
                <input type="text" className="form-input" required value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">E-mail</label>
                  <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">WhatsApp</label>
                  <input type="text" className="form-input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Instagram</label>
                  <input type="text" className="form-input" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Cidade</label>
                  <input type="text" className="form-input" value={cidade} onChange={e => setCidade(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">CPF</label>
                  <input type="text" className="form-input" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">RG</label>
                  <input type="text" className="form-input" value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-0" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Data de Nasc.</label>
                  <input type="date" className="form-input" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Endereço Completo</label>
                  <input type="text" className="form-input" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, Número, Bairro, Cidade - UF" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
