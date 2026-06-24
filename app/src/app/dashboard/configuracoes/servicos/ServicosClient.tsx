'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Tag, Trash2, Edit3, Clock, DollarSign,
  TrendingUp, Save, X, Loader2, ArrowLeft, Image as ImageIcon, BarChart2,
  Package, Layers, AlignLeft, Check, GripVertical, Settings2, Kanban
} from 'lucide-react'
import Link from 'next/link'

type Cost = { id?: string; nome_custo: string; valor: number; categoria: string }
type PackageItem = { id?: string; servico_id: string; quantidade: number }
type FormField = { id?: string; pergunta: string; tipo_resposta: string; obrigatorio: boolean; ordem: number }
type Etapa = { id?: string; nome_etapa: string; ordem: number; cor_hex: string; tipo_pipeline: string; pacote_id?: string | null }

type Service = {
  id: string
  nome: string
  duracao_minutos: number
  valor_sugerido: number
  valor_foto_extra: number
  limite_fotos_def: number
  cor_hex: string
  descricao: string | null
  is_pacote: boolean
  custos_servico?: Cost[]
  pacote_servicos?: PackageItem[]
  servico_formularios?: FormField[]
}

type Props = {
  fotografoId: string
  servicosIniciais: Service[]
  etapasIniciais?: Etapa[]
}

const PRESET_COLORS = [
  { hex: '#6366f1', label: 'Índigo' }, { hex: '#8b5cf6', label: 'Violeta' }, { hex: '#ec4899', label: 'Rosa' },
  { hex: '#f43f5e', label: 'Rubi' }, { hex: '#f97316', label: 'Laranja' }, { hex: '#f59e0b', label: 'Âmbar' },
  { hex: '#10b981', label: 'Esmeralda' }, { hex: '#0ea5e9', label: 'Céu' }, { hex: '#64748b', label: 'Slate' },
]

const CATEGORY_OPTIONS = [
  { value: 'entrega', label: 'Álbum / Entrega' }, { value: 'producao', label: 'Cenografia / Produção' },
  { value: 'equipe', label: 'Equipe / Assistentes' }, { value: 'deslocamento', label: 'Transporte / Viagem' },
]

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' }, { value: 120, label: '2 horas' }, { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' }, { value: 300, label: '5 horas' }, { value: 480, label: '8h (Diária)' },
]

