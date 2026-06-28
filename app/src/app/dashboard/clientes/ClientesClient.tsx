'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, Search, Phone, Mail, Briefcase, User as UserIcon } from 'lucide-react'
import EditClienteModal from './EditClienteModal'

type Cliente = {
  id: string
  nome: string
  email: string | null
  whatsapp: string | null
  instagram: string | null
  cidade: string | null
  cpf?: string | null
  rg?: string | null
  data_nascimento?: string | null
  endereco?: string | null
  leads_propostas: { id: string }[]
}

type Props = {
  clientes: Cliente[]
}

export default function ClientesClient({ clientes }: Props) {
  const [search, setSearch] = useState('')

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.whatsapp ?? '').includes(search)
  )

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Meus Clientes</span>
      </div>

      <div className="page-content animate-fade-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-info-subtle)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={20} color="var(--color-info)" />
              </div>
              <h1 style={{ fontSize: '1.375rem', marginBottom: '2px' }}>Carteira de Clientes</h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Acompanhe o histórico de relacionamento e contratos do seu estúdio.
            </p>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            {clientesFiltrados.length} de {clientes.length} clientes
          </div>
        </div>

        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={16} color="var(--color-text-muted)" />
            <input
              type="text"
              id="busca-clientes"
              placeholder="Buscar cliente por nome, e-mail ou WhatsApp..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text-primary)', width: '100%', fontSize: '0.875rem' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Contato</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Projetos</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(cliente => (
                <tr key={cliente.id}
                  style={{ borderTop: '1px solid var(--color-border)', fontSize: '0.875rem', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'var(--color-accent-subtle)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: 'var(--color-accent)', fontSize: '0.875rem', flexShrink: 0
                      }}>
                        {cliente.nome[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{cliente.nome}</div>
                        {cliente.cidade && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{cliente.cidade}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--color-text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {cliente.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                          <Mail size={12} color="var(--color-text-muted)" /> {cliente.email}
                        </div>
                      )}
                      {cliente.whatsapp && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                          <Phone size={12} color="var(--color-text-muted)" /> {cliente.whatsapp}
                        </div>
                      )}
                      {!cliente.email && !cliente.whatsapp && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      background: 'var(--color-info-subtle)', color: 'var(--color-info)',
                      padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                      <Briefcase size={11} /> {cliente.leads_propostas?.length || 0} projeto(s)
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Link href={`/dashboard/clientes/${cliente.id}`} className="btn btn-ghost btn-sm" title="Abrir Perfil do Cliente">
                        <UserIcon size={16} /> Perfil
                      </Link>
                      <EditClienteModal cliente={cliente} />
                    </div>
                  </td>
                </tr>
              ))}
              {clientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {search ? `Nenhum cliente encontrado para "${search}".` : 'Nenhum cliente cadastrado no momento.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
