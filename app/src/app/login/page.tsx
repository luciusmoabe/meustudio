'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('E-mail ou senha incorretos. Verifique seus dados.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gradient-hero)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow de fundo */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,106,247,0.12) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--gradient-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '1.5rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'white',
            boxShadow: 'var(--shadow-accent)',
          }}>
            M
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', marginBottom: '6px' }}>
            MeuStudio
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Plataforma de gestão para fotógrafos
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            background: 'var(--color-bg-base)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '28px',
          }}>
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                style={{
                  padding: '8px',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  background: mode === m ? 'var(--color-bg-elevated)' : 'transparent',
                  color: mode === m ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '20px', fontSize: '0.8125rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" style={{ marginBottom: '20px', fontSize: '0.8125rem' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                type="email"
                className="form-input"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-input"
                placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading}
              style={{ marginTop: '4px' }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                  {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                </>
              ) : (
                mode === 'login' ? 'Entrar no painel' : 'Criar minha conta'
              )}
            </button>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Ainda não tem conta?{' '}
              <button
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'inherit' }}
              >
                Criar gratuitamente
              </button>
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Seus dados são protegidos com criptografia de ponta a ponta.
        </p>
      </div>
    </div>
  )
}
