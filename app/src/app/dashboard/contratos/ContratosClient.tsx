'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, FileText, Edit2, Trash2, Eye, EyeOff,
  Save, X, Loader2, CheckCircle2, AlertCircle,
  Copy, Tag, DollarSign, Image, Info,
  ChevronDown, ChevronUp, Zap,
} from 'lucide-react'

// ============================================================
// TIPOS
// ============================================================
type Perfil = {
  id: string
  nome_comercial: string
  cpf_cnpj: string
  chave_pix: string
  whatsapp: string
  email_comercial: string
}

type Modelo = {
  id: string
  fotografo_id: string
  nome_template: string
  tipo_sessao: string
  descricao: string | null
  minuta_html: string
  clausulas_extras: string | null
  valor_base: number | null
  percentual_sinal: number
  limite_fotos_contrato: number | null
  ativo: boolean
  versao: number
  criado_em: string
}

// ============================================================
// CONSTANTES
// ============================================================
const TIPOS_SESSAO = [
  { value: 'newborn', label: '👶 Newborn' },
  { value: 'casamento', label: '💍 Casamento' },
  { value: 'corporativo', label: '💼 Corporativo' },
  { value: 'maternidade', label: '🤱 Maternidade' },
  { value: 'familia', label: '👨‍👩‍👧 Família' },
  { value: 'gestante', label: '🤰 Gestante' },
  { value: 'ensaio_externo', label: '🌿 Ensaio Externo' },
  { value: 'evento', label: '🎉 Evento' },
  { value: 'outros', label: '📷 Outros' },
]

// Variáveis disponíveis para injeção (RF04)
const VARIAVEIS = [
  { tag: '{{nome_cliente}}',    descricao: 'Nome completo do cliente',         exemplo: 'Maria da Silva',          grupo: 'cliente' },
  { tag: '{{email_cliente}}',   descricao: 'E-mail do cliente',                exemplo: 'maria@email.com',          grupo: 'cliente' },
  { tag: '{{whatsapp_cliente}}',descricao: 'WhatsApp do cliente',              exemplo: '+55 11 99999-0000',        grupo: 'cliente' },
  { tag: '{{data_sessao}}',     descricao: 'Data da sessão agendada',          exemplo: '15/08/2026',              grupo: 'sessao' },
  { tag: '{{local_sessao}}',    descricao: 'Local da sessão',                  exemplo: 'Studio Lumina - SP',      grupo: 'sessao' },
  { tag: '{{tipo_sessao}}',     descricao: 'Tipo de sessão fotográfica',       exemplo: 'Ensaio Newborn',          grupo: 'sessao' },
  { tag: '{{valor_total}}',     descricao: 'Valor total do contrato',          exemplo: 'R$ 1.200,00',             grupo: 'financeiro' },
  { tag: '{{valor_sinal}}',     descricao: 'Valor do sinal (entrada)',         exemplo: 'R$ 360,00',               grupo: 'financeiro' },
  { tag: '{{limite_fotos}}',    descricao: 'Número máximo de fotos entregues', exemplo: '30',                      grupo: 'financeiro' },
  { tag: '{{nome_comercial}}',  descricao: 'Nome do estúdio',                  exemplo: 'Studio Lumina',           grupo: 'estudio' },
  { tag: '{{cnpj_fotografo}}',  descricao: 'CPF/CNPJ do fotógrafo',           exemplo: '12.345.678/0001-90',      grupo: 'estudio' },
  { tag: '{{pix_estudio}}',     descricao: 'Chave Pix do estúdio',            exemplo: 'financeiro@studio.com',   grupo: 'estudio' },
  { tag: '{{whatsapp_estudio}}',descricao: 'WhatsApp do estúdio',             exemplo: '+55 11 99000-0000',        grupo: 'estudio' },
  { tag: '{{data_contrato}}',   descricao: 'Data de geração do contrato',     exemplo: '10/06/2026',              grupo: 'estudio' },
]

