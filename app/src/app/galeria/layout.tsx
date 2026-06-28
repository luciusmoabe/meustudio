import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sua Galeria | MeuStudio',
  description: 'Selecione suas fotos favoritas.',
}

export default function GaleriaLayout({ children }: { children: React.ReactNode }) {
  // O layout envolve o children em uma div com a classe 'client-theme' 
  // para garantir que as cores Light Mode premium prevaleçam
  return (
    <div className="client-theme" style={{ minHeight: '100vh', background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
      {children}
    </div>
  )
}
