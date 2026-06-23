'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()

  // Fecha o menu mobile automaticamente quando o usuário navega
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  return (
    <div className={`dashboard-layout ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      
      {/* Botão Hamburger (Exibido via CSS apenas no mobile) */}
      <button 
        className="hamburger-btn" 
        onClick={() => setIsMobileOpen(true)}
        aria-label="Abrir Menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay Escurecido no Mobile */}
      <div 
        className="mobile-overlay" 
        onClick={() => setIsMobileOpen(false)} 
      />

      {/* Barra Lateral (Componente Cliente) */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        toggleCollapse={() => setIsCollapsed(!isCollapsed)} 
      />
      
      {/* Área Principal de Conteúdo */}
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
