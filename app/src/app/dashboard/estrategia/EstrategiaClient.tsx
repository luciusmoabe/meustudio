'use client'

import React, { useState, useEffect } from 'react'
import { 
  Target, Zap, Edit3, ChevronDown, ChevronUp, 
  Activity, TrendingUp, AlertTriangle, AlertCircle, Plus, Trash2, X, Pencil, CheckCircle, Clock
} from 'lucide-react'

type KeyResult = {
  id: string
  objective_id: string
  titulo: string
  valor_inicial: number
  valor_atual: number
  valor_meta: number
  unidade: string
  tipo_automacao: string
  inverso: boolean
  frequencia_checkin: string
  okr_checkins?: { count: number }[] | null
}

type Objective = {
  id: string
  fotografo_id: string
  titulo: string
  descricao: string | null
  trimestre: string
  data_inicio: string
  data_fim: string
  progresso_geral: number
  okr_key_results: KeyResult[]
}

export default function EstrategiaClient({ fotografoId }: { fotografoId: string }) {
  const [objetivos, setObjetivos] = useState<Objective[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Estados dos modais de Criação
  const [isModalObjOpen, setIsModalObjOpen] = useState(false)
  const [isModalKROpen, setIsModalKROpen] = useState(false)
  const [activeObjId, setActiveObjId] = useState<string | null>(null)

  // Estados dos modais de Edição e Check-in
  const [editObj, setEditObj] = useState<Objective | null>(null)
  const [editKr, setEditKr] = useState<KeyResult | null>(null)
  const [checkinKr, setCheckinKr] = useState<KeyResult | null>(null)
  const [checkinList, setCheckinList] = useState<any[]>([])
  const [editingCheckin, setEditingCheckin] = useState<any>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [appError, setAppError] = useState<string | null>(null)

  const showError = (msg: string) => {
    setAppError(msg)
    setTimeout(() => setAppError(null), 7000)
  }

  useEffect(() => {
    fetchOkrs()
  }, [])

  const fetchOkrs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/okrs?fotografo_id=${fotografoId}`)
      const data = await res.json()
      if (data.objetivos) {
        setObjetivos(data.objetivos)
        if (data.objetivos.length > 0 && expandedIds.length === 0) {
          setExpandedIds([data.objetivos[0].id])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleAccordion = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // --- DELETE OKR ---
  const handleDelete = async (id: string, type: 'objective'|'key_result', ev: React.MouseEvent) => {
    ev.stopPropagation()
    try {
      const res = await fetch(`/api/okrs?id=${id}&type=${type}`, { method: 'DELETE' })
      if (res.ok) {
        setConfirmDeleteId(null)
        fetchOkrs()
      } else {
        const data = await res.json()
        showError(data.error || 'Erro ao excluir')
      }
    } catch (err) {
      showError('Erro ao excluir')
    }
  }

  // --- HELPERS PARA PROGRESSO ---
  const calculateProgress = (current: number, goal: number, initial: number = 0, inverse = false) => {
    if (inverse) {
      if (current <= goal) return 100
      const total = initial - goal
      if (total <= 0) return 0
      const prog = ((initial - current) / total) * 100
      return Math.min(100, Math.max(0, prog))
    }
    const total = goal - initial
    if (total <= 0) return 100
    const prog = ((current - initial) / total) * 100
    return Math.min(100, Math.max(0, prog))
  }

  const formatValue = (value: number, unit: string) => {
    const safeUnit = unit || ''
    if (safeUnit === 'R$' || safeUnit === 'BRL') return `R$ ${value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 0}`
    if (safeUnit === '%') return `${value || 0}%`
    return `${value || 0} ${safeUnit}`.trim()
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 70) return 'var(--color-success)'
    if (progress >= 31) return 'var(--color-warning)'
    return 'var(--color-danger)'
  }

  // --- FORMS DE CRIAÇÃO ---
  const handleCreateObj = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/okrs', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'objective',
          fotografo_id: fotografoId,
          titulo: formData.get('titulo'),
          descricao: formData.get('descricao'),
          trimestre: formData.get('trimestre'),
          data_inicio: formData.get('data_inicio'),
          data_fim: formData.get('data_fim'),
        })
      })
      if(res.ok) {
        setIsModalObjOpen(false)
        fetchOkrs()
      }
    } catch (err) { console.error(err) }
  }

  const handleCreateKR = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/okrs', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'key_result',
          objective_id: activeObjId,
          titulo: formData.get('titulo'),
          valor_inicial: Number(formData.get('valor_inicial')),
          valor_meta: Number(formData.get('valor_meta')),
          unidade: formData.get('unidade'),
          tipo_automacao: formData.get('tipo_automacao'),
          frequencia_checkin: formData.get('frequencia_checkin') || 'mensal',
          inverso: formData.get('inverso') === 'true',
        })
      })
      if(res.ok) {
        setIsModalKROpen(false)
        fetchOkrs()
      }
    } catch (err) { console.error(err) }
  }

  // --- FORMS DE EDIÇÃO ---
  const handleUpdateObj = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editObj) return
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/okrs', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'objective',
          id: editObj.id,
          titulo: formData.get('titulo'),
          descricao: formData.get('descricao'),
          trimestre: formData.get('trimestre'),
          data_inicio: formData.get('data_inicio'),
          data_fim: formData.get('data_fim'),
        })
      })
      if(res.ok) {
        setEditObj(null)
        fetchOkrs()
      }
    } catch (err) {}
  }

  const handleUpdateKR = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editKr) return
    const formData = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/okrs', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: 'key_result',
          id: editKr.id,
          titulo: formData.get('titulo'),
          valor_inicial: Number(formData.get('valor_inicial')),
          valor_meta: Number(formData.get('valor_meta')),
          unidade: formData.get('unidade'),
          tipo_automacao: formData.get('tipo_automacao'),
          frequencia_checkin: formData.get('frequencia_checkin'),
          inverso: formData.get('inverso') === 'true',
        })
      })
      if(res.ok) {
        setEditKr(null)
        fetchOkrs()
      }
    } catch (err) {}
  }

  // --- CHECK-IN ---
  const openCheckinModal = async (kr: KeyResult, ev: React.MouseEvent) => {
    ev.stopPropagation()
    setCheckinKr(kr)
    setCheckinList([])
    setEditingCheckin(null)
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/okrs/checkins?key_result_id=${kr.id}`)
      const data = await res.json()
      if (data.checkins) setCheckinList(data.checkins)
    } catch(err) {}
  }

  const refreshCheckins = async (krId: string) => {
    try {
      const res = await fetch(`/api/okrs/checkins?key_result_id=${krId}`)
      const data = await res.json()
      if (data.checkins) {
        setCheckinList(data.checkins)
        setCheckinKr(prev => {
          if (!prev) return prev
          const novoValor = data.checkins.length > 0 ? data.checkins[0].valor_registrado : prev.valor_inicial
          return { ...prev, valor_atual: novoValor }
        })
      }
    } catch(err) {}
  }

  const handleDeleteCheckin = async (id: string, krId: string) => {
    try {
      const res = await fetch(`/api/okrs/checkins?id=${id}`, { method: 'DELETE' })
      if(res.ok) {
        setConfirmDeleteId(null)
        refreshCheckins(krId)
        fetchOkrs()
      }
    } catch (err) {}
  }

  const handleSaveCheckin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!checkinKr) return
    const formData = new FormData(e.currentTarget)
    try {
      const url = '/api/okrs/checkins'
      const method = editingCheckin ? 'PUT' : 'POST'
      const body = editingCheckin 
        ? { id: editingCheckin.id, valor_registrado: Number(formData.get('valor_registrado')), comentario: formData.get('comentario') }
        : { key_result_id: checkinKr.id, fotografo_id: fotografoId, valor_registrado: Number(formData.get('valor_registrado')), comentario: formData.get('comentario') }

      const res = await fetch(url, {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      })
      if(res.ok) {
        setEditingCheckin(null)
        setCheckinKr(null)
        fetchOkrs()
      }
    } catch (err) {}
  }


  // --- ESTATÍSTICAS ---
  const objAtivos = objetivos.length
  const avgProgresso = objAtivos > 0 ? (objetivos.reduce((a, b) => a + Number(b.progresso_geral), 0) / objAtivos).toFixed(0) : 0
  const krsEmRisco = objetivos.reduce((acc, obj) => {
    return acc + obj.okr_key_results.filter(kr => calculateProgress(kr.valor_atual, kr.valor_meta, kr.valor_inicial, kr.inverso) <= 30).length
  }, 0)

  return (
    <div style={{ 
      backgroundColor: 'transparent',
      color: 'var(--color-text-primary)',
      fontFamily: "var(--font-sans)",
      marginTop: '32px'
    }}>
      
      {/* HEADER WIDGET (Estratégia) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', background: 'var(--gradient-accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-accent)' }}>
            <Target size={20} color="white" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
            Estratégia e OKRs
          </h2>
        </div>
        
        <button className="btn btn-primary btn-sm" onClick={() => setIsModalObjOpen(true)}>
          <Plus size={14} /> Novo Objetivo
        </button>
      </div>

      {appError && (
        <div style={{ margin: '0 0 16px 0', padding: '16px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          {appError}
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        
        {/* Card Objetivos Ativos */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--color-bg-surface) 0%, var(--color-bg-elevated) 100%)',
          borderRadius: '20px', padding: '24px', 
          border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '20px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--color-success)', filter: 'blur(50px)', opacity: 0.15, borderRadius: '50%' }}></div>
          <div style={{ background: 'var(--color-success-subtle)', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 12px var(--color-success-subtle)' }}>
            <Activity size={24} color="var(--color-success)" />
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Objetivos Ativos</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{objAtivos}</h2>
          </div>
        </div>

        {/* Card Progresso */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--color-bg-surface) 0%, var(--color-bg-elevated) 100%)',
          borderRadius: '20px', padding: '24px', 
          border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '20px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--color-info)', filter: 'blur(50px)', opacity: 0.15, borderRadius: '50%' }}></div>
          <div style={{ background: 'var(--color-info-subtle)', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 12px var(--color-info-subtle)' }}>
            <TrendingUp size={24} color="var(--color-info)" />
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Progresso Médio</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{avgProgresso}%</h2>
          </div>
        </div>

        {/* Card Risco */}
        <div style={{ 
          background: 'linear-gradient(145deg, var(--color-bg-surface) 0%, var(--color-bg-elevated) 100%)',
          borderRadius: '20px', padding: '24px', 
          border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '20px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--color-danger)', filter: 'blur(50px)', opacity: 0.15, borderRadius: '50%' }}></div>
          <div style={{ background: 'var(--color-danger-subtle)', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 12px var(--color-danger-subtle)' }}>
            <AlertTriangle size={24} color="var(--color-danger)" />
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>KRs em Risco</p>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{krsEmRisco}</h2>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Carregando OKRs...</div>
      ) : objetivos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--color-bg-surface)', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: '8px' }}>Nenhum Objetivo Cadastrado</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>Comece planejando sua estratégia de crescimento.</p>
          <button className="btn btn-primary" onClick={() => setIsModalObjOpen(true)}>Criar primeiro Objetivo</button>
        </div>
      ) : (
        /* LISTA DE OKRS (Accordion) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {objetivos.map(obj => {
            const isExpanded = expandedIds.includes(obj.id)
            const objProgress = Number(obj.progresso_geral)
            
            return (
              <div key={obj.id} style={{ 
                background: 'var(--color-bg-surface)', 
                borderRadius: '16px', 
                border: `1px solid ${isExpanded ? 'var(--color-accent-subtle)' : 'var(--color-border)'}`,
                overflow: 'hidden',
                boxShadow: isExpanded ? '0 12px 32px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.03)',
                transition: 'all 0.3s ease',
                transform: isExpanded ? 'translateY(-2px)' : 'none'
              }}
              onMouseEnter={(e) => { if(!isExpanded) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' } }}
              onMouseLeave={(e) => { if(!isExpanded) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)' } }}>
                
                {/* CABEÇALHO DO ACORDEÃO (OBJETIVO) */}
                <div 
                  onClick={() => toggleAccordion(obj.id)}
                  style={{ 
                    padding: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--color-bg-elevated)' : 'transparent'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {obj.titulo}
                      </h3>
                      <span style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-muted)', padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {obj.trimestre}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{obj.descricao}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {confirmDeleteId === obj.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>Excluir?</span>
                          <button onClick={(e) => handleDelete(obj.id, 'objective', e)} className="btn btn-sm" style={{ padding: '2px 6px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: 'none' }}>Sim</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>Não</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setEditObj(obj) }} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(obj.id) }} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Mini barra de progresso do Objetivo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '180px' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', width: '36px', textAlign: 'right' }}>
                        {objProgress}%
                      </span>
                      <div style={{ height: '8px', flex: 1, background: 'var(--color-bg-base)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${objProgress}%`, 
                          background: getProgressColor(objProgress),
                          borderRadius: '99px',
                          transition: 'width 1s ease'
                        }} />
                      </div>
                    </div>
                    
                    <div style={{ padding: '8px', background: 'var(--color-bg-elevated)', borderRadius: '50%', color: 'var(--color-text-secondary)' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* CONTEÚDO EXPANDIDO (KEY RESULTS) */}
                {isExpanded && (
                  <div style={{ padding: '0 24px 24px 24px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      
                      {obj.okr_key_results.map(kr => {
                        const progressoKR = calculateProgress(kr.valor_atual, kr.valor_meta, kr.valor_inicial, kr.inverso)
                        
                        return (
                          <div key={kr.id} style={{ 
                            background: 'var(--color-bg-base)', 
                            borderRadius: '12px', 
                            padding: '20px', 
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                          }}>
                            
                            {/* KR Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                  <span style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                                    KR
                                  </span>
                                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                    {kr.titulo}
                                  </h4>
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Badges de Automação */}
                                {kr.tipo_automacao !== 'manual' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-success-subtle)', border: '1px solid var(--color-success)', padding: '6px 12px', borderRadius: '99px', color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    <Zap size={14} fill="currentColor" />
                                    Automático
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning)', padding: '6px 12px', borderRadius: '99px', color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    <Edit3 size={14} />
                                    Manual ({kr.frequencia_checkin || 'mensal'})
                                  </div>
                                )}
                                {confirmDeleteId === kr.id ? (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>Excluir KR?</span>
                                    <button onClick={(e) => handleDelete(kr.id, 'key_result', e)} className="btn btn-sm" style={{ padding: '2px 6px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: 'none' }}>Sim</button>
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>Não</button>
                                  </div>
                                ) : (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); setEditKr(kr) }} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
                                      <Pencil size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(kr.id) }} className="btn btn-ghost btn-sm" style={{ padding: '6px', color: 'var(--color-danger)' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* KR Progress */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Progresso Atual</span>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                    {formatValue(kr.valor_atual, kr.unidade)}
                                  </span>
                                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                                    / {formatValue(kr.valor_meta, kr.unidade)}
                                  </span>
                                </div>
                              </div>
                              
                              <div style={{ position: 'relative', height: '12px', background: 'var(--color-bg-elevated)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                {/* Barra preenchida */}
                                <div style={{ 
                                  position: 'absolute',
                                  left: 0, top: 0, bottom: 0,
                                  width: `${progressoKR}%`, 
                                  background: getProgressColor(progressoKR),
                                  borderRadius: '99px',
                                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                                {kr.tipo_automacao === 'manual' ? (
                                  <button 
                                    className="btn btn-sm" 
                                    style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }} 
                                    onClick={(e) => openCheckinModal(kr, e)}
                                  >
                                    <CheckCircle size={14} style={{ marginRight: '6px' }}/> 
                                    Fazer Check-in
                                  </button>
                                ) : (
                                  <button 
                                    className="btn btn-sm" 
                                    style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', fontSize: '0.8125rem', opacity: 0.6, cursor: 'not-allowed' }} 
                                    disabled
                                    title="Check-ins são gerados automaticamente pelo sistema"
                                  >
                                    <Clock size={14} style={{ marginRight: '6px' }}/> 
                                    Atualizado pelo Sistema
                                  </button>
                                )}
                              </div>
                            </div>

                          </div>
                        )
                      })}

                      {/* Botão Add KR */}
                      <button 
                        className="btn btn-secondary" 
                        style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                        onClick={(e) => { e.stopPropagation(); setActiveObjId(obj.id); setIsModalKROpen(true) }}
                      >
                        + Adicionar Key Result
                      </button>

                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* =========================================================
          MODAIS DE CRIAÇÃO
      ========================================================= */}
      
      {/* MODAL CRIAR OBJETIVO */}
      {isModalObjOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateObj} className="card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Novo Objetivo</h3>
              <button type="button" onClick={() => setIsModalObjOpen(false)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20}/></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Título Aspiracional</label>
              <input name="titulo" required className="form-input" placeholder="Ex: Dominar o mercado de recém-nascidos..." />
            </div>
            <div className="form-group">
              <label className="form-label">Descrição (Opcional)</label>
              <textarea name="descricao" className="form-textarea" placeholder="O que queremos focar..." style={{ minHeight: '60px' }}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Trimestre</label>
              <input name="trimestre" required className="form-input" placeholder="Ex: Q3-2026" defaultValue="Q3-2026" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Data de Início</label>
                <input name="data_inicio" type="date" required className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Fim</label>
                <input name="data_fim" type="date" required className="form-input" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Salvar Objetivo</button>
          </form>
        </div>
      )}

      {/* MODAL CRIAR KR */}
      {isModalKROpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleCreateKR} className="card" style={{ width: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Novo Key Result</h3>
              <button type="button" onClick={() => setIsModalKROpen(false)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20}/></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Título Mensurável</label>
              <input name="titulo" required className="form-input" placeholder="Ex: Alcançar R$ 20.000 em extras..." />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor Inicial</label>
                <input name="valor_inicial" type="number" step="0.01" required className="form-input" defaultValue={0} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Meta</label>
                <input name="valor_meta" type="number" step="0.01" required className="form-input" />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Unidade</label>
                <input name="unidade" required className="form-input" placeholder="Ex: R$, %, pts" defaultValue="un" />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label" style={{ display: 'flex', gap: '8px', cursor: 'pointer', marginTop: '24px' }}>
                  <input type="checkbox" name="inverso" value="true" />
                  Métrica inversa
                </label>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Gatilho de Automação</label>
                <select name="tipo_automacao" className="form-select">
                  <option value="manual">Atualização Manual</option>
                  <option value="faturamento_total">Auto: Faturamento Total</option>
                  <option value="faturamento_extras">Auto: Faturamento Extras</option>
                  <option value="reducao_despesas">Auto: Redução de Despesas (Custos)</option>
                  <option value="lucro_liquido">Auto: Lucro Líquido</option>
                  <option value="ensaios_entregues">Auto: Ensaios Entregues</option>
                  <option value="leads_ganhos">Auto: Propostas Ganhas</option>
                  <option value="taxa_conversao">Auto: Taxa Conversão (%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequência</label>
                <select name="frequencia_checkin" className="form-select" defaultValue="mensal">
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Salvar Key Result</button>
          </form>
        </div>
      )}

      {/* =========================================================
          MODAIS DE EDIÇÃO
      ========================================================= */}

      {/* MODAL EDITAR OBJETIVO */}
      {editObj && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleUpdateObj} className="card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Editar Objetivo</h3>
              <button type="button" onClick={() => setEditObj(null)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20}/></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Título Aspiracional</label>
              <input name="titulo" required className="form-input" defaultValue={editObj.titulo} />
            </div>
            <div className="form-group">
              <label className="form-label">Descrição (Opcional)</label>
              <textarea name="descricao" className="form-textarea" style={{ minHeight: '60px' }} defaultValue={editObj.descricao || ''}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Trimestre</label>
              <input name="trimestre" required className="form-input" defaultValue={editObj.trimestre} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Data de Início</label>
                <input name="data_inicio" type="date" required className="form-input" defaultValue={editObj.data_inicio} />
              </div>
              <div className="form-group">
                <label className="form-label">Data de Fim</label>
                <input name="data_fim" type="date" required className="form-input" defaultValue={editObj.data_fim} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Atualizar Objetivo</button>
          </form>
        </div>
      )}

    {/* MODAL EDITAR KR */}
      {editKr && (() => {
        const hasCheckins = !!(editKr.okr_checkins && editKr.okr_checkins.length > 0 && (editKr.okr_checkins[0] as any)?.count > 0);
        return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleUpdateKR} className="card" style={{ width: '460px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Editar Key Result</h3>
              <button type="button" onClick={() => setEditKr(null)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20}/></button>
            </div>
            
            {hasCheckins && (
              <div style={{ padding: '12px', background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'flex-start', gap: '8px', border: '1px solid var(--color-warning)' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Alguns campos estão desabilitados porque já existem medições cadastradas. Alterá-los comprometeria o histórico.</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Título Mensurável</label>
              <input name="titulo" required className="form-input" defaultValue={editKr.titulo} />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Valor Inicial</label>
                <input name="valor_inicial" type="number" step="0.01" required className="form-input" defaultValue={editKr.valor_inicial} disabled={hasCheckins} title={hasCheckins ? "Não pode ser alterado após a primeira medição" : ""} style={{ opacity: hasCheckins ? 0.6 : 1, cursor: hasCheckins ? 'not-allowed' : 'text' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Valor Meta</label>
                <input name="valor_meta" type="number" step="0.01" required className="form-input" defaultValue={editKr.valor_meta} />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Unidade</label>
                <input name="unidade" required className="form-input" defaultValue={editKr.unidade} disabled={hasCheckins} title={hasCheckins ? "Não pode ser alterada após a primeira medição" : ""} style={{ opacity: hasCheckins ? 0.6 : 1, cursor: hasCheckins ? 'not-allowed' : 'text' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label" style={{ display: 'flex', gap: '8px', cursor: hasCheckins ? 'not-allowed' : 'pointer', marginTop: '24px', opacity: hasCheckins ? 0.6 : 1 }} title={hasCheckins ? "Não pode ser alterada após a primeira medição" : ""}>
                  <input type="checkbox" name="inverso" value="true" defaultChecked={editKr.inverso} disabled={hasCheckins} />
                  Métrica inversa
                </label>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Gatilho de Automação</label>
                <select name="tipo_automacao" className="form-select" defaultValue={editKr.tipo_automacao}>
                  <option value="manual">Atualização Manual</option>
                  <option value="faturamento_total">Auto: Faturamento Total</option>
                  <option value="faturamento_extras">Auto: Faturamento Extras</option>
                  <option value="reducao_despesas">Auto: Redução de Despesas (Custos)</option>
                  <option value="lucro_liquido">Auto: Lucro Líquido</option>
                  <option value="ensaios_entregues">Auto: Ensaios Entregues</option>
                  <option value="leads_ganhos">Auto: Propostas Ganhas</option>
                  <option value="taxa_conversao">Auto: Taxa Conversão (%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequência</label>
                <select name="frequencia_checkin" className="form-select" defaultValue={editKr.frequencia_checkin}>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Atualizar Key Result</button>
          </form>
        </div>
        )
      })()}

      {/* =========================================================
          MODAL DE CHECK-IN
      ========================================================= */}
      {checkinKr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={20} color="var(--color-primary)" />
                Fazer Check-in
              </h3>
              <button type="button" onClick={() => setCheckinKr(null)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={20}/></button>
            </div>
            
            <div style={{ background: 'var(--color-bg-elevated)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '8px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Key Result: <strong>{checkinKr.titulo}</strong></p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Valor Atual</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatValue(checkinKr.valor_atual, checkinKr.unidade)}</div>
                </div>
                <div style={{ color: 'var(--color-border)', fontSize: '24px' }}>→</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Meta</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatValue(checkinKr.valor_meta, checkinKr.unidade)}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveCheckin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">{editingCheckin ? 'Atualizar Valor Alcançado' : 'Novo Valor Alcançado (Total acumulado)'}</label>
                <input 
                  key={editingCheckin ? editingCheckin.id : `new-${checkinKr.valor_atual}`}
                  name="valor_registrado" 
                  type="number" 
                  step="0.01" 
                  required 
                  className="form-input" 
                  defaultValue={editingCheckin ? editingCheckin.valor_registrado : checkinKr.valor_atual} 
                  style={{ fontSize: '1.125rem', padding: '12px' }} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Comentário / Status (Opcional)</label>
                <textarea 
                  key={editingCheckin ? `comentario-${editingCheckin.id}` : 'new-comentario'}
                  name="comentario" 
                  className="form-textarea" 
                  placeholder="O que ajudou a alcançar este número? Algum obstáculo?"
                  defaultValue={editingCheckin ? editingCheckin.comentario : ''}
                  style={{ minHeight: '80px' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px', flex: 1 }}>
                  {editingCheckin ? 'Atualizar Check-in' : 'Confirmar Check-in'}
                </button>
                {editingCheckin && (
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingCheckin(null)} style={{ padding: '12px' }}>
                    Cancelar Edição
                  </button>
                )}
              </div>
            </form>

            {/* HISTÓRICO RECENTE */}
            {checkinList.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Histórico de Check-ins
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '8px' }}>
                  {checkinList.map((chk: any) => (
                    <div key={chk.id} style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--color-bg-elevated)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatValue(chk.valor_registrado, checkinKr.unidade)}</div>
                        <div style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>{chk.comentario || 'Sem comentário'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                          {new Date(chk.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </div>
                        {confirmDeleteId === chk.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>Excluir?</span>
                            <button type="button" onClick={() => handleDeleteCheckin(chk.id, checkinKr.id)} className="btn btn-sm" style={{ padding: '2px 8px', background: 'var(--color-danger-subtle)', color: 'var(--color-danger)', border: 'none' }}>Sim</button>
                            <button type="button" onClick={() => setConfirmDeleteId(null)} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}>Não</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button type="button" onClick={() => setEditingCheckin(chk)} className="btn btn-ghost btn-sm" style={{ padding: '4px', height: 'auto' }}><Pencil size={12} /></button>
                            <button type="button" onClick={() => setConfirmDeleteId(chk.id)} className="btn btn-ghost btn-sm" style={{ padding: '4px', height: 'auto', color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
