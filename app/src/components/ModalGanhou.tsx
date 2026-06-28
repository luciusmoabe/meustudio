'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ThumbsUp, X, FileText, DollarSign,
  Loader2, CheckCircle2, AlertCircle, Zap,
} from 'lucide-react'

type Modelo = {
  id: string
  nome_template: string
  tipo_sessao: string
  valor_base: number | null
  percentual_sinal: number
  limite_fotos_contrato: number | null
  minuta_html: string
}

type Lead = {
  id: string
  nome_cliente: string
  email_cliente: string | null
  whatsapp_cliente: string | null
  tipo_servico: string
  data_pretendida: string | null
  valor_estimado: number | null
}

type Perfil = {
  id: string
  nome_comercial: string
  cpf_cnpj: string
  chave_pix: string | null
  whatsapp: string | null
}

type Props = {
  fotografoId: string
  lead: Lead
  onConfirmado: (leadAtualizado: Record<string, unknown>) => void
  onClose: () => void
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// Injeta variáveis do contrato com os dados reais
function gerarContratoHtml(minuta: string, lead: Lead, perfil: Perfil, valorTotal: number, valorSinal: number, limitefotos: number | null): string {
  const dataHoje = new Date().toLocaleDateString('pt-BR')
  const dataSessao = lead.data_pretendida
    ? new Date(lead.data_pretendida + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A definir'

  return minuta
    .replace(/\{\{nome_cliente\}\}/g, lead.nome_cliente)
    .replace(/\{\{email_cliente\}\}/g, lead.email_cliente ?? '')
    .replace(/\{\{whatsapp_cliente\}\}/g, lead.whatsapp_cliente ?? '')
    .replace(/\{\{data_sessao\}\}/g, dataSessao)
    .replace(/\{\{local_sessao\}\}/g, 'A confirmar')
    .replace(/\{\{tipo_sessao\}\}/g, lead.tipo_servico)
    .replace(/\{\{valor_total\}\}/g, formatCurrency(valorTotal))
    .replace(/\{\{valor_sinal\}\}/g, formatCurrency(valorSinal))
    .replace(/\{\{limite_fotos\}\}/g, String(limitefotos ?? 'A definir'))
    .replace(/\{\{nome_comercial\}\}/g, perfil.nome_comercial)
    .replace(/\{\{cnpj_fotografo\}\}/g, perfil.cpf_cnpj ?? '')
    .replace(/\{\{pix_estudio\}\}/g, perfil.chave_pix ?? '')
    .replace(/\{\{whatsapp_estudio\}\}/g, perfil.whatsapp ?? '')
    .replace(/\{\{data_contrato\}\}/g, dataHoje)
}

export default function ModalGanhou({ fotografoId, lead, onConfirmado, onClose }: Props) {
  const supabase = createClient()

  const [modelos, setModelos] = useState<Modelo[]>([])
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const [modeloId, setModeloId] = useState('')
  const [valorTotal, setValorTotal] = useState(lead.valor_estimado ?? 0)
  const [percSinal, setPercSinal] = useState(30)
  const [numParcelas, setNumParcelas] = useState(1)

  const valorSinal = Math.round(valorTotal * (percSinal / 100) * 100) / 100
  const valorRestante = valorTotal - valorSinal
  const modeloSelecionado = modelos.find(m => m.id === modeloId)

  // Atualiza os valores padrão quando o modelo muda
  useEffect(() => {
    if (modeloSelecionado) {
      if (modeloSelecionado.valor_base) setValorTotal(modeloSelecionado.valor_base)
      setPercSinal(modeloSelecionado.percentual_sinal ?? 30)
    }
  }, [modeloId])

  // Carrega modelos e perfil
  useEffect(() => {
    async function carregar() {
      const [{ data: ms }, { data: pf }] = await Promise.all([
        supabase
          .from('modelos_contrato')
          .select('id, nome_template, tipo_sessao, valor_base, percentual_sinal, limite_fotos_contrato, minuta_html')
          .eq('fotografo_id', fotografoId)
          .eq('ativo', true)
          .order('nome_template'),
        supabase
          .from('perfil_fotografo')
          .select('id, nome_comercial, cpf_cnpj, chave_pix, whatsapp')
          .eq('id', fotografoId)
          .single(),
      ])
      setModelos(ms ?? [])
      setPerfil(pf ?? null)

      // Pré-selecionar modelo do mesmo tipo de serviço se existir
      const match = ms?.find(m => m.tipo_sessao === lead.tipo_servico)
      if (match) {
        setModeloId(match.id)
        if (match.valor_base) setValorTotal(match.valor_base)
        setPercSinal(match.percentual_sinal ?? 30)
      } else if (ms && ms.length > 0) {
        setModeloId(ms[0].id)
      }

      setCarregando(false)
    }
    carregar()
  }, [])

  async function handleConfirmar() {
    if (!modeloId || !perfil) return
    if (valorTotal <= 0) {
      setStatus('error')
      setStatusMsg('O valor total precisa ser maior que zero.')
      return
    }

    setSaving(true)
    setStatus('idle')

    const modelo = modelos.find(m => m.id === modeloId)!
    const contratoHtml = gerarContratoHtml(modelo.minuta_html, lead, perfil, valorTotal, valorSinal, modelo.limite_fotos_contrato)

    const { data, error } = await supabase
      .from('leads_propostas')
      .update({
        status: 'aprovado',
        data_aprovacao: new Date().toISOString(),
        modelo_contrato_id: modeloId,
        valor_total_contratado: valorTotal,
        valor_sinal: valorSinal,
        contrato_html_gerado: contratoHtml,
      })
      .eq('id', lead.id)
      .select('*, cliente_id')
      .single()

    if (error) {
      setStatus('error')
      setStatusMsg('Erro ao aprovar lead: ' + error.message)
      setSaving(false)
      return
    }

    // Gerar parcelas do saldo restante se houver saldo e cliente
    if (data && numParcelas > 0 && valorRestante > 0) {
      const valorParcela = valorRestante / numParcelas;
      const parcelas = [];
      const dataVencBase = new Date();
      
      for (let i = 1; i <= numParcelas; i++) {
        const vencimento = new Date(dataVencBase);
        vencimento.setMonth(vencimento.getMonth() + i);
        
        parcelas.push({
          fotografo_id: fotografoId,
          cliente_id: data.cliente_id,
          lead_id: data.id,
          numero_parcela: i,
          valor: valorParcela,
          data_vencimento: vencimento.toISOString().split('T')[0],
          status: 'pendente'
        });
      }
      
      await supabase.from('parcelas').insert(parcelas);
    }

    // Gerar sessão de agenda baseada no pacote/serviço contratado
    if (data) {
      // Tenta usar data_pretendida ou amanhã como fallback
      const dataInicio = lead.data_pretendida ? lead.data_pretendida + 'T09:00:00' : new Date(Date.now() + 86400000).toISOString();
      await supabase.from('sessoes_agenda').insert({
        fotografo_id: fotografoId,
        lead_id: data.id,
        titulo_sessao: `Ensaio: ${lead.nome_cliente}`,
        descricao: `Sessão gerada automaticamente a partir da proposta aprovada. (Serviço: ${lead.tipo_servico})`,
        data_hora_inicio: dataInicio,
        status: 'agendado',
        limite_fotos: modelo.limite_fotos_contrato
      });
    }

    setStatus('success')
    setStatusMsg('Lead aprovado com sucesso!')
    setTimeout(() => {
      onConfirmado(data)
      onClose()
    }, 1200)

    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-success)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: '520px',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 0 60px rgba(52,211,153,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-success-subtle)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', background: 'var(--color-success)',
              borderRadius: 'var(--radius-md)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ThumbsUp size={16} color="white" />
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-success)' }}>
                Marcar como Ganho
              </span>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                {lead.nome_cliente}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {carregando ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px', color: 'var(--color-text-muted)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Carregando modelos de contrato...
            </div>
          ) : (
            <>
              {/* Alerta sem modelos */}
              {modelos.length === 0 && (
                <div style={{ display: 'flex', gap: '12px', padding: '14px', background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)' }}>
                  <AlertCircle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ color: 'var(--color-warning)', fontSize: '0.875rem', fontWeight: 500, margin: '0 0 4px' }}>
                      Nenhum modelo de contrato encontrado
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', margin: 0 }}>
                      Crie ao menos um modelo na aba <strong>Contratos</strong> antes de aprovar um lead.
                    </p>
                    <a href="/dashboard/contratos" className="btn btn-sm" style={{ marginTop: '10px', textDecoration: 'none', display: 'inline-flex', background: 'var(--color-warning)', color: 'white', border: 'none' }}>
                      Criar modelo agora →
                    </a>
                  </div>
                </div>
              )}

              {modelos.length > 0 && (
                <>
                  {/* Seleção do modelo */}
                  <div className="form-group">
                    <label className="form-label">
                      <FileText size={13} style={{ display: 'inline', marginRight: '5px' }} />
                      Modelo de Contrato *
                    </label>
                    <select
                      className="form-select"
                      value={modeloId}
                      onChange={e => setModeloId(e.target.value)}
                    >
                      <option value="">Selecione um modelo...</option>
                      {modelos.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nome_template} {m.tipo_sessao === lead.tipo_servico ? '⭐ Recomendado' : ''}
                        </option>
                      ))}
                    </select>
                    {modeloSelecionado && (
                      <span className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
                        <Zap size={11} /> {modeloSelecionado.limite_fotos_contrato ? `Limite: ${modeloSelecionado.limite_fotos_contrato} fotos` : 'Sem limite de fotos definido'}
                      </span>
                    )}
                  </div>

                  {/* Valores financeiros */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">
                        <DollarSign size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Total (R$) *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        step="0.01"
                        value={valorTotal}
                        onChange={e => setValorTotal(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">% Sinal</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        max="100"
                        value={percSinal}
                        onChange={e => setPercSinal(parseFloat(e.target.value) || 30)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parcelas (Restante)</label>
                      <select 
                        className="form-select" 
                        value={numParcelas}
                        onChange={e => setNumParcelas(parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Resumo financeiro */}
                  <div style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex', gap: '24px',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Total contratado</div>
                      <div style={{ fontWeight: 700, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>{formatCurrency(valorTotal)}</div>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Sinal ({percSinal}%)</div>
                      <div style={{ fontWeight: 700, fontSize: '1.25rem', fontFamily: 'var(--font-display)', color: 'var(--color-success)' }}>{formatCurrency(valorSinal)}</div>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Saldo: {numParcelas}x</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'var(--font-display)', color: 'var(--color-warning)' }}>
                        {formatCurrency(valorRestante / numParcelas)}
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {status !== 'idle' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                      background: status === 'success' ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
                      border: `1px solid ${status === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                      borderRadius: 'var(--radius-md)',
                      color: status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                      fontSize: '0.875rem',
                    }}>
                      {status === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      {statusMsg}
                    </div>
                  )}

                  {/* Botões */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmar}
                      className="btn btn-success"
                      style={{
                        flex: 2, background: 'var(--color-success)',
                        color: 'white', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}
                      disabled={saving || !modeloId || valorTotal <= 0}
                    >
                      {saving
                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando Contrato...</>
                        : <><FileText size={14} /> Gerar Contrato e Aprovar</>
                      }
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
