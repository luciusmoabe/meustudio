'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UploadCloud, Image as ImageIcon, Heart, CheckCircle2,
  Lock, LayoutGrid, X, Loader2, Trash2, Link, ExternalLink,
  ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

// ============================================================
// TIPOS
// ============================================================
type Sessao = {
  id: string
  titulo_sessao: string
  status: string
  limite_fotos: number | null
  fotos_selecionadas: number | null
  leads_propostas: { nome_cliente: string; link_magico_token: string | null } | null
}

type Midia = {
  id: string
  sessao_id: string
  nome_arquivo: string
  storage_path: string
  selecionada: boolean
  favorita: boolean
  visivel_cliente: boolean
}

// ============================================================
// COMPONENTE
// ============================================================
export default function GaleriasClient({ fotografoId, sessoesIniciais, midiasIniciais }: { fotografoId: string, sessoesIniciais: Sessao[], midiasIniciais: Midia[] }) {
  const supabase = createClient()
  const [sessoes, setSessoes] = useState<Sessao[]>(sessoesIniciais)
  const [midias, setMidias] = useState<Midia[]>(midiasIniciais)
  const [sessaoAtiva, setSessaoAtiva] = useState<Sessao | null>(sessoes.length > 0 ? sessoes[0] : null)
  
  const [uploading, setUploading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const midiasSessao = midias.filter(m => m.sessao_id === sessaoAtiva?.id)
  const selecionadas = midiasSessao.filter(m => m.selecionada).length

  // ============================================================
  // UPLOAD DE FOTOS (RF16)
  // ============================================================
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !sessaoAtiva) return

    setUploading(true)
    setProgresso(0)
    const novasMidias: Midia[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()
      const fileName = `${uuidv4()}.${ext}`
      const path = `${fotografoId}/${sessaoAtiva.id}/${fileName}`

      // Tenta fazer upload para o bucket 'galerias'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('galerias')
        .upload(path, file)

      let storagePath = path
      
      // Se o bucket não existir ou falhar, criamos um mock com object URL para a demo funcionar (Fallback MVP)
      if (uploadError) {
        console.warn('Erro ao upar (bucket galerias não existe?). Usando ObjectURL como fallback MVP.', uploadError)
        storagePath = URL.createObjectURL(file)
      } else if (uploadData) {
        // Se deu certo, pega a URL pública (assumindo bucket público para simplificar o MVP)
        const { data } = supabase.storage.from('galerias').getPublicUrl(path)
        storagePath = data.publicUrl
      }

      // Registra no banco
      const payload = {
        fotografo_id: fotografoId,
        sessao_id: sessaoAtiva.id,
        nome_arquivo: file.name,
        storage_path: storagePath,
        tamanho_bytes: file.size,
        mime_type: file.type,
      }

      const { data: midiaRecord, error: dbError } = await supabase
        .from('midias_galeria')
        .insert(payload)
        .select()
        .single()

      if (midiaRecord && !dbError) {
        novasMidias.push(midiaRecord)
      }

      setProgresso(Math.round(((i + 1) / files.length) * 100))
    }

    setMidias(prev => [...prev, ...novasMidias])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ============================================================
  // EXCLUIR MÍDIA
  // ============================================================
  async function deletarMidia(midia: Midia) {
    if (!confirm('Deseja excluir esta foto?')) return
    
    await supabase.from('midias_galeria').delete().eq('id', midia.id)
    
    // Se for ObjectURL, não tenta deletar do bucket
    if (!midia.storage_path.startsWith('blob:')) {
      // Extrai o path correto do DB se foi upado no bucket real
      const pathPart = midia.storage_path.split('galerias/')[1]
      if (pathPart) {
        await supabase.storage.from('galerias').remove([pathPart])
      }
    }
    
    setMidias(prev => prev.filter(m => m.id !== midia.id))
  }

  // ============================================================
  // DISPONIBILIZAR PARA CLIENTE
  // ============================================================
  async function marcarProntaEntrega() {
    if (!sessaoAtiva) return
    const { error } = await supabase.from('sessoes_agenda').update({ status: 'pronta_entrega' }).eq('id', sessaoAtiva.id)
    if (!error) {
      setSessoes(prev => prev.map(s => s.id === sessaoAtiva.id ? { ...s, status: 'pronta_entrega' } : s))
      setSessaoAtiva({ ...sessaoAtiva, status: 'pronta_entrega' })
    }
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Galerias de Seleção</span>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

        {/* SIDEBAR DE SESSÕES */}
        <div style={{
          width: '280px', borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)', flexShrink: 0,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Sessões em Entrega</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Faça o upload e gerencie as galerias dos clientes.</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {sessoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                Nenhuma sessão em fase de entrega.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sessoes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSessaoAtiva(s)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px',
                      background: sessaoAtiva?.id === s.id ? 'var(--color-accent-subtle)' : 'transparent',
                      border: `1px solid ${sessaoAtiva?.id === s.id ? 'var(--color-accent)' : 'transparent'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: sessaoAtiva?.id === s.id ? 'var(--color-accent)' : 'var(--color-text-primary)', marginBottom: '2px' }}>
                      {s.titulo_sessao}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      {s.leads_propostas?.nome_cliente}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-default" style={{ fontSize: '0.65rem' }}>
                        {s.status === 'entregue' ? 'Entregue' : s.status === 'pronta_entrega' ? 'Aguardando seleção' : 'Em edição'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ImageIcon size={10} /> {midias.filter(m => m.sessao_id === s.id).length}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ÁREA DE GERENCIAMENTO DA GALERIA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-base)' }}>
          {sessaoAtiva ? (
            <>
              {/* Header da Galeria Ativa */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '6px' }}>{sessaoAtiva.titulo_sessao}</h1>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <span>Cliente: <strong>{sessaoAtiva.leads_propostas?.nome_cliente}</strong></span>
                    {sessaoAtiva.limite_fotos && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LayoutGrid size={14} /> Selecionadas: 
                        <strong style={{ color: selecionadas > sessaoAtiva.limite_fotos ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                          {selecionadas} / {sessaoAtiva.limite_fotos}
                        </strong>
                        {selecionadas > sessaoAtiva.limite_fotos && <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Fotos Extras (+R$)</span>}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {sessaoAtiva.leads_propostas?.link_magico_token && (
                    <a
                      href={`/cliente/${sessaoAtiva.leads_propostas.link_magico_token}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      <ExternalLink size={14} /> Portal do Cliente
                    </a>
                  )}

                  {sessaoAtiva.status !== 'pronta_entrega' && sessaoAtiva.status !== 'entregue' && midiasSessao.length > 0 && (
                    <button onClick={marcarProntaEntrega} className="btn btn-primary btn-sm">
                      <CheckCircle2 size={14} /> Liberar para o Cliente
                    </button>
                  )}
                </div>
              </div>

              {/* Grid de Fotos */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                
                {/* Upload Zone */}
                <div style={{ marginBottom: '24px' }}>
                  <input
                    type="file" multiple accept="image/*"
                    ref={fileInputRef} style={{ display: 'none' }}
                    onChange={handleUpload}
                  />
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)',
                      padding: '32px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
                      background: 'var(--color-bg-surface)', transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => !uploading && (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={e => !uploading && (e.currentTarget.style.background = 'var(--color-bg-surface)')}
                  >
                    {uploading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Loader2 size={32} color="var(--color-accent)" style={{ animation: 'spin 1s linear infinite' }} />
                        <div style={{ fontWeight: 600 }}>Fazendo upload... {progresso}%</div>
                        <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--color-accent)', width: `${progresso}%`, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>Adicionar Fotos</h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Arraste imagens ou clique para buscar (JPEG, PNG)</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Grid */}
                {midiasSessao.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {midiasSessao.map(m => (
                      <div key={m.id} className="card" style={{ padding: '8px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '3/2', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--color-bg-base)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.storage_path} alt={m.nome_arquivo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          
                          {/* Indicadores */}
                          {m.selecionada && (
                            <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'var(--color-success)', color: 'white', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={14} />
                            </div>
                          )}
                          {m.favorita && (
                            <div style={{ position: 'absolute', top: '8px', left: m.selecionada ? '36px' : '8px', background: 'white', color: 'var(--color-danger)', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                              <Heart size={14} fill="var(--color-danger)" />
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                            {m.nome_arquivo}
                          </span>
                          <button onClick={() => deletarMidia(m)} className="btn btn-ghost btn-icon" style={{ padding: '4px', color: 'var(--color-text-muted)' }} title="Excluir foto">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>Selecione uma sessão ao lado para gerenciar a galeria.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
