'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Edit2, Trash2, X, Building, Camera, Megaphone, Users, Receipt, Monitor, Car, Circle, DollarSign, Image as ImageIcon, Book, Coffee, ShoppingBag, CreditCard, Briefcase, Plane, Heart, Home, Gift, Star, Zap, Activity } from 'lucide-react'

interface Categoria {
  id: string
  fotografo_id: string
  nome: string
  tipo: 'RECEITA' | 'DESPESA'
  icone: string
  cor: string
}

interface Props {
  fotografoId: string
}

// Mapa de ícones permitidos para categorias
const iconMap: Record<string, React.ElementType> = {
  'building': Building,
  'camera': Camera,
  'megaphone': Megaphone,
  'users': Users,
  'receipt': Receipt,
  'monitor': Monitor,
  'car': Car,
  'circle': Circle,
  'dollar-sign': DollarSign,
  'image': ImageIcon,
  'book': Book,
  'coffee': Coffee,
  'shopping-bag': ShoppingBag,
  'credit-card': CreditCard,
  'briefcase': Briefcase,
  'plane': Plane,
  'heart': Heart,
  'home': Home,
  'gift': Gift,
  'star': Star,
  'zap': Zap,
  'activity': Activity,
}

// Componente para renderizar ícone dinâmico
const DynamicIcon = ({ name, color, size = 20 }: { name: string, color: string, size?: number }) => {
  const IconComponent = iconMap[name] || Circle
  return <IconComponent size={size} color={color} />
}

export default function CategoriasClient({ fotografoId }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'DESPESA' | 'RECEITA'>('DESPESA')

  const [showModal, setShowModal] = useState(false)
  const [editCat, setEditCat] = useState<Categoria | null>(null)

  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA')
  const [formCor, setFormCor] = useState('#6366f1')
  const [formIcone, setFormIcone] = useState('circle')

  const [appError, setAppError] = useState<string | null>(null)
  const [appSuccess, setAppSuccess] = useState<string | null>(null)

  const showError = (msg: string) => { setAppError(msg); setTimeout(() => setAppError(null), 5000) }
  const showSuccess = (msg: string) => { setAppSuccess(msg); setTimeout(() => setAppSuccess(null), 5000) }

  const fetchCategorias = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/financeiro/categorias?fotografo_id=${fotografoId}`)
      const data = await res.json()
      if (res.ok) {
        setCategorias(data.categorias)
      } else {
        showError(data.error)
      }
    } catch (e: any) {
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fotografoId])

  useEffect(() => {
    fetchCategorias()
  }, [fetchCategorias])

  const openModalNovo = () => {
    setEditCat(null)
    setFormNome('')
    setFormTipo(activeTab)
    setFormCor('#6366f1')
    setFormIcone('circle')
    setShowModal(true)
  }

  const openModalEdit = (cat: Categoria) => {
    setEditCat(cat)
    setFormNome(cat.nome)
    setFormTipo(cat.tipo)
    setFormCor(cat.cor || '#6366f1')
    setFormIcone(cat.icone || 'circle')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        fotografo_id: fotografoId,
        nome: formNome,
        tipo: formTipo,
        cor: formCor,
        icone: formIcone
      }

      const method = editCat ? 'PUT' : 'POST'
      const finalPayload = editCat ? { ...payload, id: editCat.id } : payload

      const res = await fetch('/api/financeiro/categorias', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar categoria.')
      
      showSuccess('Categoria salva com sucesso!')
      setShowModal(false)
      fetchCategorias()
    } catch (e: any) {
      showError(e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta categoria? Ela não deve estar vinculada a lançamentos existentes.')) return

    try {
      const res = await fetch(`/api/financeiro/categorias?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao deletar categoria.')

      showSuccess('Categoria excluída.')
      fetchCategorias()
    } catch (e: any) {
      showError(e.message)
    }
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === activeTab)

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/dashboard/configuracoes" className="btn btn-ghost btn-sm" style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </Link>
          <span className="topbar-title">Categorias Financeiras</span>
        </div>
        <button onClick={openModalNovo} className="btn btn-primary btn-sm">
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      <div className="page-content animate-fade-in">
        {(appError || appSuccess) && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 500, fontSize: '0.875rem',
            background: appError ? 'var(--color-danger-subtle)' : 'var(--color-success-subtle)',
            color: appError ? 'var(--color-danger)' : 'var(--color-success)',
            border: `1px solid ${appError ? 'var(--color-danger)' : 'var(--color-success)'}`
          }}>
            {appError || appSuccess}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => setActiveTab('DESPESA')}
            className={`btn ${activeTab === 'DESPESA' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Despesas
          </button>
          <button
            onClick={() => setActiveTab('RECEITA')}
            className={`btn ${activeTab === 'RECEITA' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Receitas
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Carregando...</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {categoriasFiltradas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Nenhuma categoria de {activeTab.toLowerCase()} encontrada.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Ícone & Cor</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600 }}>Nome</th>
                    <th style={{ padding: '12px 24px', fontWeight: 600, width: '100px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasFiltradas.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '12px',
                          background: `${c.cor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <DynamicIcon name={c.icone} color={c.cor} size={20} />
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 500 }}>
                        {c.nome}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => openModalEdit(c)} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} title="Editar">
                            <Edit2 size={16} color="var(--color-text-secondary)" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="btn btn-ghost btn-sm" style={{ padding: '6px' }} title="Excluir">
                            <Trash2 size={16} color="var(--color-danger)" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{editCat ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Nome da Categoria</label>
                <input 
                  required 
                  value={formNome} 
                  onChange={e => setFormNome(e.target.value)} 
                  className="form-input" 
                  placeholder="Ex: Aluguel, Equipamentos..." 
                  maxLength={50}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select value={formTipo} onChange={e => setFormTipo(e.target.value as any)} className="form-select">
                    <option value="DESPESA">Despesa</option>
                    <option value="RECEITA">Receita</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cor de Destaque</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={formCor} 
                      onChange={e => setFormCor(e.target.value)}
                      style={{ 
                        width: '40px', height: '40px', padding: '0', 
                        border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer' 
                      }} 
                    />
                    <input 
                      type="text" 
                      value={formCor} 
                      onChange={e => setFormCor(e.target.value)}
                      className="form-input" 
                      style={{ flex: 1 }}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Escolha um Ícone</label>
                <div style={{ 
                  display: 'flex', flexWrap: 'wrap', gap: '8px', 
                  padding: '16px', background: 'var(--color-bg-elevated)', borderRadius: '12px', border: '1px solid var(--color-border)' 
                }}>
                  {Object.keys(iconMap).map(iconName => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormIcone(iconName)}
                      style={{
                        width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: formIcone === iconName ? `${formCor}30` : 'transparent',
                        border: `2px solid ${formIcone === iconName ? formCor : 'transparent'}`,
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      title={iconName}
                    >
                      <DynamicIcon name={iconName} color={formIcone === iconName ? formCor : 'var(--color-text-secondary)'} size={20} />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Categoria</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
