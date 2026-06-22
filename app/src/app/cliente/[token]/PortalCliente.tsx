'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, Clock, Calendar, MapPin,
  QrCode, CreditCard, FileText, Copy,
  Loader2, AlertCircle, ChevronDown,
  ChevronRight, Shield, Smartphone, Camera,
  Image as ImageIcon, Heart, LayoutGrid, Info
} from 'lucide-react'

// ============================================================
// TIPOS
// ============================================================
type Lead = {
  id: string
  nome_cliente: string
  email_cliente: string | null
  tipo_servico: string
  data_pretendida: string | null
  status: string
  valor_total_contratado: number | null
  valor_sinal: number | null
  contrato_html_gerado: string | null
  fotografo_id: string
}

type Perfil = {
  nome_comercial: string
  chave_pix: string
  whatsapp: string
  cor_primaria: string
  cor_secundaria: string
  logo_url: string | null
}

type Sessao = {
  id: string
  titulo_sessao: string
  tipo_sessao: string
  data_hora_inicio: string
  local_sessao: string | null
  status: string
  limite_fotos: number | null
  fotos_selecionadas: number | null
  valor_foto_extra: number | null
}

type Midia = {
  id: string
  sessao_id: string
  nome_arquivo: string
  storage_path_watermark: string | null
  storage_path: string
  selecionada: boolean
  favorita: boolean
  visivel_cliente: boolean
}

type Pagamento = {
  id: string
  tipo_cobranca: string
  valor_bruto: number
  meio_pagamento: string | null
  status: string
  pago_em: string | null
  pix_copia_cola: string | null
  pix_qrcode_url: string | null
  boleto_url: string | null
  boleto_linha_digitavel: string | null
}

type Props = {
  lead: Lead
  perfil: Perfil
  sessoes: Sessao[]
  pagamentos: Pagamento[]
  midiasIniciais: Midia[]
  token: string
}

// ============================================================
// HELPERS
// ============================================================
const formatCurrency = (v: number | null) =>
  !v ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })

