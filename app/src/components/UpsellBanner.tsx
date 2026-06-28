'use client'

import { useState } from 'react'
import { ShoppingCart, ArrowRight, Loader2 } from 'lucide-react'

type Props = {
  extras: number
  limite: number | undefined
  sessaoId: string
}

// Valor mockado por enquanto, pode vir do DB depois
const VALOR_FOTO_EXTRA = 15.00 

export default function UpsellBanner({ extras, limite, sessaoId }: Props) {
  const [loading, setLoading] = useState(false)

  if (!limite || extras <= 0) return null

  const valorTotalExtras = extras * VALOR_FOTO_EXTRA

  async function handleCheckout() {
    setLoading(true)
    // Aqui você integraria com Stripe/Asaas
    // Por exemplo: chamar uma API route que cria o link de pagamento
    // await fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ sessaoId, extras }) })
    setTimeout(() => {
      alert(`Redirecionando para checkout de R$ ${valorTotalExtras.toFixed(2)} (Asaas/Stripe)...`)
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-accent)',
      borderRadius: 'var(--radius-xl)',
      padding: '16px 24px',
      boxShadow: '0 12px 40px rgba(99,78,245,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      width: '90%',
      maxWidth: '600px',
      justifyContent: 'space-between'
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <ShoppingCart size={18} color="var(--color-accent)" />
          <strong style={{ color: 'var(--color-text-primary)' }}>Fotos Extras ({extras})</strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Você ultrapassou o limite do pacote ({limite} fotos). 
          Cada extra sai por <strong>R$ {VALOR_FOTO_EXTRA.toFixed(2)}</strong>.
        </p>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="btn"
        style={{
          background: 'var(--gradient-accent)',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 600,
          boxShadow: 'var(--shadow-accent)',
          whiteSpace: 'nowrap'
        }}
      >
        {loading ? (
          <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processando...</>
        ) : (
          <>Pagar R$ {valorTotalExtras.toFixed(2)} <ArrowRight size={16} /></>
        )}
      </button>
    </div>
  )
}