export default function ServicosClient({ fotografoId, servicosIniciais, etapasIniciais = [] }: Props) {
  const supabase = createClient()
  const [servicos, setServicos] = useState<Service[]>(servicosIniciais)
  const [etapas, setEtapas] = useState<Etapa[]>(etapasIniciais)
  
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [error, setError] = useState('')

  // View Tabs
  const [mainTab, setMainTab] = useState<'servicos' | 'pacotes'>('pacotes')

  // Modal Tabs
  const [activeTab, setActiveTab] = useState<'geral' | 'itens' | 'formulario' | 'funil' | 'custos'>('geral')

  // Form State
  const [formIsPacote, setFormIsPacote] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDuration, setFormDuration] = useState(60)
  const [formPrice, setFormPrice] = useState(0)
  const [formExtraPhotoPrice, setFormExtraPhotoPrice] = useState(25)
  const [formPhotos, setFormPhotos] = useState(0)
  const [formColor, setFormColor] = useState('#6366f1')
  const [formDescription, setFormDescription] = useState('')
  
  // Arrays
  const [formCosts, setFormCosts] = useState<Cost[]>([])
  const [formPackageItems, setFormPackageItems] = useState<PackageItem[]>([])
  const [formFields, setFormFields] = useState<FormField[]>([])
  
  // Funil State
  const [usarFunilExclusivo, setUsarFunilExclusivo] = useState(false)
  const [formEtapas, setFormEtapas] = useState<Etapa[]>([])
  const [tipoPipelineAtivo, setTipoPipelineAtivo] = useState<'vendas' | 'producao'>('vendas')

  // Helper arrays for filtering
  const availableSimpleServices = useMemo(() => servicos.filter(s => !s.is_pacote), [servicos])
  const displayServices = useMemo(() => servicos.filter(s => s.is_pacote === (mainTab === 'pacotes')), [servicos, mainTab])

  const showError = (msg: string) => {
    setAppError(msg)
    setTimeout(() => setAppError(null), 7000)
  }

  function handleOpenModal(service: Service | null = null, forcePacote: boolean = false) {
    setError('')
    setActiveTab('geral')
    setTipoPipelineAtivo('vendas')
    
    if (service) {
      setEditingService(service)
      setFormIsPacote(service.is_pacote)
      setFormName(service.nome)
      setFormDuration(service.duracao_minutos)
      setFormPrice(service.valor_sugerido)
      setFormExtraPhotoPrice(service.valor_foto_extra ?? 25)
      setFormPhotos(service.limite_fotos_def)
      setFormColor(service.cor_hex)
      setFormDescription(service.descricao ?? '')
      setFormCosts(service.custos_servico ? [...service.custos_servico] : [])
      setFormPackageItems(service.pacote_servicos ? [...service.pacote_servicos] : [])
      setFormFields(service.servico_formularios ? [...service.servico_formularios].sort((a,b)=>a.ordem-b.ordem) : [])
      
      const pctEtapas = etapas.filter(e => e.pacote_id === service.id).sort((a,b) => a.ordem - b.ordem)
      if (pctEtapas.length > 0) {
        setUsarFunilExclusivo(true)
        setFormEtapas(pctEtapas)
      } else {
        setUsarFunilExclusivo(false)
        setFormEtapas(etapas.filter(e => !e.pacote_id).sort((a,b) => a.ordem - b.ordem))
      }
    } else {
      setEditingService(null)
      setFormIsPacote(forcePacote || mainTab === 'pacotes')
      setFormName('')
      setFormDuration(60)
      setFormPrice(0)
      setFormExtraPhotoPrice(25)
      setFormPhotos(0)
      setFormColor('#6366f1')
      setFormDescription('')
      setFormCosts([])
      setFormPackageItems([])
      setFormFields([])
      setUsarFunilExclusivo(false)
      setFormEtapas(etapas.filter(e => !e.pacote_id).sort((a,b) => a.ordem - b.ordem))
    }
    setShowModal(true)
  }

  function addCostItem() { setFormCosts(prev => [...prev, { nome_custo: '', valor: 0, categoria: 'outros' }]) }
  function updateCostItem(index: number, field: keyof Cost, value: any) { setFormCosts(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item)) }
  function removeCostItem(index: number) { setFormCosts(prev => prev.filter((_, i) => i !== index)) }

  function addPackageItem(servico_id: string) {
    if (formPackageItems.find(p => p.servico_id === servico_id)) return
    setFormPackageItems(prev => [...prev, { servico_id, quantidade: 1 }])
  }
  function removePackageItem(servico_id: string) { setFormPackageItems(prev => prev.filter(p => p.servico_id !== servico_id)) }

  function addFormField() { setFormFields(prev => [...prev, { pergunta: '', tipo_resposta: 'texto', obrigatorio: false, ordem: prev.length }]) }
  function updateFormField(index: number, field: keyof FormField, value: any) { setFormFields(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item)) }
  function removeFormField(index: number) { setFormFields(prev => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, ordem: i }))) }

  function addEtapa() {
    const etapasAtuais = formEtapas.filter(e => e.tipo_pipeline === tipoPipelineAtivo)
    const novaOrdem = etapasAtuais.length > 0 ? Math.max(...etapasAtuais.map(e => e.ordem)) + 1 : 1
    const novaEtapa: Etapa = { nome_etapa: '', ordem: novaOrdem, cor_hex: '#60a5fa', tipo_pipeline: tipoPipelineAtivo }
    setFormEtapas(prev => [...prev, novaEtapa])
  }
  function updateEtapa(index: number, field: keyof Etapa, value: any) {
    const etapasDoTipo = formEtapas.filter(e => e.tipo_pipeline === tipoPipelineAtivo)
    const etapaOriginal = etapasDoTipo[index]
    setFormEtapas(prev => prev.map(e => e === etapaOriginal ? { ...e, [field]: value } : e))
  }
  function removeEtapa(index: number) {
    const etapasDoTipo = formEtapas.filter(e => e.tipo_pipeline === tipoPipelineAtivo)
    const etapaOriginal = etapasDoTipo[index]
    setFormEtapas(prev => prev.filter(e => e !== etapaOriginal))
  }

  const totalCost = formIsPacote 
    ? (formPackageItems.reduce((sum, item) => {
        const serv = servicos.find(s => s.id === item.servico_id);
        const servCost = serv?.custos_servico?.reduce((cSum, c) => cSum + c.valor, 0) || 0;
        return sum + servCost;
      }, 0))
    : formCosts.reduce((sum, c) => sum + (c.valor || 0), 0)

  const estimatedProfit = formPrice - totalCost
  const profitMargin = formPrice > 0 ? (estimatedProfit / formPrice) * 100 : 0

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) { setError('O nome do serviço/pacote é obrigatório.'); return }
    setSaving(true)
    setError('')

    const servicePayload = {
      fotografo_id: fotografoId, nome: formName, duracao_minutos: formDuration, valor_sugerido: formPrice,
      valor_foto_extra: formExtraPhotoPrice, limite_fotos_def: formPhotos, cor_hex: formColor,
      descricao: formDescription || null, is_pacote: formIsPacote
    }

    try {
      let savedService: Service

      if (editingService) {
        const { data, error: errUpdate } = await supabase.from('tipos_sessao').update(servicePayload).eq('id', editingService.id).select().single()
        if (errUpdate) throw errUpdate
        savedService = data
      } else {
        const { data, error: errInsert } = await supabase.from('tipos_sessao').insert(servicePayload).select().single()
        if (errInsert) throw errInsert
        savedService = data
      }

      if (editingService) {
        await Promise.all([
          supabase.from('custos_servico').delete().eq('tipo_sessao_id', editingService.id),
          supabase.from('pacote_servicos').delete().eq('pacote_id', editingService.id),
          supabase.from('servico_formularios').delete().eq('tipos_sessao_id', editingService.id),
          supabase.from('etapas_pipeline').delete().eq('pacote_id', editingService.id)
        ])
      }

      let savedCosts: Cost[] = []
      if (!formIsPacote) {
        const costsPayload = formCosts.filter(c => c.nome_custo.trim()).map(c => ({ tipo_sessao_id: savedService.id, nome_custo: c.nome_custo, valor: c.valor, categoria: c.categoria }))
        if (costsPayload.length > 0) {
          const { data } = await supabase.from('custos_servico').insert(costsPayload).select()
          if (data) savedCosts = data
        }
      }

      let savedPackageItems: PackageItem[] = []
      if (formIsPacote && formPackageItems.length > 0) {
        const pkgPayload = formPackageItems.map(p => ({ pacote_id: savedService.id, servico_id: p.servico_id, quantidade: p.quantidade }))
        const { data } = await supabase.from('pacote_servicos').insert(pkgPayload).select()
        if (data) savedPackageItems = data
      }

      let savedFormFields: FormField[] = []
      if (formIsPacote) {
        const fieldsPayload = formFields.filter(f => f.pergunta.trim()).map((f, idx) => ({ tipos_sessao_id: savedService.id, pergunta: f.pergunta, tipo_resposta: f.tipo_resposta, obrigatorio: f.obrigatorio, ordem: idx }))
        if (fieldsPayload.length > 0) {
          const { data } = await supabase.from('servico_formularios').insert(fieldsPayload).select()
          if (data) savedFormFields = data
        }
      }

      let newEtapas = [...etapas.filter(e => e.pacote_id !== savedService.id)]
      if (formIsPacote && usarFunilExclusivo && formEtapas.length > 0) {
        const etapasPayload = formEtapas.filter(e => e.nome_etapa.trim()).map((e, idx) => ({
          fotografo_id: fotografoId, pacote_id: savedService.id, nome_etapa: e.nome_etapa, 
          ordem: idx + 1, cor_hex: e.cor_hex, tipo_pipeline: e.tipo_pipeline
        }))
        if (etapasPayload.length > 0) {
          const { data } = await supabase.from('etapas_pipeline').insert(etapasPayload).select()
          if (data) newEtapas = [...newEtapas, ...data]
        }
      }
      setEtapas(newEtapas)

      const finalService: Service = {
        ...savedService, custos_servico: savedCosts, pacote_servicos: savedPackageItems, servico_formularios: savedFormFields
      }

      if (editingService) {
        setServicos(prev => prev.map(s => s.id === editingService.id ? finalService : s))
      } else {
        setServicos(prev => [...prev, finalService])
      }

      setShowModal(false)
    } catch (err: any) {
      setError('Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir permanentemente?')) return
    setDeletingId(id)
    try {
      const { error: errDel } = await supabase.from('tipos_sessao').delete().eq('id', id)
      if (errDel) throw errDel
      setServicos(prev => prev.filter(s => s.id !== id))
      setEtapas(prev => prev.filter(e => e.pacote_id !== id))
    } catch (err: any) {
      if (err.code === '23503') {
        showError('Não é possível excluir pois existem orçamentos, pacotes ou sessões vinculadas a este item.')
      } else {
        showError('Erro ao excluir: ' + err.message)
      }
    } finally {
      setDeletingId(null)
    }
  }

  function formatCurrency(val: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) }
  function getMarginColor(p: number) { return p >= 60 ? '#10b981' : p >= 35 ? '#f59e0b' : '#f43f5e' }
  function durationLabel(min: number) { const h = Math.floor(min / 60); const m = min % 60; return `${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}min` : ''}` }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/dashboard/configuracoes" className="btn btn-ghost btn-icon"><ArrowLeft size={16} /></Link>
          <span className="topbar-title">Catálogo & Funis</span>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: '6px' }}>
          <div style={{ display: 'flex', background: 'var(--color-bg-base)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
            <button onClick={() => setMainTab('pacotes')} className={`btn btn-sm ${mainTab === 'pacotes' ? 'btn-primary' : 'btn-ghost'}`}>
              <Package size={14} /> Pacotes Comerciais
            </button>
            <button onClick={() => setMainTab('servicos')} className={`btn btn-sm ${mainTab === 'servicos' ? 'btn-primary' : 'btn-ghost'}`}>
              <Tag size={14} /> Serviços de Produção
            </button>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary btn-sm"><Plus size={15} /> Novo {mainTab === 'pacotes' ? 'Pacote' : 'Serviço'}</button>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        {appError && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{appError}</div>}

        <div className="page-header">
          <h1 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>
            {mainTab === 'pacotes' ? 'Pacotes Comerciais' : 'Serviços de Produção (Mão de Obra)'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {mainTab === 'pacotes' 
              ? 'Configure o que você vende para o cliente (Preço, Briefing, Funil exclusivo).' 
              : 'Configure o trabalho braçal do estúdio (Tempo, Custo base) para compor pacotes.'}
          </p>
        </div>

        {displayServices.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '56px 24px', border: '1px dashed var(--color-border)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-lg)', background: 'var(--color-accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {mainTab === 'pacotes' ? <Package size={26} color="var(--color-accent)" /> : <Tag size={26} color="var(--color-accent)" />}
            </div>
            <h3 style={{ marginBottom: '8px' }}>Nenhum {mainTab === 'pacotes' ? 'Pacote' : 'Serviço'} Cadastrado</h3>
            <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 24px' }}>
              {mainTab === 'pacotes' 
                ? 'Os clientes do CRM só podem contratar Pacotes. Crie o seu primeiro.' 
                : 'Cadastre os serviços básicos do seu estúdio (ex: Ensaio de 1h, Edição).'}
            </p>
            <button onClick={() => handleOpenModal()} className="btn btn-primary"><Plus size={14} /> Criar Novo</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
            {displayServices.map((s) => {
              const sc = s.custos_servico ?? []
              
              const sCost = s.is_pacote 
                ? (s.pacote_servicos?.reduce((sum, item) => {
                    const serv = servicos.find(xs => xs.id === item.servico_id);
                    const servCost = serv?.custos_servico?.reduce((cSum, c) => cSum + c.valor, 0) || 0;
                    return sum + servCost;
                  }, 0) || 0)
                : sc.reduce((sum, c) => sum + c.valor, 0);

              const sProfit = s.valor_sugerido - sCost
              const sMargin = s.valor_sugerido > 0 ? (sProfit / s.valor_sugerido) * 100 : 0
              const badgeBg = s.is_pacote ? '#8b5cf622' : '#6366f122'
              const badgeColor = s.is_pacote ? '#8b5cf6' : '#6366f1'
              const temFunil = etapas.some(e => e.pacote_id === s.id)

              return (
                <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: s.is_pacote ? '1px solid #8b5cf640' : undefined }}>
                  <div style={{ height: '5px', background: `linear-gradient(90deg, ${s.cor_hex || '#6366f1'}, ${s.cor_hex || '#6366f1'}88)` }} />

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: badgeBg, color: badgeColor, marginBottom: '6px' }}>
                          {s.is_pacote ? '📦 Pacote Combo' : '🛠️ Serviço / Produção'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{s.nome}</h3></div>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={() => handleOpenModal(s)} className="btn btn-ghost btn-icon btn-sm" title="Editar"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(s.id)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} disabled={deletingId === s.id}>
                          {deletingId === s.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {s.is_pacote && s.pacote_servicos && s.pacote_servicos.length > 0 && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-base)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Serviços Inclusos:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {s.pacote_servicos.map(ps => { const sub = servicos.find(x => x.id === ps.servico_id); return <li key={ps.id || ps.servico_id}>{sub?.nome || 'Serviço excluído'}</li> })}
                        </ul>
                      </div>
                    )}

                    {!s.is_pacote && s.descricao && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.55 }}>{s.descricao}</p>}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-base)', borderRadius: '20px', padding: '3px 10px', border: '1px solid var(--color-border-subtle)' }}><Clock size={11} /> {durationLabel(s.duracao_minutos)}</span>
                      {s.servico_formularios && s.servico_formularios.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-base)', borderRadius: '20px', padding: '3px 10px', border: '1px solid var(--color-border-subtle)' }}><AlignLeft size={11} /> Briefing ativado</span>}
                      {temFunil && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-accent-subtle)', borderRadius: '20px', padding: '3px 10px', border: '1px solid var(--color-accent)' }}><Kanban size={11} color="var(--color-accent)" /> Funil Exclusivo</span>}
                    </div>

                    <div style={{ marginTop: 'auto', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                      {s.is_pacote ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Preço Venda</div>
                              <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{formatCurrency(s.valor_sugerido)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Lucro Líquido</div>
                              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: sProfit >= 0 ? getMarginColor(sMargin) : 'var(--color-danger)' }}>{formatCurrency(sProfit)}</div>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: '5px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, sMargin))}%`, height: '100%', background: getMarginColor(sMargin), borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Custo Base: {formatCurrency(sCost)}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: getMarginColor(sMargin) }}>{sMargin.toFixed(0)}% margem</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <div>
                             <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Custo Total de Produção</div>
                             <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-danger)' }}>{formatCurrency(sCost)}</div>
                           </div>
                           <Tag size={18} color="var(--color-border-strong)" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="animate-fade-in" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '780px', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', background: formColor ? `linear-gradient(135deg, ${formColor}14 0%, transparent 60%)` : undefined, borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', background: formColor, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${formColor}55` }}>
                    {formIsPacote ? <Package size={17} color="#fff" /> : <Tag size={17} color="#fff" />}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{editingService ? 'Editar' : 'Novo'} {formIsPacote ? 'Pacote' : 'Serviço'}</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>{formName || 'Configure os detalhes'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '20px', borderBottom: '1px solid var(--color-border)', margin: '20px -24px -18px', padding: '0 24px', overflowX: 'auto' }}>
                <TabButton active={activeTab === 'geral'} onClick={() => setActiveTab('geral')} icon={<Settings2 size={14}/>} label="Dados Gerais" />
                {!formIsPacote && <TabButton active={activeTab === 'custos'} onClick={() => setActiveTab('custos')} icon={<DollarSign size={14}/>} label="Custos de Produção" />}
                {formIsPacote && <TabButton active={activeTab === 'itens'} onClick={() => setActiveTab('itens')} icon={<Layers size={14}/>} label="Serviços Inclusos" />}
                {formIsPacote && <TabButton active={activeTab === 'formulario'} onClick={() => setActiveTab('formulario')} icon={<AlignLeft size={14}/>} label="Briefing do Pacote" />}
                {formIsPacote && <TabButton active={activeTab === 'funil'} onClick={() => setActiveTab('funil')} icon={<Kanban size={14}/>} label="Funil & Jornada" />}
              </div>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {error && <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>{error}</div>}

                {activeTab === 'geral' && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}><label className="form-label">Nome do {formIsPacote ? 'Pacote' : 'Serviço'} *</label><input type="text" className="form-input" required placeholder={formIsPacote ? "Ex: Combo Maternidade" : "Ex: Ensaio Gestante"} value={formName} onChange={e => setFormName(e.target.value)} /></div>
                      {formIsPacote && (
                         <div className="form-group" style={{ margin: 0 }}><label className="form-label">Preço Sugerido (R$)</label><input type="number" className="form-input" min="0" step="0.01" value={formPrice || ''} onChange={e => setFormPrice(e.target.value ? parseFloat(e.target.value) : 0)} /></div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}><label className="form-label">Duração Total Estimada</label><select className="form-select" value={formDuration} onChange={e => setFormDuration(parseInt(e.target.value))}>{DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Cor de Identificação</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {PRESET_COLORS.map((c) => (<button key={c.hex} type="button" onClick={() => setFormColor(c.hex)} title={c.label} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.hex, border: formColor === c.hex ? `2px solid var(--color-text-primary)` : '2px solid transparent', cursor: 'pointer' }} />))}
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label">Descrição (Opcional)</label><textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
                  </div>
                )}

                {activeTab === 'itens' && formIsPacote && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="alert alert-info" style={{ fontSize: '0.8125rem', display: 'flex', gap: '10px' }}><Layers size={18} style={{ flexShrink: 0 }} /><span>Selecione quais serviços individuais compõem este pacote (isso formará o Custo Base).</span></div>
                    {availableSimpleServices.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-md)' }}>
                        Nenhum Serviço Individual cadastrado. Volte e crie seus serviços primeiro.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {availableSimpleServices.map(s => {
                          const isSelected = formPackageItems.some(p => p.servico_id === s.id)
                          return (
                            <div key={s.id} onClick={() => isSelected ? removePackageItem(s.id) : addPackageItem(s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`, background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--color-accent)' : 'transparent' }}>{isSelected && <Check size={14} color="#fff" />}</div><span style={{ fontWeight: 500, color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{s.nome}</span></div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'formulario' && formIsPacote && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '400px' }}>Crie perguntas que o cliente deve responder ao orçar esse pacote no CRM.</p>
                      <button type="button" onClick={addFormField} className="btn btn-secondary btn-sm"><Plus size={14} /> Nova Pergunta</button>
                    </div>
                    {formFields.length === 0 ? (
                       <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}>Nenhuma pergunta adicionada.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {formFields.map((field, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--color-bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                            <GripVertical size={16} color="var(--color-text-muted)" style={{ cursor: 'grab' }} />
                            <div style={{ flex: 1 }}><input type="text" className="form-input" style={{ fontSize: '0.875rem' }} placeholder="Ex: Nome da Mãe" value={field.pergunta} onChange={e => updateFormField(idx, 'pergunta', e.target.value)} required /></div>
                            <select className="form-select" style={{ width: '130px', fontSize: '0.875rem' }} value={field.tipo_resposta} onChange={e => updateFormField(idx, 'tipo_resposta', e.target.value)}><option value="texto">Texto Curto</option><option value="numero">Número</option><option value="data">Data</option><option value="booleano">Sim / Não</option></select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer' }}><input type="checkbox" checked={field.obrigatorio} onChange={e => updateFormField(idx, 'obrigatorio', e.target.checked)} /> Obrig.</label>
                            <button type="button" onClick={() => removeFormField(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'funil' && formIsPacote && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--color-accent-subtle)', borderRadius: 'var(--radius-md)', border: `1px solid var(--color-accent)` }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9375rem', color: 'var(--color-accent)' }}>Funil Exclusivo</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', maxWidth: '400px' }}>
                          Ative se este pacote precisar de uma jornada ou esteira de produção diferente do padrão do estúdio.
                        </p>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={usarFunilExclusivo} onChange={e => setUsarFunilExclusivo(e.target.checked)} />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', background: 'var(--color-bg-base)', padding: '6px', borderRadius: 'var(--radius-lg)', opacity: usarFunilExclusivo ? 1 : 0.5, pointerEvents: usarFunilExclusivo ? 'auto' : 'none' }}>
                      <button type="button" onClick={() => setTipoPipelineAtivo('vendas')} className={`btn ${tipoPipelineAtivo === 'vendas' ? 'btn-secondary' : 'btn-ghost'}`} style={{ flex: 1 }}><DollarSign size={16} /> Funil de Vendas (CRM)</button>
                      <button type="button" onClick={() => setTipoPipelineAtivo('producao')} className={`btn ${tipoPipelineAtivo === 'producao' ? 'btn-secondary' : 'btn-ghost'}`} style={{ flex: 1 }}><ImageIcon size={16} /> Esteira de Produção</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: usarFunilExclusivo ? 1 : 0.5, pointerEvents: usarFunilExclusivo ? 'auto' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Etapas do Pipeline de {tipoPipelineAtivo === 'vendas' ? 'Vendas' : 'Produção'}</span>
                        <button type="button" onClick={addEtapa} className="btn btn-secondary btn-sm"><Plus size={14} /> Adicionar Etapa</button>
                      </div>

                      {formEtapas.filter(e => e.tipo_pipeline === tipoPipelineAtivo).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}>Nenhuma etapa configurada.</div>
                      ) : (
                        formEtapas.filter(e => e.tipo_pipeline === tipoPipelineAtivo).map((etapa, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--color-bg-base)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                            <GripVertical size={16} color="var(--color-text-muted)" style={{ cursor: 'grab' }} />
                            <div style={{ flex: 1 }}><input type="text" className="form-input" style={{ fontSize: '0.875rem' }} placeholder="Nome da etapa (Ex: Orçamento Enviado)" value={etapa.nome_etapa} onChange={e => updateEtapa(idx, 'nome_etapa', e.target.value)} required /></div>
                            
                            <select className="form-select" style={{ width: '120px', fontSize: '0.875rem' }} value={etapa.cor_hex} onChange={e => updateEtapa(idx, 'cor_hex', e.target.value)}>
                              {PRESET_COLORS.map(c => <option key={c.hex} value={c.hex}>{c.label}</option>)}
                            </select>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: etapa.cor_hex, flexShrink: 0 }}></span>

                            <button type="button" onClick={() => removeEtapa(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'custos' && !formIsPacote && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '400px' }}>Defina os custos diretos da execução deste serviço.</p>
                      <button type="button" onClick={addCostItem} className="btn btn-secondary btn-sm"><Plus size={14} /> Novo Custo</button>
                    </div>
                    {formCosts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}>Nenhum custo cadastrado.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {formCosts.map((cost, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 100px 140px 36px', gap: '10px', alignItems: 'center' }}>
                            <input type="text" className="form-input" style={{ fontSize: '0.875rem' }} placeholder="Ex: Diária Assistente" required value={cost.nome_custo} onChange={e => updateCostItem(idx, 'nome_custo', e.target.value)} />
                            <input type="number" className="form-input" style={{ fontSize: '0.875rem' }} placeholder="R$ 0,00" min="0" step="0.01" required value={cost.valor || ''} onChange={e => updateCostItem(idx, 'valor', e.target.value ? parseFloat(e.target.value) : 0)} />
                            <select className="form-select" style={{ fontSize: '0.875rem' }} value={cost.categoria} onChange={e => updateCostItem(idx, 'categoria', e.target.value)}>{CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                            <button type="button" onClick={() => removeCostItem(idx)} className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: '10px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Custo Total de Produção</span><div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatCurrency(totalCost)}</div></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '140px' }} disabled={saving}>{saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</> : <><Save size={14} /> Salvar Alterações</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-border); transition: .3s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; }
        input:checked + .slider { background-color: var(--color-accent); }
        input:checked + .slider:before { transform: translateX(20px); }
        .slider.round { border-radius: 24px; }
        .slider.round:before { border-radius: 50%; }
      `}} />
    </>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`, color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.875rem' }}>
      {icon} <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}
