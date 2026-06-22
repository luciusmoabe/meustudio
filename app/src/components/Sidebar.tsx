'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Image,
  Settings,
  LogOut,
  Camera,
  Wallet,
  Sun,
  Moon,
  Target,
  DollarSign,
  UserCheck,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'principal' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: UserCheck, section: 'principal' },
  { href: '/dashboard/leads', label: 'CRM / Leads', icon: Users, section: 'principal' },
  { href: '/dashboard/contratos', label: 'Contratos', icon: FileText, section: 'principal' },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: DollarSign, section: 'principal' },
  { href: '/dashboard/pagamentos', label: 'Links de Pgto.', icon: Wallet, section: 'principal' },
  { href: '/dashboard/agenda', label: 'Agenda', icon: CalendarDays, section: 'principal' },
  { href: '/dashboard/galerias', label: 'Galerias', icon: Image, section: 'principal' },
  { href: '/dashboard/perfil', label: 'Perfil do Estúdio', icon: Camera, section: 'configuracoes' },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, section: 'configuracoes' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLight = document.documentElement.classList.contains('light')
      setTheme(isLight ? 'light' : 'dark')
    }
  }, [])

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
      setTheme('light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
      setTheme('dark')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const principal = navItems.filter(i => i.section === 'principal')
  const configuracoes = navItems.filter(i => i.section === 'configuracoes')

  return (
    <aside className="sidebar animate-slide-left">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">M</div>
        <span className="sidebar-logo-text">MeuStudio</span>
      </div>

      {/* Navegação */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Principal</span>
        {principal.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}

        <span className="sidebar-section-label" style={{ marginTop: '8px' }}>Configurações</span>
        {configuracoes.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer / Theme Toggle & Logout */}
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={toggleTheme} className="sidebar-item" style={{ cursor: 'pointer' }}>
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
        </button>
        <button onClick={handleLogout} className="sidebar-item" style={{ color: 'var(--color-danger)', cursor: 'pointer' }}>
          <LogOut size={17} />
          Sair da conta
        </button>
      </div>
    </aside>
  )
}