const GRUPOS_LABEL: Record<string, string> = {
  cliente:    '👤 Cliente',
  sessao:     '📅 Sessão',
  financeiro: '💰 Financeiro',
  estudio:    '🏢 Estúdio',
}

// Template inicial de contrato para facilitar o começo
const TEMPLATE_INICIAL = `<h1 style="text-align:center; font-size:18px; margin-bottom:4px;">CONTRATO DE SERVIÇO FOTOGRÁFICO</h1>
<p style="text-align:center; color:#666; font-size:13px; margin-bottom:24px;">{{data_contrato}}</p>

<h2 style="font-size:14px; margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;">1. PARTES</h2>

<p><strong>CONTRATANTE:</strong> {{nome_cliente}}<br>
E-mail: {{email_cliente}} | WhatsApp: {{whatsapp_cliente}}</p>

<p style="margin-top:12px;"><strong>CONTRATADA:</strong> {{nome_comercial}}<br>
CPF/CNPJ: {{cnpj_fotografo}} | Pix: {{pix_estudio}}</p>

<h2 style="font-size:14px; margin:20px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px;">2. OBJETO</h2>

<p>O presente contrato tem por objeto a prestação de serviços fotográficos do tipo <strong>{{tipo_sessao}}</strong>, 
a ser realizado em <strong>{{data_sessao}}</strong>, no local: <strong>{{local_sessao}}</strong>.</p>

<h2 style="font-size:14px; margin:20px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px;">3. VALORES E PAGAMENTO</h2>

<p><strong>Valor Total:</strong> {{valor_total}}<br>
<strong>Sinal (entrada):</strong> {{valor_sinal}} — a ser pago no ato da confirmação.<br>
<strong>Saldo restante:</strong> a combinar conforme acordado entre as partes.</p>

<p>Pagamento do sinal via Pix: <strong>{{pix_estudio}}</strong></p>

<h2 style="font-size:14px; margin:20px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px;">4. ENTREGA</h2>

<p>Serão entregues até <strong>{{limite_fotos}} fotos</strong> editadas em alta resolução, 
no prazo de até 30 dias corridos após a realização da sessão.</p>

<h2 style="font-size:14px; margin:20px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px;">5. DIREITOS AUTORAIS</h2>

<p>As imagens produzidas são de propriedade intelectual do fotógrafo, podendo ser utilizadas 
para divulgação em portfólio e redes sociais, salvo expressa manifestação em contrário do contratante.</p>

<h2 style="font-size:14px; margin:20px 0 8px; border-bottom:1px solid #eee; padding-bottom:4px;">6. CANCELAMENTO</h2>

<p>Em caso de cancelamento pelo contratante, o sinal não será devolvido. Em caso de cancelamento 
pela contratada, o valor do sinal será integralmente reembolsado.</p>

<p style="margin-top:40px; text-align:center;">______________________________&nbsp;&nbsp;&nbsp;&nbsp;______________________________<br>
<small>{{nome_cliente}} (Contratante)</small>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<small>{{nome_comercial}} (Contratada)</small></p>`

