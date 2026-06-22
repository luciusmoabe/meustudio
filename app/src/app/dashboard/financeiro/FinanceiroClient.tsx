'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle, Plus, X, Check,
  ArrowDownCircle, ArrowUpCircle, Calendar, FileText, BarChart3,
  Wallet, AlertCircle, Trash2, Edit3, ChevronLeft, ChevronRight
} from 'lucide-react'
import ModalNovaTransacao from './ModalNovaTransacao'

// ============================================================
// TIPOS
// ============================================================
interface Categoria {
  id: string; nome: string; tipo: string; icone: string; cor: string
}
interface Conta {
  id: string; nome: string; tipo: string; saldo_inicial: number
}
interface Cartao {
  id: string; nome: string; dia_fechamento: number; dia_vencimento: number; limite: number | null
}
interface Lancamento {
  id: string; tipo: string; descricao: string; valor_previsto: number
  valor_realizado: number | null; data_vencimento: string; data_pagamento: string | null
  status: string; categoria_id: string | null; observacao: string | null
  conta_id: string | null; cartao_id: string | null; forma_pagamento: string | null
  parcela_atual: number | null; total_parcelas: number | null
  financeiro_categorias?: { nome: string; icone: string; cor: string } | null
  financeiro_contas?: { nome: string } | null
  financeiro_cartoes?: { nome: string } | null
}
interface Props {
  fotografoId: string
  nomeStudio: string
  hojeStr: string
}

type TabKey = 'fluxo' | 'pagar' | 'receber' | 'dre' | 'contas'

