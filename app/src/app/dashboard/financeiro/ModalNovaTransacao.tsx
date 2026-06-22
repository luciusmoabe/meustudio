'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Categoria { id: string; nome: string; tipo: string }
interface Conta { id: string; nome: string }
interface Cartao { id: string; nome: string }

interface Props {
  fotografoId: string
  categorias: Categoria[]
  contas: Conta[]
  cartoes: Cartao[]
  initialType: 'DESPESA' | 'RECEITA'
  onClose: () => void
  onSuccess: () => void
  showError: (msg: string) => void
}

export default function ModalNovaTransacao({
  fotografoId, categorias, contas, cartoes, initialType, onClose, onSuccess, showError
}: Props) {
  const router = useRouter()
  
  const [tipo, setTipo] = useState<'DESPESA' | 'RECEITA' | 'TRANSFERENCIA'>(initialType)
  const [isPaga, setIsPaga] = useState(false)
  const [formaPag, setFormaPag] = useState<'DEBITO' | 'CREDITO' | 'PIX' | 'DINHEIRO'>('DEBITO')
  const [isParcelado, setIsParcelado] = useState(false)
  const [isRecorrente, setIsRecorrente] = useState(false)

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (tipo === 'TRANSFERENCIA') return // Não suportado no MVP

    const fd = new FormData(e.currentTarget)
    try {
      const payload = {
        fotografo_id: fotografoId,
        tipo,
        descricao: fd.get('descricao'),
        valor_previsto: Number(fd.get('valor_previsto')?.toString().replace(',', '.') || 0),
        data_vencimento: fd.get('data_vencimento'),
        categoria_id: fd.get('categoria_id') || null,
        status: isPaga ? 'PAGO' : 'PENDENTE',
        natureza: isRecorrente ? 'FIXA' : 'VARIAVEL',
        recorrente: isRecorrente,
        recorrencia_meses: isRecorrente ? Number(fd.get('recorrencia_meses')) : null,
        recorrente_ate: isRecorrente ? fd.get('recorrente_ate') || null : null,
        forma_pagamento: formaPag,
        conta_id: fd.get('conta_id') || null,
        cartao_id: formaPag === 'CREDITO' ? (fd.get('cartao_id') || null) : null,
        total_parcelas: (formaPag === 'CREDITO' && isParcelado) ? Number(fd.get('total_parcelas')) : 1,
      }

      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const d = await res.json()
        showError(d.error || 'Erro ao salvar transação')
        return
      }
      onSuccess()
    } catch (err: any) {
      showError(err.message)
    }
  }

  // Estilos inline reaproveitáveis do design system
  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '10px', textAlign: 'center' as const, cursor: 'pointer',
    border: `1px solid ${active ? (tipo === 'DESPESA' ? 'var(--color-danger)' : 'var(--color-primary)') : 'var(--color-border)'}`,
    background: active ? (tipo === 'DESPESA' ? 'var(--color-danger-subtle)' : 'var(--color-bg-elevated)') : 'transparent',
    color: active ? (tipo === 'DESPESA' ? 'var(--color-danger)' : 'var(--color-text)') : 'var(--color-text-muted)',
    fontWeight: active ? 600 : 400,
    borderRadius: '8px',
    transition: 'all 0.2s'
  })

  const formaPagBtn = (val: typeof formaPag, label: string) => (
    <button type="button" onClick={() => setFormaPag(val)} style={{
      flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.875rem',
      border: `1px solid ${formaPag === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: formaPag === val ? 'var(--color-primary-subtle)' : 'transparent',
      color: formaPag === val ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: formaPag === val ? 600 : 400
    }}>{label}</button>
  )

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipo)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Nova Transação</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20} /></button>
        </div>

        {/* Tipo Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--color-bg-elevated)', padding: '4px', borderRadius: '12px' }}>
          <div style={tabStyle(tipo === 'DESPESA')} onClick={() => setTipo('DESPESA')}>Despesa</div>
          <div style={tabStyle(tipo === 'RECEITA')} onClick={() => setTipo('RECEITA')}>Receita</div>
          <div style={{ ...tabStyle(false), opacity: 0.5, cursor: 'not-allowed' }} title="Em breve">Transferência</div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Descricao & Valor */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input name="descricao" required className="form-input" placeholder="Digite a descrição..." />
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$)</label>
              <input name="valor_previsto" type="number" step="0.01" required className="form-input" placeholder="0,00" />
            </div>
          </div>

          {/* Data & Checkbox Paga */}
          <div className="form-grid-2" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Data de Pagamento</label>
              <input name="data_vencimento" type="date" required className="form-input" />
            </div>
            <div className="form-group" style={{ paddingBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={isPaga} onChange={(e) => setIsPaga(e.target.checked)} />
                Marcar como paga
              </label>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="form-group">
            <label className="form-label">Forma de Pagamento</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {formaPagBtn('DEBITO', 'Débito')}
              {formaPagBtn('CREDITO', 'Crédito')}
              {formaPagBtn('PIX', 'PIX')}
              {formaPagBtn('DINHEIRO', 'Dinheiro')}
            </div>
          </div>

          {/* Conta / Cartão */}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Conta</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select name="conta_id" className="form-select" style={{ flex: 1 }} required={isPaga}>
                  <option value="">Selecione a conta</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button type="button" onClick={() => { onClose(); router.push('/dashboard/financeiro?aba=contas') }} className="btn btn-secondary" style={{ padding: '0 12px' }} title="Ir para Contas & Cartões"><Plus size={16} /></button>
              </div>
            </div>

            {formaPag === 'CREDITO' && (
              <div className="form-group">
                <label className="form-label">Cartão de Crédito</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select name="cartao_id" className="form-select" style={{ flex: 1 }} required>
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button type="button" onClick={() => { onClose(); router.push('/dashboard/financeiro?aba=contas') }} className="btn btn-secondary" style={{ padding: '0 12px' }} title="Ir para Contas & Cartões"><Plus size={16} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Parcelamento Toggle (Se Crédito) */}
          {formaPag === 'CREDITO' && (
            <div className="form-group" style={{ padding: '16px', background: 'var(--color-bg-elevated)', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                <input type="checkbox" checked={isParcelado} onChange={(e) => setIsParcelado(e.target.checked)} />
                Parcelamento
              </label>
              
              {isParcelado && (
                <div style={{ marginTop: '12px' }}>
                  <label className="form-label">Número de Parcelas</label>
                  <input name="total_parcelas" type="number" min="2" max="48" defaultValue="2" className="form-input" style={{ width: '100%' }} />
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select name="categoria_id" className="form-select" style={{ flex: 1 }}>
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button type="button" onClick={() => { onClose(); router.push('/dashboard/configuracoes/categorias') }} className="btn btn-secondary" style={{ padding: '0 12px' }} title="Gerenciar Categorias"><Plus size={16} /></button>
            </div>
          </div>

          {/* Recorrência */}
          <div className="form-group" style={{ padding: '16px', background: 'var(--color-bg-elevated)', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              <input type="checkbox" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} />
              Transação Recorrente
            </label>

            {isRecorrente && (
              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Repete a cada (meses)</label>
                  <input name="recorrencia_meses" type="number" min="1" defaultValue="1" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Até o mês de</label>
                  <input name="recorrente_ate" type="month" className="form-input" />
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar Transação</button>
          </div>
        </form>
      </div>
    </div>
  )
}