const STATUS_SESSAO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  reserva_temporaria: { label: 'Reserva pendente', color: '#fbbf24', icon: <Clock size={14} /> },
  confirmada:         { label: 'Confirmada ✓',     color: '#34d399', icon: <CheckCircle2 size={14} /> },
  em_producao:        { label: 'Em andamento',      color: '#60a5fa', icon: <Camera size={14} /> },
  fotografada:        { label: 'Fotografada',        color: '#a78bfa', icon: <Camera size={14} /> },
  em_edicao:          { label: 'Em edição',          color: '#f472b6', icon: <Clock size={14} /> },
  pronta_entrega:     { label: 'Pronta para entrega!',color: '#34d399', icon: <CheckCircle2 size={14} /> },
  entregue:           { label: 'Entregue ✓',         color: '#34d399', icon: <CheckCircle2 size={14} /> },
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function PortalCliente({ lead, perfil, sessoes, pagamentos, midiasIniciais, token }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<'inicio' | 'pagamento' | 'contrato' | 'sessoes' | 'galeria'>('inicio')
  const [meioPagamento, setMeioPagamento] = useState<'pix' | 'cartao' | 'boleto' | null>(null)
  const [parcelas, setParcelas] = useState(1)
  const [processando, setProcessando] = useState(false)
  const [pagtoFeito, setPagtoFeito] = useState<Pagamento | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [mostrarContrato, setMostrarContrato] = useState(false)
  
  const [midias, setMidias] = useState<Midia[]>(midiasIniciais)
  const [sessaoGaleriaAtiva, setSessaoGaleriaAtiva] = useState<string | null>(sessoes.find(s => ['pronta_entrega', 'entregue'].includes(s.status))?.id ?? null)
  const [pagandoExtraDe, setPagandoExtraDe] = useState<{sessaoId: string, valorExtra: number} | null>(null)

  // Dados do cartão (apenas UI — processamento real é no backend/gateway)
  const [cartao, setCartao] = useState({ numero: '', nome: '', validade: '', cvv: '' })

  const sinalPago = pagamentos.some(p => p.tipo_cobranca === 'sinal' && p.status === 'pago')
  const valorSinal = lead.valor_sinal ?? 0
  const valorTotal = lead.valor_total_contratado ?? 0
  const sinalPendente = pagamentos.find(p => p.tipo_cobranca === 'sinal' && p.status !== 'pago')

  // Gradiente personalizado do estúdio
  const gradiente = `linear-gradient(135deg, ${perfil.cor_primaria}, ${perfil.cor_secundaria})`

  // ============================================================
  // PAGAMENTO via API Route (server-side com service_role — resolve RLS)
  // ============================================================
  async function iniciarPagamento() {
    if (!meioPagamento) return
    setProcessando(true)

    try {
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          meio_pagamento: meioPagamento,
          parcelas: meioPagamento === 'cartao' ? parcelas : undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        alert('Erro ao gerar pagamento: ' + (result.error ?? 'Erro desconhecido'))
        setProcessando(false)
        return
      }

      setPagtoFeito(result.pagamento)
    } catch {
      alert('Erro de conexão. Tente novamente.')
    }

    setProcessando(false)
  }

  async function iniciarPagamentoExtra() {
    if (!meioPagamento || !pagandoExtraDe) return
    setProcessando(true)

    try {
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tipo_cobranca: 'complemento',
          sessao_id: pagandoExtraDe.sessaoId,
          valor_extra: pagandoExtraDe.valorExtra,
          meio_pagamento: meioPagamento,
          parcelas: meioPagamento === 'cartao' ? parcelas : undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        alert('Erro ao gerar pagamento: ' + (result.error ?? 'Erro desconhecido'))
        setProcessando(false)
        return
      }

      // Ao invés de setPagtoFeito global (que trava a tela no sinal), redireciona ou muda a aba
      setPagtoFeito(result.pagamento)
      setAba('pagamento') // Manda para a aba de pagamento para ver o QR/Boleto
      setPagandoExtraDe(null)
    } catch {
      alert('Erro de conexão. Tente novamente.')
    }

    setProcessando(false)
  }

  async function concluirSemExtra(sessaoId: string) {
    if (!confirm('Deseja finalizar a seleção de fotos desta sessão?')) return
    setProcessando(true)
    const selecionadas = midias.filter(m => m.sessao_id === sessaoId && m.selecionada).length
    await supabase.from('sessoes_agenda').update({ 
      fotos_selecionadas: selecionadas,
      status: 'em_edicao'
    }).eq('id', sessaoId)
    alert('Seleção enviada com sucesso!')
    window.location.reload()
  }

  function copiarPix() {
    if (!pagtoFeito?.pix_copia_cola) return
    navigator.clipboard.writeText(pagtoFeito.pix_copia_cola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  // ============================================================
  // GALERIA: Seleção de Fotos (RF16)
  // ============================================================
  async function toggleSelecao(midia: Midia) {
    const novoStatus = !midia.selecionada
    // Otimista
    setMidias(prev => prev.map(m => m.id === midia.id ? { ...m, selecionada: novoStatus } : m))
    
    // Atualiza BD
    await supabase
      .from('midias_galeria')
      .update({ selecionada: novoStatus, selecionada_em: novoStatus ? new Date().toISOString() : null })
      .eq('id', midia.id)
  }

  async function toggleFavorita(midia: Midia) {
    const novoStatus = !midia.favorita
    setMidias(prev => prev.map(m => m.id === midia.id ? { ...m, favorita: novoStatus } : m))
    await supabase.from('midias_galeria').update({ favorita: novoStatus }).eq('id', midia.id)
  }

  // Desativa right-click (RF17)
  const blockContextMenu = (e: React.MouseEvent) => e.preventDefault()

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f8', fontFamily: "'Inter', sans-serif" }}>

      {/* HEADER do Portal */}
      <div style={{ background: gradiente, padding: '0', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
              <Camera size={24} color="white" />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {perfil.nome_comercial}
              </div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
                Portal do Cliente
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '14px', padding: '16px 20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', marginBottom: '4px' }}>Olá,</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '1.375rem', marginBottom: '8px' }}>{lead.nome_cliente} 👋</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle2 size={13} />
                {sinalPago ? 'Pagamento confirmado' : 'Aguardando pagamento do sinal'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={13} />
                Portal seguro e privado
              </span>
            </div>
          </div>
        </div>

        {/* Abas de navegação */}
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 20px', display: 'flex', gap: '0' }}>
          {[
            { id: 'inicio', label: 'Início' },
            { id: 'pagamento', label: sinalPago ? '✓ Pago' : '💳 Pagar Sinal' },
            { id: 'sessoes', label: 'Minhas Sessões' },
            { id: 'galeria', label: 'Galeria' },
            { id: 'contrato', label: 'Contrato' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id as typeof aba)}
              style={{
                padding: '12px 16px',
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 500,
                background: 'transparent',
                color: aba === tab.id ? 'white' : 'rgba(255,255,255,0.65)',
                borderBottom: aba === tab.id ? '2px solid white' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* ===== ABA: INÍCIO ===== */}
        {aba === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Status do sinal */}
            <div style={{
              background: sinalPago ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${sinalPago ? '#86efac' : '#fde68a'}`,
              borderRadius: '14px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                {sinalPago
                  ? <CheckCircle2 size={20} color="#16a34a" />
                  : <Clock size={20} color="#d97706" />
                }
                <span style={{ fontWeight: 600, color: sinalPago ? '#15803d' : '#b45309', fontSize: '0.9375rem' }}>
                  {sinalPago ? 'Sinal confirmado — reserva garantida!' : 'Sinal pendente — confirme sua reserva'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Valor do sinal</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#1f2937' }}>{formatCurrency(valorSinal)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Valor total</div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937' }}>{formatCurrency(valorTotal)}</div>
                </div>
              </div>
              {!sinalPago && (
                <button
                  onClick={() => setAba('pagamento')}
                  style={{
                    marginTop: '16px', width: '100%', padding: '12px',
                    background: gradiente, color: 'white', border: 'none',
                    borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '0.9375rem',
                  }}
                >
                  Pagar sinal agora →
                </button>
              )}
            </div>

            {/* Resumo do contrato */}
            <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937', marginBottom: '14px' }}>📋 Resumo do seu pedido</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Tipo de sessão', value: lead.tipo_servico },
                  { label: 'Estúdio', value: perfil.nome_comercial },
                  { label: 'Total do pacote', value: formatCurrency(valorTotal) },
                  { label: 'Sessões incluídas', value: sessoes.length > 0 ? `${sessoes.length} sessão(ões)` : 'A confirmar' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{item.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contato do estúdio */}
            <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937', marginBottom: '12px' }}>💬 Falar com o estúdio</h3>
              {perfil.whatsapp && (
                <a
                  href={`https://wa.me/${perfil.whatsapp.replace(/\D/g, '')}?text=Olá! Sou ${lead.nome_cliente} e tenho uma dúvida sobre meu contrato.`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 16px', borderRadius: '10px',
                    background: '#f0fdf4', border: '1px solid #86efac',
                    color: '#15803d', textDecoration: 'none', fontWeight: 500, fontSize: '0.875rem',
                  }}
                >
                  <Smartphone size={16} />
                  Enviar mensagem via WhatsApp
                  <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ===== ABA: PAGAMENTO ===== */}
        {aba === 'pagamento' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Sinal já pago */}
            {sinalPago && (!pagtoFeito || pagtoFeito.tipo_cobranca === 'sinal') && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ color: '#15803d', fontWeight: 700, marginBottom: '6px' }}>Pagamento confirmado!</h3>
                <p style={{ color: '#166534', fontSize: '0.875rem' }}>
                  Seu sinal de {formatCurrency(valorSinal)} foi recebido. Sua sessão está garantida!
                </p>
              </div>
            )}

            {/* Pagamento em andamento (QR / boleto gerado) */}
            {pagtoFeito && (!sinalPago || pagtoFeito.tipo_cobranca === 'complemento') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {pagtoFeito.meio_pagamento === 'pix' && (
                  <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <h3 style={{ fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>📱 Pague com Pix</h3>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '20px' }}>Escaneie o QR Code ou copie o código</p>

                    {pagtoFeito.pix_qrcode_url && (
                      <img src={pagtoFeito.pix_qrcode_url} alt="QR Code Pix" style={{ width: '200px', height: '200px', margin: '0 auto 20px', display: 'block', borderRadius: '10px', border: '1px solid #e5e7eb' }} />
                    )}

                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '14px', marginBottom: '14px', wordBreak: 'break-all', fontSize: '0.75rem', color: '#374151', fontFamily: 'monospace', textAlign: 'left', border: '1px solid #e5e7eb', maxHeight: '80px', overflow: 'auto' }}>
                      {pagtoFeito.pix_copia_cola}
                    </div>

                    <button
                      onClick={copiarPix}
                      style={{
                        width: '100%', padding: '12px', cursor: 'pointer',
                        background: copiado ? '#f0fdf4' : gradiente,
                        color: copiado ? '#15803d' : 'white',
                        borderRadius: '10px', fontWeight: 600, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        border: copiado ? '1px solid #86efac' : 'none',
                      }}
                    >
                      {copiado ? <><CheckCircle2 size={16} /> Copiado!</> : <><Copy size={16} /> Copiar código Pix</>}
                    </button>

                    <p style={{ marginTop: '14px', fontSize: '0.75rem', color: '#9ca3af' }}>
                      ⏳ O código expira em 30 minutos. Após o pagamento, você receberá a confirmação automaticamente.
                    </p>
                  </div>
                )}

                {pagtoFeito.meio_pagamento === 'boleto' && (
                  <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>🏦 Boleto Bancário</h3>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '20px' }}>Vence em 3 dias úteis</p>
                    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '14px', marginBottom: '14px', fontFamily: 'monospace', fontSize: '0.8125rem', letterSpacing: '0.05em', color: '#1f2937', border: '1px solid #e5e7eb' }}>
                      {pagtoFeito.boleto_linha_digitavel}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { navigator.clipboard.writeText(pagtoFeito.boleto_linha_digitavel ?? ''); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}
                        style={{ flex: 1, padding: '12px', background: copiado ? '#f0fdf4' : '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar linha'}
                      </button>
                      {pagtoFeito.boleto_url && (
                        <a href={pagtoFeito.boleto_url} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, padding: '12px', background: gradiente, color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <FileText size={14} /> Baixar PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {pagtoFeito.meio_pagamento === 'cartao' && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '24px', textAlign: 'center' }}>
                    <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ color: '#15803d', fontWeight: 700 }}>Pagamento em análise</h3>
                    <p style={{ color: '#166534', fontSize: '0.875rem', marginTop: '6px' }}>
                      Seu cartão foi enviado para aprovação. Você receberá confirmação em instantes.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Formulário de escolha de meio de pagamento */}
            {!pagtoFeito && !sinalPago && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Valor */}
                <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '2px' }}>Valor do sinal a pagar</div>
                    <div style={{ fontWeight: 700, fontSize: '1.75rem', color: '#1f2937' }}>{formatCurrency(valorSinal)}</div>
                  </div>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${perfil.cor_primaria}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={22} color={perfil.cor_primaria} />
                  </div>
                </div>

                {/* Escolha do meio */}
                <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937', marginBottom: '14px' }}>Escolha a forma de pagamento</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { id: 'pix', icon: <QrCode size={20} />, titulo: 'Pix', sub: 'Aprovação instantânea', cor: '#16a34a' },
                      { id: 'cartao', icon: <CreditCard size={20} />, titulo: 'Cartão de Crédito', sub: 'Parcelamento em até 12x', cor: '#2563eb' },
                      { id: 'boleto', icon: <FileText size={20} />, titulo: 'Boleto Bancário', sub: 'Vence em 3 dias úteis', cor: '#d97706' },
                    ].map(m => (
                      <label key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${meioPagamento === m.id ? m.cor : '#e5e7eb'}`,
                        background: meioPagamento === m.id ? `${m.cor}08` : 'transparent',
                        transition: 'all 0.2s',
                      }}>
                        <input type="radio" name="meio" value={m.id} checked={meioPagamento === m.id} onChange={() => setMeioPagamento(m.id as typeof meioPagamento)} style={{ display: 'none' }} />
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${m.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.cor, flexShrink: 0 }}>
                          {m.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9375rem' }}>{m.titulo}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{m.sub}</div>
                        </div>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${meioPagamento === m.id ? m.cor : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {meioPagamento === m.id && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: m.cor }} />}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dados do cartão */}
                {meioPagamento === 'cartao' && (
                  <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937', marginBottom: '14px' }}>Dados do cartão</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Número do cartão</label>
                        <input type="text" placeholder="0000 0000 0000 0000" maxLength={19}
                          value={cartao.numero} onChange={e => setCartao(p => ({ ...p, numero: e.target.value }))}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Nome no cartão</label>
                        <input type="text" placeholder="NOME COMO NO CARTÃO"
                          value={cartao.nome} onChange={e => setCartao(p => ({ ...p, nome: e.target.value.toUpperCase() }))}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Validade</label>
                          <input type="text" placeholder="MM/AA" maxLength={5}
                            value={cartao.validade} onChange={e => setCartao(p => ({ ...p, validade: e.target.value }))}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>CVV</label>
                          <input type="text" placeholder="000" maxLength={4}
                            value={cartao.cvv} onChange={e => setCartao(p => ({ ...p, cvv: e.target.value }))}
                            style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Parcelas</label>
                        <select value={parcelas} onChange={e => setParcelas(parseInt(e.target.value))}
                          style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem', background: 'white', outline: 'none' }}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>
                              {n}x de {formatCurrency(valorSinal / n)} {n === 1 ? '(sem juros)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão confirmar */}
                {meioPagamento && (
                  <button
                    onClick={iniciarPagamento}
                    disabled={processando}
                    style={{
                      padding: '16px', background: gradiente, color: 'white',
                      border: 'none', borderRadius: '12px', fontWeight: 700,
                      fontSize: '1rem', cursor: processando ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '10px', opacity: processando ? 0.7 : 1,
                    }}
                  >
                    {processando ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Gerando pagamento...</> : <>Confirmar pagamento de {formatCurrency(valorSinal)} →</>}
                  </button>
                )}

                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <Shield size={12} /> Ambiente seguro e criptografado
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== ABA: SESSÕES ===== */}
        {aba === 'sessoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sessoes.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '14px', padding: '40px 24px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <Calendar size={40} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280' }}>Nenhuma sessão agendada ainda.<br />O estúdio irá adicionar em breve.</p>
              </div>
            ) : sessoes.map(sessao => {
              const st = STATUS_SESSAO[sessao.status] ?? { label: sessao.status, color: '#9ca3af', icon: <Clock size={14} /> }
              return (
                <div key={sessao.id} style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9375rem', marginBottom: '4px' }}>{sessao.titulo_sessao}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', background: `${st.color}15`, color: st.color, fontSize: '0.75rem', fontWeight: 500 }}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#374151' }}>
                      <Calendar size={14} color="#6b7280" />
                      {formatDateTime(sessao.data_hora_inicio)}
                    </div>
                    {sessao.local_sessao && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#374151' }}>
                        <MapPin size={14} color="#6b7280" />
                        {sessao.local_sessao}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ===== ABA: CONTRATO ===== */}
        {aba === 'contrato' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {!lead.contrato_html_gerado ? (
              <div style={{ background: 'white', borderRadius: '14px', padding: '40px 24px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <FileText size={40} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280' }}>O contrato será disponibilizado pelo estúdio em breve.</p>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color={perfil.cor_primaria} /> Contrato de Serviço
                  </span>
                  <button onClick={() => setMostrarContrato(!mostrarContrato)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: perfil.cor_primaria, fontWeight: 500, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {mostrarContrato ? <><ChevronDown size={14} /> Ocultar</> : <><ChevronRight size={14} /> Ver contrato</>}
                  </button>
                </div>
                {mostrarContrato && (
                  <div style={{ padding: '32px', fontFamily: 'Georgia, serif', fontSize: '14px', lineHeight: 1.7, color: '#1f2937' }}
                    dangerouslySetInnerHTML={{ __html: lead.contrato_html_gerado }} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ABA: GALERIA ===== */}
        {aba === 'galeria' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sessoes.filter(s => ['pronta_entrega', 'entregue'].includes(s.status)).length === 0 ? (
              <div style={{ background: 'white', borderRadius: '14px', padding: '40px 24px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                <ImageIcon size={40} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#6b7280' }}>Nenhuma galeria liberada ainda.<br />Aguarde o aviso do estúdio.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {sessoes.filter(s => ['pronta_entrega', 'entregue'].includes(s.status)).map(s => (
                    <button
                      key={s.id} onClick={() => setSessaoGaleriaAtiva(s.id)}
                      style={{
                        padding: '10px 16px', borderRadius: '99px', whiteSpace: 'nowrap',
                        border: `1px solid ${sessaoGaleriaAtiva === s.id ? perfil.cor_primaria : '#e5e7eb'}`,
                        background: sessaoGaleriaAtiva === s.id ? `${perfil.cor_primaria}15` : 'white',
                        color: sessaoGaleriaAtiva === s.id ? perfil.cor_primaria : '#374151',
                        fontWeight: sessaoGaleriaAtiva === s.id ? 600 : 500, fontSize: '0.875rem',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {s.titulo_sessao}
                    </button>
                  ))}
                </div>

                {sessaoGaleriaAtiva && (() => {
                  const s = sessoes.find(x => x.id === sessaoGaleriaAtiva)!
                  const fotosDaSessao = midias.filter(m => m.sessao_id === s.id)
                  const selecionadas = fotosDaSessao.filter(m => m.selecionada).length
                  const limite = s.limite_fotos ?? 0
                  const ultrapassou = limite > 0 && selecionadas > limite
                  const valorExtraReal = s.valor_foto_extra ?? 25
                  const valorExtraAprox = ultrapassou ? (selecionadas - limite) * valorExtraReal : 0

                  return (
                    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      {/* Header Galeria */}
                      <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>Selecione suas favoritas</h3>
                          {limite > 0 && (
                            <span style={{
                              padding: '4px 12px', borderRadius: '99px', fontSize: '0.8125rem', fontWeight: 600,
                              background: ultrapassou ? '#fee2e2' : '#f3f4f6',
                              color: ultrapassou ? '#b91c1c' : '#374151',
                              border: `1px solid ${ultrapassou ? '#f87171' : '#e5e7eb'}`
                            }}>
                              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                              {selecionadas} / {limite} inclusas
                            </span>
                          )}
                        </div>
                        {ultrapassou && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#b45309', fontSize: '0.8125rem' }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong>Atenção:</strong> Você selecionou {selecionadas - limite} foto(s) extras. 
                              Será gerada uma cobrança complementar aproximada de {formatCurrency(valorExtraAprox)} ao finalizar.
                            </div>
                          </div>
                        )}
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={12} /> Clique na foto para selecionar. Use o ♥️ para destacar as preferidas.
                        </p>
                      </div>

                      {/* Grid de Fotos (Mobile friendly) */}
                      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                        {fotosDaSessao.length === 0 ? (
                          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#9ca3af' }}>As fotos estão sendo processadas...</div>
                        ) : fotosDaSessao.map(midia => (
                          <div key={midia.id} style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f3f4f6', border: `3px solid ${midia.selecionada ? perfil.cor_primaria : 'transparent'}`, transition: 'border 0.2s', cursor: 'pointer' }} onClick={() => toggleSelecao(midia)} onContextMenu={blockContextMenu}>
                            
                            {/* Imagem (com user-select: none e pointer-events limitados para dificultar save-as) */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={midia.storage_path_watermark || midia.storage_path} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', WebkitUserSelect: 'none' }} draggable={false} />
                            
                            {/* CSS Watermark MVP (RF17) */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15, pointerEvents: 'none', transform: 'rotate(-30deg)', fontSize: '1.2rem', fontWeight: 900, color: 'white', textShadow: '0 0 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                              {perfil.nome_comercial}
                            </div>
                            
                            <div style={{ position: 'absolute', inset: 0, background: midia.selecionada ? `${perfil.cor_primaria}20` : 'rgba(0,0,0,0.1)', pointerEvents: 'none' }} />

                            {/* Controles Overlay */}
                            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                              <button onClick={(e) => { e.stopPropagation(); toggleFavorita(midia); }} style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <Heart size={14} fill={midia.favorita ? '#ef4444' : 'transparent'} color={midia.favorita ? '#ef4444' : '#6b7280'} />
                              </button>
                            </div>

                            <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: midia.selecionada ? perfil.cor_primaria : 'rgba(255,255,255,0.9)', color: midia.selecionada ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}>
                                <CheckCircle2 size={16} />
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>

                      {/* Botão Finalizar / Checkout Extras */}
                      <div style={{ padding: '20px', borderTop: '1px solid #f3f4f6', background: '#f9fafb' }}>
                        {pagandoExtraDe?.sessaoId === s.id ? (
                          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <h4 style={{ fontWeight: 600, color: '#1f2937' }}>Pagamento de Fotos Extras</h4>
                              <button onClick={() => setPagandoExtraDe(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                            </div>
                            <div style={{ marginBottom: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.875rem' }}>
                              <strong>Resumo:</strong> Você selecionou {selecionadas - limite} foto(s) extras a {formatCurrency(valorExtraReal)} cada.<br/>
                              <strong>Total a pagar:</strong> {formatCurrency(valorExtraAprox)}
                            </div>

                            {/* Reuse the payment method logic inline for simplicity, or just show a simplified version */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                              {[
                                { id: 'pix', label: 'Pix (Aprovação na hora)', icon: <QrCode size={16}/> },
                                { id: 'cartao', label: 'Cartão de Crédito', icon: <CreditCard size={16}/> },
                                { id: 'boleto', label: 'Boleto Bancário', icon: <FileText size={16}/> },
                              ].map(m => (
                                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: `1px solid ${meioPagamento === m.id ? perfil.cor_primaria : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', background: meioPagamento === m.id ? `${perfil.cor_primaria}10` : 'white' }}>
                                  <input type="radio" name="meio_extra" value={m.id} checked={meioPagamento === m.id} onChange={() => setMeioPagamento(m.id as typeof meioPagamento)} style={{ display: 'none' }} />
                                  <span style={{ color: meioPagamento === m.id ? perfil.cor_primaria : '#6b7280' }}>{m.icon}</span>
                                  <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>{m.label}</span>
                                </label>
                              ))}
                            </div>

                            <button
                              onClick={iniciarPagamentoExtra}
                              disabled={processando || !meioPagamento}
                              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: gradiente, color: 'white', fontWeight: 600, cursor: (processando || !meioPagamento) ? 'not-allowed' : 'pointer', opacity: (processando || !meioPagamento) ? 0.7 : 1 }}
                            >
                              {processando ? 'Gerando...' : `Pagar ${formatCurrency(valorExtraAprox)} e Concluir`}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (ultrapassou) setPagandoExtraDe({ sessaoId: s.id, valorExtra: valorExtraAprox })
                              else concluirSemExtra(s.id)
                            }}
                            disabled={selecionadas === 0 || processando}
                            style={{
                              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                              background: selecionadas > 0 ? gradiente : '#e5e7eb',
                              color: selecionadas > 0 ? 'white' : '#9ca3af',
                              fontWeight: 700, fontSize: '1rem', fontFamily: 'inherit', cursor: selecionadas > 0 ? 'pointer' : 'not-allowed',
                              transition: 'all 0.2s', boxShadow: selecionadas > 0 ? `0 4px 14px ${perfil.cor_primaria}40` : 'none'
                            }}
                          >
                            {processando ? 'Aguarde...' : (
                              ultrapassou ? `Pagar Fotos Extras (${formatCurrency(valorExtraAprox)}) e Concluir` : `Concluir Seleção (${selecionadas} fotos)`
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