function formatCurrency(val: number | null) {
  if (!val) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

// Aplica as variáveis no preview (RF04)
function aplicarVariaveis(html: string, perfil: Perfil): string {
  const agora = new Date().toLocaleDateString('pt-BR')
  return html
    .replace(/\{\{nome_comercial\}\}/g, perfil.nome_comercial || 'Studio Lumina')
    .replace(/\{\{cnpj_fotografo\}\}/g, perfil.cpf_cnpj || '12.345.678/0001-90')
    .replace(/\{\{pix_estudio\}\}/g, perfil.chave_pix || 'pix@estudio.com')
    .replace(/\{\{whatsapp_estudio\}\}/g, perfil.whatsapp || '+55 11 99999-0000')
    .replace(/\{\{data_contrato\}\}/g, agora)
    .replace(/\{\{nome_cliente\}\}/g, '<span style="background:#fef08a;padding:0 3px;border-radius:3px;">Maria da Silva</span>')
    .replace(/\{\{email_cliente\}\}/g, '<span style="background:#fef08a;padding:0 3px;border-radius:3px;">maria@email.com</span>')
    .replace(/\{\{whatsapp_cliente\}\}/g, '<span style="background:#fef08a;padding:0 3px;border-radius:3px;">+55 11 99999-0000</span>')
    .replace(/\{\{data_sessao\}\}/g, '<span style="background:#bfdbfe;padding:0 3px;border-radius:3px;">15/08/2026</span>')
    .replace(/\{\{local_sessao\}\}/g, '<span style="background:#bfdbfe;padding:0 3px;border-radius:3px;">Studio Principal</span>')
    .replace(/\{\{tipo_sessao\}\}/g, '<span style="background:#bfdbfe;padding:0 3px;border-radius:3px;">Ensaio Newborn</span>')
    .replace(/\{\{valor_total\}\}/g, '<span style="background:#bbf7d0;padding:0 3px;border-radius:3px;">R$ 1.200,00</span>')
    .replace(/\{\{valor_sinal\}\}/g, '<span style="background:#bbf7d0;padding:0 3px;border-radius:3px;">R$ 360,00</span>')
    .replace(/\{\{limite_fotos\}\}/g, '<span style="background:#bbf7d0;padding:0 3px;border-radius:3px;">30</span>')
}

// ============================================================
// PROPS
// ============================================================
type TipoSessao = {
  id: string
  nome: string
}

type Props = {
  fotografoId: string
  perfilDados: Perfil
  modelosIniciais: Modelo[]
  tiposSessao: TipoSessao[]
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function ContratosClient({ fotografoId, perfilDados, modelosIniciais, tiposSessao }: Props) {
  const supabase = createClient()
  const [modelos, setModelos] = useState<Modelo[]>(modelosIniciais)
  const [editando, setEditando] = useState<Partial<Modelo> | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [showVars, setShowVars] = useState(true)
  const [varGrupo, setVarGrupo] = useState<string>('todos')

  function novoModelo() {
    setEditando({
      nome_template: '',
      tipo_sessao: tiposSessao && tiposSessao.length > 0 ? tiposSessao[0].id : 'outros',
      descricao: '',
      minuta_html: TEMPLATE_INICIAL,
      clausulas_extras: '',
      valor_base: null,
      percentual_sinal: 30,
      limite_fotos_contrato: null,
      ativo: true,
    })
    setPreview(false)
  }

  function editarModelo(m: Modelo) {
    setEditando({ ...m })
    setPreview(false)
  }

  function inserirVariavel(tag: string) {
    if (!editando) return
    const textarea = document.getElementById('editor-minuta') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const atual = editando.minuta_html ?? ''
      const novo = atual.substring(0, start) + tag + atual.substring(end)
      setEditando(prev => ({ ...prev, minuta_html: novo }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + tag.length, start + tag.length)
      }, 0)
    } else {
      setEditando(prev => ({ ...prev, minuta_html: (prev?.minuta_html ?? '') + tag }))
    }
  }

  async function handleSalvar() {
    if (!editando?.nome_template || !editando?.minuta_html) return
    setSaving(true)
    setStatus('idle')

    const payload = {
      fotografo_id: fotografoId,
      nome_template: editando.nome_template,
      tipo_sessao: editando.tipo_sessao ?? 'outros',
      descricao: editando.descricao ?? null,
      minuta_html: editando.minuta_html,
      clausulas_extras: editando.clausulas_extras ?? null,
      valor_base: editando.valor_base ?? null,
      percentual_sinal: editando.percentual_sinal ?? 30,
      limite_fotos_contrato: editando.limite_fotos_contrato ?? null,
      ativo: editando.ativo ?? true,
    }

    if (editando.id) {
      const { error } = await supabase.from('modelos_contrato').update(payload).eq('id', editando.id)
      if (!error) {
        setModelos(prev => prev.map(m => m.id === editando.id ? { ...m, ...payload } as Modelo : m))
        setStatus('success')
        setStatusMsg('Modelo atualizado!')
      } else {
        setStatus('error')
        setStatusMsg(error.message)
      }
    } else {
      const { data, error } = await supabase.from('modelos_contrato').insert(payload).select().single()
      if (!error && data) {
        setModelos(prev => [data, ...prev])
        setEditando(data)
        setStatus('success')
        setStatusMsg('Modelo criado!')
      } else {
        setStatus('error')
        setStatusMsg(error?.message ?? 'Erro desconhecido')
      }
    }

    setSaving(false)
    setTimeout(() => setStatus('idle'), 3000)
  }

  async function handleDeletar(id: string) {
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return
    setDeleting(id)
    await supabase.from('modelos_contrato').delete().eq('id', id)
    setModelos(prev => prev.filter(m => m.id !== id))
    if (editando?.id === id) setEditando(null)
    setDeleting(null)
  }

  async function toggleAtivo(modelo: Modelo) {
    await supabase.from('modelos_contrato').update({ ativo: !modelo.ativo }).eq('id', modelo.id)
    setModelos(prev => prev.map(m => m.id === modelo.id ? { ...m, ativo: !m.ativo } : m))
  }

  const varsFiltradas = varGrupo === 'todos' ? VARIAVEIS : VARIAVEIS.filter(v => v.grupo === varGrupo)
  const tipoLabel = (v: string) => {
    const found = tiposSessao?.find(t => t.id === v || t.nome.toLowerCase() === v.toLowerCase())
    if (found) return found.nome
    const defaultFound = TIPOS_SESSAO.find(t => t.value === v)
    return defaultFound ? defaultFound.label : v
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Contratos</span>
        <div className="topbar-actions">
          {editando && (
            <>
              {status !== 'idle' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: status === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {status === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {statusMsg}
                </span>
              )}
              <button onClick={() => setPreview(!preview)} className={`btn btn-sm ${preview ? 'btn-secondary' : 'btn-ghost'}`}>
                {preview ? <><EyeOff size={14} /> Editar</> : <><Eye size={14} /> Preview</>}
              </button>
              <button onClick={handleSalvar} className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={14} /> Salvar</>}
              </button>
              <button onClick={() => setEditando(null)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </>
          )}
          {!editando && (
            <button onClick={novoModelo} className="btn btn-primary btn-sm">
              <Plus size={15} /> Novo Modelo
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

        {/* ===== SIDEBAR: Lista de modelos ===== */}
        <div style={{
          width: editando ? '280px' : '100%',
          borderRight: editando ? '1px solid var(--color-border)' : 'none',
          overflowY: 'auto',
          padding: editando ? '16px 12px' : '28px',
          background: 'var(--color-bg-base)',
          transition: 'width 0.3s ease',
          flexShrink: 0,
        }}>
          {!editando && (
            <div className="page-header animate-fade-in">
              <h1>Biblioteca de Contratos</h1>
              <p>Crie e gerencie seus modelos de contrato por nicho. As variáveis <code style={{ background: 'var(--color-bg-elevated)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.8125rem' }}>{'{{variavel}}'}</code> são substituídas automaticamente (RF04).</p>
            </div>
          )}

          {modelos.length === 0 && !editando && (
            <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', marginTop: '8px' }}>
              <div style={{ width: '52px', height: '52px', background: 'var(--color-accent-subtle)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileText size={24} color="var(--color-accent)" />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Nenhum contrato ainda</h3>
              <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)', maxWidth: '340px', margin: '0 auto 24px' }}>
                Crie seu primeiro modelo de contrato. Ele já vem com um template completo pronto para usar.
              </p>
              <button onClick={novoModelo} className="btn btn-primary">
                <Plus size={14} /> Criar primeiro modelo
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: editando ? '8px' : '14px' }}>
            {modelos.map(modelo => (
              <div
                key={modelo.id}
                onClick={() => editarModelo(modelo)}
                style={{
                  background: editando?.id === modelo.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-surface)',
                  border: `1px solid ${editando?.id === modelo.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: editando ? '12px' : '20px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: editando ? '6px' : '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: editando ? '0.8125rem' : '0.9375rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {modelo.nome_template}
                    </div>
                    <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>{tipoLabel(modelo.tipo_sessao)}</span>
                  </div>
                  {!editando && (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleAtivo(modelo)} className="btn btn-ghost btn-icon" title={modelo.ativo ? 'Desativar' : 'Ativar'} style={{ padding: '5px', color: modelo.ativo ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {modelo.ativo ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => handleDeletar(modelo.id)} className="btn btn-ghost btn-icon" title="Excluir" style={{ padding: '5px', color: 'var(--color-danger)' }} disabled={deleting === modelo.id}>
                        {deleting === modelo.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </div>
                {!editando && (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {modelo.valor_base && <span>💰 {formatCurrency(modelo.valor_base)}</span>}
                    {modelo.limite_fotos_contrato && <span>📷 {modelo.limite_fotos_contrato} fotos</span>}
                    {modelo.percentual_sinal && <span>🤝 {modelo.percentual_sinal}% sinal</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== EDITOR ===== */}
        {editando && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Área de edição principal */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Metadados do template */}
              <div className="card animate-fade-in" style={{ padding: '18px' }}>
                <div className="form-grid" style={{ gap: '14px' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nome do Template *</label>
                    <input
                      type="text" className="form-input"
                      placeholder="Ex: Contrato Newborn Premium"
                      value={editando.nome_template ?? ''}
                      onChange={e => setEditando(p => ({ ...p, nome_template: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de Sessão</label>
                    <select className="form-select" value={editando.tipo_sessao ?? 'outros'} onChange={e => setEditando(p => ({ ...p, tipo_sessao: e.target.value }))}>
                      {tiposSessao && tiposSessao.length > 0
                        ? tiposSessao.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)
                        : TIPOS_SESSAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                      }
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descrição interna</label>
                    <input type="text" className="form-input" placeholder="Uso interno, não aparece no contrato" value={editando.descricao ?? ''} onChange={e => setEditando(p => ({ ...p, descricao: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><DollarSign size={12} style={{ display: 'inline', marginRight: '4px' }} />Valor Base (R$)</label>
                    <input type="number" className="form-input" placeholder="1200" min="0" step="0.01" value={editando.valor_base ?? ''} onChange={e => setEditando(p => ({ ...p, valor_base: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">% Sinal</label>
                    <input type="number" className="form-input" placeholder="30" min="1" max="100" value={editando.percentual_sinal ?? 30} onChange={e => setEditando(p => ({ ...p, percentual_sinal: parseFloat(e.target.value) }))} />
                    <span className="form-hint">Percentual de entrada exigido no checkout</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label"><Image size={12} style={{ display: 'inline', marginRight: '4px' }} />Limite de Fotos</label>
                    <input type="number" className="form-input" placeholder="30" min="1" value={editando.limite_fotos_contrato ?? ''} onChange={e => setEditando(p => ({ ...p, limite_fotos_contrato: e.target.value ? parseInt(e.target.value) : null }))} />
                    <span className="form-hint">Ativa cobrança extra quando excedido (RF18)</span>
                  </div>
                </div>
              </div>

              {/* Editor da minuta */}
              <div className="card animate-fade-in" style={{ padding: '18px', flex: 1 }}>
                <div className="card-header" style={{ marginBottom: '12px' }}>
                  <span className="card-title">
                    <span className="card-title-icon"><FileText size={15} /></span>
                    Minuta do Contrato (HTML)
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>RF03 · RF04</span>
                    <button onClick={() => setPreview(!preview)} className={`btn btn-sm ${preview ? 'btn-secondary' : 'btn-ghost'}`}>
                      {preview ? <><EyeOff size={13} /> Código</> : <><Eye size={13} /> Preview</>}
                    </button>
                  </div>
                </div>

                {!preview ? (
                  <textarea
                    id="editor-minuta"
                    className="form-textarea"
                    value={editando.minuta_html ?? ''}
                    onChange={e => setEditando(p => ({ ...p, minuta_html: e.target.value }))}
                    style={{ minHeight: '380px', fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.6 }}
                    placeholder="Cole ou escreva o HTML do seu contrato aqui..."
                  />
                ) : (
                  <div style={{
                    background: '#fff', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: '40px', color: '#1a1a1a',
                    minHeight: '380px', fontFamily: 'Georgia, serif',
                    fontSize: '14px', lineHeight: 1.7,
                  }}
                    dangerouslySetInnerHTML={{ __html: aplicarVariaveis(editando.minuta_html ?? '', perfilDados) }}
                  />
                )}

                {!preview && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Info size={12} />
                    Suporta HTML. Clique nas variáveis ao lado para inserir no cursor.
                  </p>
                )}
              </div>

              {/* Cláusulas extras */}
              <div className="card animate-fade-in" style={{ padding: '18px' }}>
                <div className="card-header" style={{ marginBottom: '12px' }}>
                  <span className="card-title" style={{ fontSize: '0.875rem' }}>Cláusulas Extras (opcional)</span>
                </div>
                <textarea
                  className="form-textarea"
                  value={editando.clausulas_extras ?? ''}
                  onChange={e => setEditando(p => ({ ...p, clausulas_extras: e.target.value }))}
                  placeholder="Cláusulas adicionais específicas para este tipo de contrato..."
                  style={{ minHeight: '100px' }}
                />
              </div>
            </div>

            {/* ===== PAINEL DE VARIÁVEIS ===== */}
            <div style={{
              width: '280px', borderLeft: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={15} color="var(--color-accent)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Variáveis dinâmicas</span>
                </div>
                <button onClick={() => setShowVars(!showVars)} className="btn btn-ghost btn-icon" style={{ padding: '3px' }}>
                  {showVars ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>

              {showVars && (
                <>
                  {/* Filtro por grupo */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {['todos', ...Object.keys(GRUPOS_LABEL)].map(g => (
                      <button key={g} onClick={() => setVarGrupo(g)} className="btn" style={{
                        padding: '3px 10px', fontSize: '0.7rem', borderRadius: 'var(--radius-full)',
                        background: varGrupo === g ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                        color: varGrupo === g ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        border: `1px solid ${varGrupo === g ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}>
                        {g === 'todos' ? 'Todos' : GRUPOS_LABEL[g]}
                      </button>
                    ))}
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
                    {varsFiltradas.map(v => (
                      <button
                        key={v.tag}
                        onClick={() => inserirVariavel(v.tag)}
                        title={`Inserir ${v.tag} — ${v.descricao}`}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid transparent',
                          background: 'transparent',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--color-bg-elevated)'
                          e.currentTarget.style.borderColor = 'var(--color-border)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <code style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontFamily: 'monospace', fontWeight: 600 }}>
                            {v.tag}
                          </code>
                          <Copy size={11} color="var(--color-text-muted)" />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{v.descricao}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '2px', opacity: 0.7 }}>ex: {v.exemplo}</div>
                      </button>
                    ))}
                  </div>

                  {/* Dica */}
                  <div style={{ padding: '12px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-accent-subtle)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-accent)', lineHeight: 1.5, margin: 0 }}>
                      💡 Clique em uma variável para inserir no cursor. No Preview, variáveis são destacadas por cor.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