// ============================================================
// HELPERS
// ============================================================
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
const getMesStr = (offset: number = 0) => {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const nomeMes = (mesStr: string) => {
  const [y, m] = mesStr.split('-')
  const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[Number(m)]}/${y.slice(2)}`
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function FinanceiroClient({ fotografoId, nomeStudio, parcelasIniciais, hojeStr }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('fluxo')
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de mês — separados por aba
  const [mesFiltro, setMesFiltro] = useState(getMesStr(0))

  // Modais
  const [novaTransacaoModal, setNovaTransacaoModal] = useState<'DESPESA' | 'RECEITA' | null>(null)
  const [editLanc, setEditLanc] = useState<Lancamento | null>(null)
  const [baixaLanc, setBaixaLanc] = useState<Lancamento | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)
  const [editingCartao, setEditingCartao] = useState<Cartao | null>(null)

  // Erros
  const [appError, setAppError] = useState<string | null>(null)
  const showError = (msg: string) => { setAppError(msg); setTimeout(() => setAppError(null), 7000) }

  // Filtros DRE — mês separado
  const [dreMes, setDreMes] = useState(getMesStr(0))

  // ============================================================
  // FETCH DATA
  // ============================================================
  const fetchLancamentos = useCallback(async () => {
    try {
      const res = await fetch(`/api/financeiro?fotografo_id=${fotografoId}`)
      const data = await res.json()
      if (data.lancamentos) setLancamentos(data.lancamentos)
    } catch (e) { console.error(e) }
  }, [fotografoId])

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch(`/api/financeiro/categorias?fotografo_id=${fotografoId}`)
      const data = await res.json()
      if (data.categorias) setCategorias(data.categorias)
    } catch (e) { console.error(e) }
  }, [fotografoId])

  const fetchContasCartoes = useCallback(async () => {
    try {
      const [resC, resCard] = await Promise.all([
        fetch(`/api/financeiro/contas?fotografo_id=${fotografoId}`),
        fetch(`/api/financeiro/cartoes?fotografo_id=${fotografoId}`)
      ])
      const dataC = await resC.json()
      const dataCard = await resCard.json()
      if (dataC.contas) setContas(dataC.contas)
      if (dataCard.cartoes) setCartoes(dataCard.cartoes)
    } catch (e) { console.error(e) }
  }, [fotografoId])

  useEffect(() => {
    Promise.all([fetchLancamentos(), fetchCategorias(), fetchContasCartoes()]).then(() => setLoading(false))
  }, [fetchLancamentos, fetchCategorias, fetchContasCartoes])

  // ============================================================
  // DADOS COMPUTADOS — REGIME DE CAIXA
  // ============================================================

  // KPIs do mês atual
  const mesAtual = getMesStr(0)

  const kpiPagar = useMemo(() => {
    const despesasPendentes = lancamentos.filter(l =>
      l.tipo === 'DESPESA' &&
      (l.status === 'PENDENTE' || l.status === 'ATRASADO') &&
      l.data_vencimento.startsWith(mesAtual)
    )
    return despesasPendentes.reduce((a, l) => a + l.valor_previsto, 0)
  }, [lancamentos, mesAtual])

  const kpiReceber = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'RECEITA' && (l.status === 'PENDENTE' || l.status === 'ATRASADO') && l.data_vencimento.startsWith(mesAtual))
      .reduce((a, l) => a + l.valor_previsto, 0)
  }, [lancamentos, mesAtual])

  const kpiAtrasado = useMemo(() => {
    return lancamentos
      .filter(l => l.status === 'ATRASADO')
      .reduce((a, l) => a + l.valor_previsto, 0)
  }, [lancamentos])

  const kpiRecebido = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'RECEITA' && l.status === 'PAGO' && (l.data_pagamento || l.data_vencimento).startsWith(mesAtual))
      .reduce((a, l) => a + (l.valor_realizado || l.valor_previsto), 0)
  }, [lancamentos, mesAtual])

  // ============================================================
  // DRE — REGIME DE CAIXA
  // ============================================================
  const dreReceitas = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'RECEITA' && l.status === 'PAGO' && l.data_pagamento?.startsWith(dreMes))
      .reduce((a, l) => a + (l.valor_realizado || l.valor_previsto), 0)
  }, [lancamentos, dreMes])

  const dreDespesasList = useMemo(() =>
    lancamentos.filter(l =>
      l.tipo === 'DESPESA' && l.status === 'PAGO' && l.data_pagamento?.startsWith(dreMes)
    ),
    [lancamentos, dreMes]
  )

  const dreTotalDespesas = useMemo(() =>
    dreDespesasList.reduce((a, l) => a + (l.valor_realizado || l.valor_previsto), 0),
    [dreDespesasList]
  )

  const drePorCategoria = useMemo(() => {
    const acc: Record<string, number> = {}
    dreDespesasList.forEach(l => {
      const cat = l.financeiro_categorias?.nome || 'Sem categoria'
      acc[cat] = (acc[cat] || 0) + (l.valor_realizado || l.valor_previsto)
    })
    return acc
  }, [dreDespesasList])

  const dreResultado = dreReceitas - dreTotalDespesas
  const dreMargemLucro = dreReceitas > 0 ? ((dreResultado / dreReceitas) * 100) : 0

  // ============================================================
  // FLUXO UNIFICADO
  // ============================================================
  type FluxoItem = {
    id: string; tipo: 'DESPESA' | 'RECEITA'; descricao: string; valor: number
    data_vencimento: string; status: string; categoria: string; catCor: string
    raw: Lancamento
  }

  const todosFluxoItems: FluxoItem[] = useMemo(() => [
    ...lancamentos.map(l => ({
      id: l.id,
      tipo: l.tipo as 'DESPESA' | 'RECEITA',
      descricao: l.descricao,
      valor: l.valor_realizado || l.valor_previsto,
      data_vencimento: l.data_vencimento,
      status: l.status,
      categoria: l.financeiro_categorias?.nome || '—',
      catCor: l.financeiro_categorias?.cor || '#94a3b8',
      raw: l,
    }))
  ].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)), [lancamentos])

  // Filtrado por mês
  const fluxoItemsFiltrados = useMemo(() =>
    todosFluxoItems.filter(i => i.data_vencimento.startsWith(mesFiltro)),
    [todosFluxoItems, mesFiltro]
  )

  const despesasFiltradas = useMemo(() =>
    fluxoItemsFiltrados.filter(i => i.tipo === 'DESPESA'),
    [fluxoItemsFiltrados]
  )

  const receitasFiltradas = useMemo(() =>
    fluxoItemsFiltrados.filter(i => i.tipo === 'RECEITA'),
    [fluxoItemsFiltrados]
  )

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleUpdateLanc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editLanc) return
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/financeiro', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editLanc.id,
          descricao: fd.get('descricao'),
          valor_previsto: Number(fd.get('valor_previsto')),
          data_vencimento: fd.get('data_vencimento'),
          categoria_id: fd.get('categoria_id') || null,
          forma_pagamento: fd.get('forma_pagamento') || null,
          conta_id: fd.get('conta_id') || null,
          observacao: fd.get('observacao') || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); showError(d.error || 'Erro ao atualizar'); return }
      setEditLanc(null)
      fetchLancamentos()
    } catch (e: any) { showError(e.message) }
  }

  const handleBaixaLanc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!baixaLanc) return
    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/financeiro', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: baixaLanc.id,
          status: 'PAGO',
          valor_realizado: Number(fd.get('valor_realizado')),
          data_pagamento: fd.get('data_pagamento'),
          conta_id: fd.get('conta_id') || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); showError(d.error || 'Erro ao dar baixa'); return }
      setBaixaLanc(null)
      fetchLancamentos()
    } catch (e: any) { showError(e.message) }
  }



  const handleDeleteLanc = async (id: string) => {
    try {
      const res = await fetch(`/api/financeiro?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); showError(d.error || 'Erro ao excluir'); return }
      setConfirmDelete(null)
      fetchLancamentos()
    } catch (e: any) { showError(e.message) }
  }

  // ============================================================
  // BADGE HELPERS
  // ============================================================
  const statusBadge = (status: string) => {
    const s = status.toUpperCase()
    const map: Record<string, { color: string; label: string }> = {
      PAGO:      { color: 'var(--color-success)', label: 'Pago' },
      PENDENTE:  { color: 'var(--color-warning)', label: 'Pendente' },
      ATRASADO:  { color: 'var(--color-danger)', label: 'Atrasado' },
      CANCELADO: { color: 'var(--color-text-muted)', label: 'Cancelado' },
    }
    const { color, label } = map[s] || { color: 'var(--color-text-muted)', label: status }
    return (
      <span style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color, padding: '4px 10px', borderRadius: '99px',
        fontSize: '0.6875rem', fontWeight: 600, border: `1px solid ${color}`,
        textTransform: 'uppercase', letterSpacing: '0.03em'
      }}>{label}</span>
    )
  }

  const tipoBadge = (tipo: string) => {
    const isReceita = tipo === 'RECEITA'
    const color = isReceita ? 'var(--color-success)' : 'var(--color-danger)'
    return (
      <span style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color, padding: '3px 8px', borderRadius: '6px',
        fontSize: '0.6875rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px'
      }}>
        {isReceita ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
        {isReceita ? 'Receita' : 'Despesa'}
      </span>
    )
  }

  // ============================================================
  // SELETOR DE MÊS
  // ============================================================
  const MesSeletor = ({ value, onChange }: { value: string; onChange: (m: string) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        type="button" onClick={() => { const d = new Date(value + '-01'); d.setMonth(d.getMonth() - 1); onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
        className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }}
      ><ChevronLeft size={14} /></button>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', minWidth: '90px', textAlign: 'center' }}>{nomeMes(value)}</span>
      <button
        type="button" onClick={() => { const d = new Date(value + '-01'); d.setMonth(d.getMonth() + 1); onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
        className="btn btn-secondary btn-sm" style={{ padding: '6px 8px' }}
      ><ChevronRight size={14} /></button>
    </div>
  )

  // ============================================================
  // TABS
  // ============================================================
  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'fluxo', label: 'Fluxo de Caixa', icon: Wallet },
    { key: 'pagar', label: 'Contas a Pagar', icon: TrendingDown },
    { key: 'receber', label: 'Contas a Receber', icon: TrendingUp },
    { key: 'dre', label: 'DRE', icon: BarChart3 },
    { key: 'contas', label: 'Contas & Cartões', icon: FileText },
  ]

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Financeiro</span>
      </div>

      <div className="page-content animate-fade-in">
        {/* HEADER */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #34d399, #059669)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(52, 211, 153, 0.25)'
            }}>
              <DollarSign size={24} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.375rem', marginBottom: '2px' }}>Financeiro</h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Centro de controle financeiro de {nomeStudio} · Regime de Caixa
              </p>
            </div>
          </div>
        </div>

        {/* ERROR BANNER */}
        {appError && (
          <div style={{ margin: '0 0 16px 0', padding: '16px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />{appError}
          </div>
        )}

        {/* KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'A Receber (Mês)', value: fmt(kpiReceber), color: 'var(--color-info)', icon: TrendingUp, sub: 'contratos + avulso' },
            { label: 'Já Recebido (Mês)', value: fmt(kpiRecebido), color: 'var(--color-success)', icon: ArrowDownCircle, sub: 'regime de caixa' },
            { label: 'A Pagar (Mês)', value: fmt(kpiPagar), color: 'var(--color-warning)', icon: TrendingDown, sub: 'pendentes + vencidos' },
            { label: 'Em Atraso', value: fmt(kpiAtrasado), color: 'var(--color-danger)', icon: AlertTriangle, sub: 'despesas + parcelas' },
          ].map((kpi, i) => {
            const Icon = kpi.icon
            return (
              <div key={i} className="card premium-card" style={{ padding: '20px' }}>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '80px', height: '80px', background: kpi.color, filter: 'blur(40px)', opacity: 0.15, borderRadius: '50%' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: `color-mix(in srgb, ${kpi.color} 15%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={16} color={kpi.color} />
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', marginBottom: '2px', letterSpacing: '-0.03em' }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{kpi.label}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '2px', opacity: 0.7 }}>{kpi.sub}</div>
              </div>
            )
          })}
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--color-bg-surface)', borderRadius: '12px', padding: '4px', border: '1px solid var(--color-border)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: '8px', border: 'none',
                  background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  fontWeight: isActive ? 600 : 400, fontSize: '0.8125rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Icon size={14} />{tab.label}
              </button>
            )
          })}
        </div>

        {/* TAB: FLUXO DE CAIXA */}
        {activeTab === 'fluxo' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Movimentações — Visão Unificada</h2>
              <MesSeletor value={mesFiltro} onChange={setMesFiltro} />
            </div>
            {renderTable(fluxoItemsFiltrados, true)}
          </div>
        )}

        {/* TAB: CONTAS A PAGAR */}
        {activeTab === 'pagar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <MesSeletor value={mesFiltro} onChange={setMesFiltro} />
              <button className="btn btn-primary btn-sm" onClick={() => setNovaTransacaoModal('DESPESA')}>
                <Plus size={14} /> Nova Despesa
              </button>
            </div>
            {renderGruposDespesas(despesasFiltradas)}
          </div>
        )}

        {/* TAB: CONTAS A RECEBER */}
        {activeTab === 'receber' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <MesSeletor value={mesFiltro} onChange={setMesFiltro} />
              <button className="btn btn-primary btn-sm" onClick={() => setNovaTransacaoModal('RECEITA')} style={{ background: 'var(--color-success)', border: 'none' }}>
                <Plus size={14} /> Nova Receita
              </button>
            </div>
            {renderGruposReceitas(receitasFiltradas)}
          </div>
        )}

        {/* TAB: DRE */}
        {activeTab === 'dre' && renderDRE()}

        {/* TAB: CONTAS E CARTÕES */}
        {activeTab === 'contas' && renderContasCartoes()}

      </div>

      {/* ============================================================
          MODAIS
      ============================================================ */}

      {/* MODAL: NOVA TRANSAÇÃO */}
      {novaTransacaoModal && (
        <ModalNovaTransacao
          fotografoId={fotografoId}
          categorias={categorias}
          contas={contas}
          cartoes={cartoes}
          initialType={novaTransacaoModal}
          onClose={() => setNovaTransacaoModal(null)}
          onSuccess={() => { setNovaTransacaoModal(null); fetchLancamentos(); }}
          showError={showError}
        />
      )}

      {/* MODAL: EDITAR LANÇAMENTO */}
      {editLanc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <form onSubmit={handleUpdateLanc} className="card" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Editar {editLanc.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</h3>
              <button type="button" onClick={() => setEditLanc(null)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input name="descricao" required className="form-input" defaultValue={editLanc.descricao} />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input name="valor_previsto" type="number" step="0.01" required className="form-input" defaultValue={editLanc.valor_previsto} />
              </div>
              <div className="form-group">
                <label className="form-label">Vencimento</label>
                <input name="data_vencimento" type="date" required className="form-input" defaultValue={editLanc.data_vencimento} />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Forma de Pagamento</label>
                <select name="forma_pagamento" className="form-select" defaultValue={editLanc.forma_pagamento || ''}>
                  <option value="">Não informado</option>
                  <option value="PIX">PIX</option>
                  <option value="DEBITO">Débito</option>
                  <option value="CREDITO">Crédito</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Conta</label>
                <select name="conta_id" className="form-select" defaultValue={editLanc.conta_id || ''}>
                  <option value="">Nenhuma</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select name="categoria_id" className="form-select" defaultValue={editLanc.categoria_id || ''}>
                <option value="">Sem categoria</option>
                {categorias.filter(c => c.tipo === editLanc.tipo).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observação</label>
              <textarea name="observacao" className="form-textarea" style={{ minHeight: '60px' }} defaultValue={editLanc.observacao || ''}></textarea>
            </div>

            <button type="submit" className="btn btn-primary">Atualizar</button>
          </form>
        </div>
      )}

      {/* MODAL: DAR BAIXA — LANÇAMENTO */}
      {baixaLanc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleBaixaLanc} className="card" style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{baixaLanc.tipo === 'RECEITA' ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}</h3>
              <button type="button" onClick={() => setBaixaLanc(null)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: '8px', fontSize: '0.875rem' }}>
              <strong>{baixaLanc.descricao}</strong>
              <div style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Valor previsto: {fmt(baixaLanc.valor_previsto)} · Vencimento: {fmtDate(baixaLanc.data_vencimento)}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor Realizado (R$)</label>
                <input name="valor_realizado" type="number" step="0.01" required className="form-input" defaultValue={baixaLanc.valor_previsto} />
              </div>
              <div className="form-group">
                <label className="form-label">{baixaLanc.tipo === 'RECEITA' ? 'Data do Recebimento' : 'Data do Pagamento'}</label>
                <input name="data_pagamento" type="date" required className="form-input" defaultValue={hojeStr} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{baixaLanc.tipo === 'RECEITA' ? 'Em qual conta entrou?' : 'De qual conta saiu?'}</label>
              <select name="conta_id" className="form-select">
                <option value="">Não informado</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-success)', border: 'none' }}>
              <Check size={16} /> {baixaLanc.tipo === 'RECEITA' ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
            </button>
          </form>
        </div>
      )}


    </>
  )

  // ============================================================
  // SUB-RENDER: TABELA GENÉRICA
  // ============================================================
  function renderTable(items: FluxoItem[], showTipo: boolean) {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>

    if (items.length === 0) {
      return (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <DollarSign size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p>Nenhum lançamento encontrado neste período.</p>
        </div>
      )
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-elevated)', fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Vencimento</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Descrição</th>
              {showTipo && <th style={{ padding: '10px 20px', fontWeight: 600 }}>Tipo</th>}
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Categoria</th>
              <th style={{ padding: '10px 20px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '10px 20px', fontWeight: 600, textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '10px 20px', fontWeight: 600, textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isAtrasado = item.status === 'ATRASADO'
              return (
                <tr key={item.id}
                  style={{ borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 20px', color: isAtrasado ? 'var(--color-danger)' : 'var(--color-text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {fmtDate(item.data_vencimento)}
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 500, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.descricao}
                  </td>
                  {showTipo && <td style={{ padding: '14px 20px' }}>{tipoBadge(item.tipo)}</td>}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.catCor, flexShrink: 0 }}></span>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>{item.categoria}</span>
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>{statusBadge(item.status)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', color: item.tipo === 'RECEITA' ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                    {item.tipo === 'RECEITA' ? '+' : '-'} {fmt(item.valor)}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      {(item.status === 'PENDENTE' || item.status === 'ATRASADO') && (
                        <button
                          className="btn btn-ghost btn-sm" title="Confirmar Pagamento / Recebimento"
                          onClick={() => setBaixaLanc(item.raw as Lancamento)}
                          style={{ padding: '4px 8px', color: 'var(--color-success)' }}
                        ><Check size={14} /></button>
                      )}
                      {item.status !== 'PAGO' && (
                        <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => setEditLanc(item.raw as Lancamento)} style={{ padding: '4px 8px' }}>
                          <Edit3 size={14} />
                        </button>
                      )}
                      {confirmDelete === item.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteLanc(item.id)} style={{ padding: '4px 8px', color: 'var(--color-danger)' }}>Sim</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)} style={{ padding: '4px 8px' }}>Não</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" title="Excluir" onClick={() => setConfirmDelete(item.id)} style={{ padding: '4px 8px', color: 'var(--color-danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ============================================================
  // SUB-RENDER: DESPESAS COM GRUPOS
  // ============================================================
  function renderGruposDespesas(items: FluxoItem[]) {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>

    const atrasadas = items.filter(i => i.status === 'ATRASADO')
    const pendentes = items.filter(i => i.status === 'PENDENTE')
    const pagas = items.filter(i => i.status === 'PAGO')

    const totalPendente = [...atrasadas, ...pendentes].reduce((a, i) => a + i.valor, 0)
    const totalPago = pagas.reduce((a, i) => a + i.valor, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Resumo rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { label: 'A Pagar', value: totalPendente, color: 'var(--color-warning)', count: atrasadas.length + pendentes.length },
            { label: 'Em Atraso', value: atrasadas.reduce((a, i) => a + i.valor, 0), color: 'var(--color-danger)', count: atrasadas.length },
            { label: 'Já Pago', value: totalPago, color: 'var(--color-success)', count: pagas.length },
          ].map((g, i) => (
            <div key={i} className="card" style={{ padding: '14px', borderLeft: `3px solid ${g.color}` }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{g.label} ({g.count})</div>
              <div style={{ fontWeight: 700, color: g.color, fontFamily: 'var(--font-display)' }}>{fmt(g.value)}</div>
            </div>
          ))}
        </div>

        {atrasadas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-danger)' }}>
            <div style={{ padding: '12px 20px', background: 'var(--color-danger-subtle)', borderBottom: '1px solid var(--color-danger)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)' }}>⚠️ Vencidas ({atrasadas.length})</h3>
            </div>
            {renderTable(atrasadas, false)}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-warning)' }}>🕐 A Vencer ({pendentes.length})</h3>
            </div>
            {renderTable(pendentes, false)}
          </div>
        )}

        {pagas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>✅ Pagas ({pagas.length})</h3>
            </div>
            {renderTable(pagas, false)}
          </div>
        )}

        {items.length === 0 && (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <DollarSign size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>Nenhuma despesa em {nomeMes(mesFiltro)}.</p>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // SUB-RENDER: RECEITAS COM GRUPOS
  // ============================================================
  function renderGruposReceitas(items: FluxoItem[]) {
    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>

    const atrasadas = items.filter(i => i.status === 'ATRASADO')
    const pendentes = items.filter(i => i.status === 'PENDENTE')
    const recebidas = items.filter(i => i.status === 'PAGO')

    const totalReceber = [...atrasadas, ...pendentes].reduce((a, i) => a + i.valor, 0)
    const totalRecebido = recebidas.reduce((a, i) => a + i.valor, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {[
            { label: 'A Receber', value: totalReceber, color: 'var(--color-info)', count: atrasadas.length + pendentes.length },
            { label: 'Em Atraso', value: atrasadas.reduce((a, i) => a + i.valor, 0), color: 'var(--color-danger)', count: atrasadas.length },
            { label: 'Já Recebido', value: totalRecebido, color: 'var(--color-success)', count: recebidas.length },
          ].map((g, i) => (
            <div key={i} className="card" style={{ padding: '14px', borderLeft: `3px solid ${g.color}` }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{g.label} ({g.count})</div>
              <div style={{ fontWeight: 700, color: g.color, fontFamily: 'var(--font-display)' }}>{fmt(g.value)}</div>
            </div>
          ))}
        </div>

        {atrasadas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-danger)' }}>
            <div style={{ padding: '12px 20px', background: 'var(--color-danger-subtle)', borderBottom: '1px solid var(--color-danger)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)' }}>⚠️ Em Atraso ({atrasadas.length})</h3>
            </div>
            {renderTable(atrasadas, false)}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-info)' }}>🕐 A Receber ({pendentes.length})</h3>
            </div>
            {renderTable(pendentes, false)}
          </div>
        )}

        {recebidas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>✅ Recebidas ({recebidas.length})</h3>
            </div>
            {renderTable(recebidas, false)}
          </div>
        )}

        {items.length === 0 && (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <DollarSign size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>Nenhuma receita em {nomeMes(mesFiltro)}.</p>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // SUB-RENDER: DRE — REGIME DE CAIXA
  // ============================================================
  function renderDRE() {
    const meses: string[] = []
    for (let i = 5; i >= 0; i--) meses.push(getMesStr(-i))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Seletor de Mês */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: '4px' }}>Período:</span>
          {meses.map(m => (
            <button
              key={m} onClick={() => setDreMes(m)}
              className={`btn btn-sm ${m === dreMes ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem' }}
            >
              {nomeMes(m)}
            </button>
          ))}
        </div>

        {/* DRE Card */}
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              📊 DRE — {nomeMes(dreMes)}
            </h2>
            <span style={{
              fontSize: '0.6875rem', padding: '4px 10px', borderRadius: '99px',
              background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
              fontWeight: 600, border: '1px solid var(--color-primary)'
            }}>Regime de Caixa</span>
          </div>

          {/* Receita Bruta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
            <span style={{ color: 'var(--color-success)' }}>(+) Receita Bruta de Serviços</span>
            <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}>{fmt(dreReceitas)}</span>
          </div>

          {/* Despesas Operacionais */}
          <div style={{ padding: '16px 0', borderBottom: '2px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: 600, color: 'var(--color-danger)' }}>
              <span>(-) Despesas Operacionais</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}>{fmt(dreTotalDespesas)}</span>
            </div>
            {Object.entries(drePorCategoria).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '16px' }}>
                {Object.entries(drePorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                  const pct = dreTotalDespesas > 0 ? (val / dreTotalDespesas * 100) : 0
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>• {cat}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(val)} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--color-bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-danger)', borderRadius: '2px', transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ paddingLeft: '16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Nenhuma despesa paga neste período.</p>
            )}
          </div>

          {/* Resultado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0 8px', fontWeight: 700, fontSize: '1.125rem' }}>
            <span>(=) RESULTADO LÍQUIDO</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '1.5rem',
              color: dreResultado >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {fmt(dreResultado)}
            </span>
          </div>

          {/* Indicadores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div style={{
              padding: '16px', borderRadius: '12px', textAlign: 'center',
              background: dreResultado >= 0 ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
              color: dreResultado >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              fontWeight: 600, fontSize: '0.875rem'
            }}>
              {dreResultado >= 0
                ? `✅ Lucro`
                : `⚠️ Prejuízo`}
              <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', marginTop: '4px' }}>
                {fmt(Math.abs(dreResultado))}
              </div>
            </div>
            <div style={{
              padding: '16px', borderRadius: '12px', textAlign: 'center',
              background: dreMargemLucro >= 30 ? 'var(--color-success-subtle)' : dreMargemLucro >= 0 ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'var(--color-danger-subtle)',
              color: dreMargemLucro >= 30 ? 'var(--color-success)' : dreMargemLucro >= 0 ? 'var(--color-warning)' : 'var(--color-danger)',
              fontWeight: 600, fontSize: '0.875rem'
            }}>
              Margem de Lucro
              <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', marginTop: '4px' }}>
                {dreMargemLucro.toFixed(1)}%
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '16px', textAlign: 'center' }}>
            ℹ️ DRE no Regime de Caixa: considera apenas valores efetivamente pagos/recebidos no período.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // SUB-RENDER: CONTAS E CARTÕES
  // ============================================================
  function renderContasCartoes() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="form-grid-2">
          {/* Contas Bancárias */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Contas Bancárias</h2>
            </div>
            {contas.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Nenhuma conta cadastrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contas.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    {editingConta?.id === c.id ? (
                      <form style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }} onSubmit={async (e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        const res = await fetch('/api/financeiro/contas', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: c.id, nome: fd.get('nome'), tipo: fd.get('tipo'), saldo_inicial: fd.get('saldo_inicial') })
                        })
                        if (res.ok) { setEditingConta(null); fetchContasCartoes(); }
                      }}>
                        <input name="nome" defaultValue={c.nome} required className="form-input btn-sm" style={{ flex: 1 }} />
                        <select name="tipo" defaultValue={c.tipo} className="form-select btn-sm">
                          <option value="CORRENTE">Corrente</option>
                          <option value="POUPANCA">Poupança</option>
                          <option value="DINHEIRO">Caixa Físico</option>
                        </select>
                        <input name="saldo_inicial" defaultValue={c.saldo_inicial} type="number" step="0.01" className="form-input btn-sm" style={{ width: '80px' }} />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '4px', background: 'var(--color-success)', color: 'white', border: 'none' }}><Check size={16} /></button>
                        <button type="button" onClick={() => setEditingConta(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px' }}><X size={16} /></button>
                      </form>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{c.tipo}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingConta(c)} className="btn btn-secondary btn-sm" style={{ padding: '6px' }} title="Editar"><Edit3 size={16} /></button>
                          <button onClick={async () => {
                            if (confirm(`Excluir a conta "${c.nome}"?`)) {
                              const res = await fetch(`/api/financeiro/contas?id=${c.id}`, { method: 'DELETE' })
                              if (res.ok) fetchContasCartoes()
                              else { const d = await res.json(); showError(d.error) }
                            }
                          }} className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--color-danger)' }} title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              const res = await fetch('/api/financeiro/contas', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotografo_id: fotografoId, nome: fd.get('nome'), tipo: fd.get('tipo'), saldo_inicial: fd.get('saldo_inicial') })
              });
              if (res.ok) { form.reset(); fetchContasCartoes(); }
            }} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input name="nome" required className="form-input btn-sm" placeholder="Nome da Conta" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <select name="tipo" className="form-select btn-sm" style={{ flex: 1 }}>
                  <option value="CORRENTE">Corrente</option>
                  <option value="POUPANCA">Poupança</option>
                  <option value="DINHEIRO">Caixa Físico</option>
                </select>
                <input name="saldo_inicial" type="number" step="0.01" className="form-input btn-sm" placeholder="Saldo Atual" style={{ width: '100px' }} />
              </div>
              <button className="btn btn-secondary btn-sm"><Plus size={14} /> Adicionar Conta</button>
            </form>
          </div>

          {/* Cartões de Crédito */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 600 }}>Cartões de Crédito</h2>
            </div>
            {cartoes.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Nenhum cartão cadastrado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cartoes.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-bg-elevated)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    {editingCartao?.id === c.id ? (
                      <form style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center', flexWrap: 'wrap' }} onSubmit={async (e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        const res = await fetch('/api/financeiro/cartoes', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: c.id, nome: fd.get('nome'), dia_fechamento: fd.get('dia_fechamento'), dia_vencimento: fd.get('dia_vencimento') })
                        })
                        if (res.ok) { setEditingCartao(null); fetchContasCartoes(); }
                      }}>
                        <input name="nome" defaultValue={c.nome} required className="form-input btn-sm" style={{ flex: 1, minWidth: '120px' }} />
                        <input name="dia_fechamento" defaultValue={c.dia_fechamento} type="number" min="1" max="31" required className="form-input btn-sm" style={{ width: '60px' }} title="Fechamento" />
                        <input name="dia_vencimento" defaultValue={c.dia_vencimento} type="number" min="1" max="31" required className="form-input btn-sm" style={{ width: '60px' }} title="Vencimento" />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '4px', background: 'var(--color-success)', color: 'white', border: 'none' }}><Check size={16} /></button>
                        <button type="button" onClick={() => setEditingCartao(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px' }}><X size={16} /></button>
                      </form>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Corte: Dia {c.dia_fechamento} · Vencimento: Dia {c.dia_vencimento}{c.limite ? ` · Limite: ${fmt(c.limite)}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setEditingCartao(c)} className="btn btn-secondary btn-sm" style={{ padding: '6px' }} title="Editar"><Edit3 size={16} /></button>
                          <button onClick={async () => {
                            if (confirm(`Excluir o cartão "${c.nome}"?`)) {
                              const res = await fetch(`/api/financeiro/cartoes?id=${c.id}`, { method: 'DELETE' })
                              if (res.ok) fetchContasCartoes()
                              else { const d = await res.json(); showError(d.error) }
                            }
                          }} className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--color-danger)' }} title="Excluir"><Trash2 size={16} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              const res = await fetch('/api/financeiro/cartoes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fotografo_id: fotografoId, nome: fd.get('nome'), dia_fechamento: fd.get('dia_fechamento'), dia_vencimento: fd.get('dia_vencimento') })
              });
              if (res.ok) { form.reset(); fetchContasCartoes(); }
            }} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input name="nome" required className="form-input btn-sm" placeholder="Apelido do Cartão" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input name="dia_fechamento" type="number" min="1" max="31" required className="form-input btn-sm" placeholder="Dia Corte" title="Data de Fechamento" />
                <input name="dia_vencimento" type="number" min="1" max="31" required className="form-input btn-sm" placeholder="Dia Venc." title="Vencimento da Fatura" />
              </div>
              <button className="btn btn-secondary btn-sm"><Plus size={14} /> Adicionar Cartão</button>
            </form>
          </div>
        </div>
      </div>
    )
  }
}
