'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Building2, Phone, MapPin, Wallet, Palette,
  CheckCircle2, AlertCircle, Loader2, Save,
  User, Mail, Hash, Home, Map, Calendar,
} from 'lucide-react'

type Perfil = {
  id?: string
  nome_comercial: string
  nome_responsavel: string
  cpf_cnpj: string
  whatsapp: string
  email_comercial: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  chave_pix: string
  banco: string
  cor_primaria: string
  cor_secundaria: string
  fuso_horario: string
}

const INITIAL: Perfil = {
  nome_comercial: '', nome_responsavel: '', cpf_cnpj: '',
  whatsapp: '', email_comercial: '',
  logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', cep: '',
  chave_pix: '', banco: '',
  cor_primaria: '#7c6af7', cor_secundaria: '#a78bfa',
  fuso_horario: 'America/Sao_Paulo',
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

export default function PerfilPage() {
  const supabase = createClient()
  const [perfil, setPerfil] = useState<Perfil>(INITIAL)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'dados' | 'endereco' | 'financeiro' | 'visual'>('dados')

  useEffect(() => {
    async function loadPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('perfil_fotografo')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) setPerfil(data)
      setLoading(false)
    }
    loadPerfil()
  }, [])

  function update(field: keyof Perfil, value: string) {
    setPerfil(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus('idle')

    const payload = { ...perfil, user_id: userId }

    const { error } = perfil.id
      ? await supabase.from('perfil_fotografo').update(payload).eq('id', perfil.id)
      : await supabase.from('perfil_fotografo').insert(payload)

    if (error) {
      setStatus('error')
      setStatusMsg('Erro ao salvar: ' + error.message)
    } else {
      setStatus('success')
      setStatusMsg('Perfil salvo com sucesso!')
      // Recarrega para pegar o ID
      const { data } = await supabase.from('perfil_fotografo').select('*').eq('user_id', userId!).single()
      if (data) setPerfil(data)
    }

    setSaving(false)
    setTimeout(() => setStatus('idle'), 4000)
  }

  const tabs = [
    { id: 'dados',      label: 'Dados do Estúdio', icon: Building2 },
    { id: 'endereco',   label: 'Endereço',          icon: MapPin },
    { id: 'financeiro', label: 'Financeiro',         icon: Wallet },
    { id: 'visual',     label: 'Identidade Visual',  icon: Palette },
  ] as const

  if (loading) {
    return (
      <>
        <div className="topbar">
          <span className="topbar-title">Perfil do Estúdio</span>
        </div>
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Loader2 size={32} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
            <p className="text-muted">Carregando perfil...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Perfil do Estúdio</span>
        <div className="topbar-actions">
          {status === 'success' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={16} /> Salvo!
            </span>
          )}
          {status === 'error' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              <AlertCircle size={16} /> Erro ao salvar
            </span>
          )}
          <button
            form="perfil-form"
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={saving}
          >
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={14} /> Salvar</>}
          </button>
        </div>
      </div>

      <div className="page-content animate-fade-in">
        <div className="page-header">
          <h1>Perfil do Estúdio</h1>
          <p>Configure os dados institucionais do seu estúdio. Eles serão usados nos contratos e no portal do cliente.</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--color-bg-surface)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          marginBottom: '24px',
          width: 'fit-content',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="btn btn-sm"
                style={{
                  background: activeTab === tab.id ? 'var(--color-bg-elevated)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  border: activeTab === tab.id ? '1px solid var(--color-border)' : '1px solid transparent',
                  gap: '6px',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <form id="perfil-form" onSubmit={handleSave}>

          {/* ======== DADOS DO ESTÚDIO ======== */}
          {activeTab === 'dados' && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon"><Building2 size={16} /></span>
                  Dados Institucionais
                </span>
                <span className="badge badge-accent">RF01</span>
              </div>

              <div className="form-grid" style={{ gap: '20px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    <Building2 size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Nome Comercial do Estúdio *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Studio Lumina"
                    value={perfil.nome_comercial}
                    onChange={e => update('nome_comercial', e.target.value)}
                    required
                  />
                  <span className="form-hint">Aparecerá nos contratos como {"{{nome_comercial}}"}</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <User size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Seu nome completo"
                    value={perfil.nome_responsavel}
                    onChange={e => update('nome_responsavel', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Hash size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    CPF / CNPJ *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: 12.345.678/0001-90"
                    value={perfil.cpf_cnpj}
                    onChange={e => update('cpf_cnpj', e.target.value)}
                    required
                  />
                  <span className="form-hint">Aparecerá nos contratos como {"{{cnpj_fotografo}}"}</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Phone size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+55 11 99999-0000"
                    value={perfil.whatsapp}
                    onChange={e => update('whatsapp', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Mail size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="contato@seuestudio.com"
                    value={perfil.email_comercial}
                    onChange={e => update('email_comercial', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Calendar size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Fuso Horário
                  </label>
                  <select
                    className="form-select"
                    value={perfil.fuso_horario}
                    onChange={e => update('fuso_horario', e.target.value)}
                  >
                    <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="America/Belem">Belém (GMT-3)</option>
                    <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                    <option value="America/Recife">Recife (GMT-3)</option>
                    <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                    <option value="America/Porto_Velho">Porto Velho (GMT-4)</option>
                    <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                    <option value="America/Boa_Vista">Boa Vista (GMT-4)</option>
                    <option value="America/Noronha">Fernando de Noronha (GMT-2)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======== ENDEREÇO ======== */}
          {activeTab === 'endereco' && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon"><MapPin size={16} /></span>
                  Endereço do Estúdio
                </span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">CEP</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="00000-000"
                    value={perfil.cep}
                    onChange={e => update('cep', e.target.value)}
                    maxLength={9}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    <Home size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Logradouro
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Rua, Avenida, Alameda..."
                    value={perfil.logradouro}
                    onChange={e => update('logradouro', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="123"
                    value={perfil.numero}
                    onChange={e => update('numero', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Complemento</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Sala 5, Apto 201..."
                    value={perfil.complemento}
                    onChange={e => update('complemento', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bairro</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nome do bairro"
                    value={perfil.bairro}
                    onChange={e => update('bairro', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <Map size={13} style={{ display: 'inline', marginRight: '5px' }} />
                    Cidade
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="São Paulo"
                    value={perfil.cidade}
                    onChange={e => update('cidade', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estado (UF)</label>
                  <select
                    className="form-select"
                    value={perfil.estado}
                    onChange={e => update('estado', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {ESTADOS_BR.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======== FINANCEIRO ======== */}
          {activeTab === 'financeiro' && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon"><Wallet size={16} /></span>
                  Dados Financeiros
                </span>
                <span className="badge badge-accent">RF01</span>
              </div>

              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Chave Pix *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                    value={perfil.chave_pix}
                    onChange={e => update('chave_pix', e.target.value)}
                  />
                  <span className="form-hint">
                    Aparecerá nos contratos como {"{{pix_estudio}}"} e no checkout do cliente
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Banco</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Nubank, Itaú, Bradesco..."
                    value={perfil.banco}
                    onChange={e => update('banco', e.target.value)}
                  />
                </div>
              </div>

              <hr className="divider" />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'var(--color-info-subtle)', borderRadius: 'var(--radius-md)' }}>
                <Wallet size={18} color="var(--color-info)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ color: 'var(--color-info)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>
                    Gateway de Pagamento
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                    A integração com Stripe ou Asaas para checkout automático será configurada na próxima etapa
                    (Módulo 4 — RF10/RF11).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======== IDENTIDADE VISUAL ======== */}
          {activeTab === 'visual' && (
            <div className="card animate-fade-in">
              <div className="card-header">
                <span className="card-title">
                  <span className="card-title-icon"><Palette size={16} /></span>
                  Identidade Visual
                </span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Cor Primária</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={perfil.cor_primaria}
                      onChange={e => update('cor_primaria', e.target.value)}
                      style={{ width: '48px', height: '40px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'none', padding: '2px' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={perfil.cor_primaria}
                      onChange={e => update('cor_primaria', e.target.value)}
                      maxLength={7}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <span className="form-hint">Usada nos botões e destaques do Portal do Cliente</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Cor Secundária</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={perfil.cor_secundaria}
                      onChange={e => update('cor_secundaria', e.target.value)}
                      style={{ width: '48px', height: '40px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'none', padding: '2px' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      value={perfil.cor_secundaria}
                      onChange={e => update('cor_secundaria', e.target.value)}
                      maxLength={7}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <span className="form-hint">Usada em gradientes e elementos secundários</span>
                </div>
              </div>

              {/* Preview */}
              <hr className="divider" />
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '16px', fontWeight: 500 }}>
                Preview do Portal do Cliente
              </p>
              <div style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  background: `linear-gradient(135deg, ${perfil.cor_primaria}, ${perfil.cor_secundaria})`,
                  padding: '24px',
                  color: 'white',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', marginBottom: '4px' }}>
                    {perfil.nome_comercial || 'Nome do Estúdio'}
                  </div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.85 }}>Portal exclusivo do cliente</div>
                </div>
                <div style={{ background: '#f8f8fa', padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${perfil.cor_primaria}, ${perfil.cor_secundaria})`,
                  }} />
                  <div>
                    <div style={{ background: '#e0e0e8', height: '12px', width: '140px', borderRadius: '6px', marginBottom: '6px' }} />
                    <div style={{ background: '#e0e0e8', height: '10px', width: '100px', borderRadius: '6px' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status message */}
          {status !== 'idle' && (
            <div className={`alert alert-${status === 'success' ? 'success' : 'danger'}`} style={{ marginTop: '16px' }}>
              {status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {statusMsg}
            </div>
          )}
        </form>
      </div>
    </>
  )
}
