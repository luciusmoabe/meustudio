'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, Loader2, Lock, Camera, CheckCircle2, ChevronRight, X } from 'lucide-react'
import UpsellBanner from '@/components/UpsellBanner'

type Sessao = {
  id: string
  titulo_sessao: string
  fotografo_id: string
  limite_fotos: number
  fotos_selecionadas: number
  lead_id: string
  fotografo: { nome_comercial: string }
}

type Midia = {
  id: string
  storage_path_watermark: string
  selecionada: boolean
  ordem_exibicao: number
}

export default function GaleriaClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [midias, setMidias] = useState<Midia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  
  // Imagem em destaque (Lightbox)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    async function loadGaleria() {
      // Carregar sessão
      const { data: sessaoData, error: sessaoError } = await supabase
        .from('sessoes_agenda')
        .select(`
          id, titulo_sessao, fotografo_id, limite_fotos, fotos_selecionadas, lead_id,
          fotografo:perfil_fotografo(nome_comercial)
        `)
        .eq('id', params.id)
        .single()

      if (sessaoError || !sessaoData) {
        setError('Galeria não encontrada ou link inválido.')
        setLoading(false)
        return
      }

      setSessao(sessaoData as any)

      // Carregar mídias
      const { data: midiasData, error: midiasError } = await supabase
        .from('midias_galeria')
        .select('id, storage_path_watermark, selecionada, ordem_exibicao')
        .eq('sessao_id', params.id)
        .order('ordem_exibicao', { ascending: true })

      if (midiasData) {
        setMidias(midiasData)
      }
      setLoading(false)
    }

    loadGaleria()
  }, [params.id, supabase])

  // Prevenir clique direito em toda a página para segurança extra (Anti-print)
  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', preventContext)
    return () => document.removeEventListener('contextmenu', preventContext)
  }, [])

  async function toggleSelection(midia: Midia) {
    if (savingId) return
    setSavingId(midia.id)
    const newState = !midia.selecionada
    
    // Otimistic update
    setMidias(prev => prev.map(m => m.id === midia.id ? { ...m, selecionada: newState } : m))
    
    const { error } = await supabase
      .from('midias_galeria')
      .update({ selecionada: newState })
      .eq('id', midia.id)

    if (error) {
      // Revert on error
      setMidias(prev => prev.map(m => m.id === midia.id ? { ...m, selecionada: midia.selecionada } : m))
      alert('Erro ao salvar seleção.')
    }
    setSavingId(null)
  }

  const numSelecionadas = useMemo(() => midias.filter(m => m.selecionada).length, [midias])
  const extras = sessao?.limite_fotos ? Math.max(0, numSelecionadas - sessao.limite_fotos) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={40} className="text-accent" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error || !sessao) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <Lock size={48} color="var(--color-text-muted)" />
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Oops!</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '120px' }}>
      {/* Header Premium do Cliente */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera color="white" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-text-primary)' }}>{sessao.titulo_sessao}</h1>
            <p style={{ fontSize: '0.875rem', margin: 0, color: 'var(--color-text-secondary)' }}>Por {sessao.fotografo.nome_comercial}</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: extras > 0 ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
            {numSelecionadas} <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>{sessao.limite_fotos ? `/ ${sessao.limite_fotos}` : 'selecionadas'}</span>
          </div>
        </div>
      </header>

      {/* Grid de Fotos (Masonry CSS approach) */}
      <main style={{ padding: '32px 24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'start'
        }}>
          {midias.map((midia, idx) => (
            <div key={midia.id} className="animate-fade-in" style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--color-bg-elevated)',
              boxShadow: midia.selecionada ? '0 0 0 4px var(--color-accent)' : 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer',
              animationDelay: `${idx * 0.05}s`
            }}>
              {/* Imagem com bloqueio de salvamento */}
              <div 
                style={{ position: 'relative', paddingBottom: '100%' }}
                onClick={() => { setCurrentImageIndex(idx); setLightboxOpen(true); }}
              >
                <img
                  src={midia.storage_path_watermark || '/placeholder-image.jpg'}
                  alt="Foto da sessão"
                  loading="lazy"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none', // Bloqueia clique direito e drag nativo na imagem
                    userSelect: 'none'
                  }}
                  onContextMenu={e => e.preventDefault()}
                  draggable={false}
                />
                
                {/* Overlay Invisível para capturar clicks (Anti-print reforçado) */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 2 }} />

                {/* Status Badge */}
                {midia.selecionada && (
                  <div style={{
                    position: 'absolute', top: '12px', left: '12px', zIndex: 10,
                    background: 'var(--color-accent)', color: 'white',
                    padding: '6px 12px', borderRadius: 'var(--radius-full)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '0.75rem', fontWeight: 600, boxShadow: 'var(--shadow-md)'
                  }}>
                    <CheckCircle2 size={14} /> Selecionada
                  </div>
                )}
              </div>

              {/* Ações da Foto */}
              <div style={{
                padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--color-bg-surface)', borderTop: '1px solid var(--color-border-subtle)'
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Foto {idx + 1}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelection(midia); }}
                  disabled={savingId === midia.id}
                  className="btn btn-icon"
                  style={{
                    background: midia.selecionada ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                    color: midia.selecionada ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    borderRadius: '50%',
                    border: `1px solid ${midia.selecionada ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    transition: 'all 0.2s',
                    zIndex: 10
                  }}
                >
                  <Heart 
                    size={20} 
                    fill={midia.selecionada ? 'currentColor' : 'none'} 
                    style={{ 
                      transform: savingId === midia.id ? 'scale(0.8)' : 'scale(1)',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox Simples */}
      {lightboxOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <button onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={32} />
          </button>
          
          <img
            src={midias[currentImageIndex].storage_path_watermark}
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
            onContextMenu={e => e.preventDefault()}
            draggable={false}
          />
          
          {/* Overlay anti-print no lightbox */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} onClick={() => setLightboxOpen(false)} />
          
          <div style={{ position: 'absolute', bottom: 30, display: 'flex', gap: '20px', zIndex: 10 }}>
             <button
               onClick={(e) => { e.stopPropagation(); toggleSelection(midias[currentImageIndex]); }}
               style={{
                 background: midias[currentImageIndex].selecionada ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)',
                 color: 'white', border: 'none', padding: '12px 24px', borderRadius: '30px',
                 display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                 backdropFilter: 'blur(4px)', fontSize: '1rem', fontWeight: 600
               }}
             >
               <Heart size={20} fill={midias[currentImageIndex].selecionada ? 'white' : 'none'} />
               {midias[currentImageIndex].selecionada ? 'Selecionada' : 'Selecionar'}
             </button>
          </div>
        </div>
      )}

      {/* Banner Dinâmico de Upsell */}
      <UpsellBanner extras={extras} limite={sessao.limite_fotos} sessaoId={sessao.id} />
    </div>
  )
}
