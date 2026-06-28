'use client'

import React, { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import {
  Bold, Italic, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo, Redo, 
  Pilcrow
} from 'lucide-react'

// TipTap Editor Extension config
const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
]

// Variaveis disponíveis
const VARIAVEIS = [
  { tag: '{{nome_cliente}}',    descricao: 'Nome completo do cliente',      grupo: 'cliente' },
  { tag: '{{email_cliente}}',   descricao: 'E-mail do cliente',             grupo: 'cliente' },
  { tag: '{{whatsapp_cliente}}',descricao: 'WhatsApp do cliente',           grupo: 'cliente' },
  { tag: '{{data_sessao}}',     descricao: 'Data da sessão agendada',       grupo: 'sessao' },
  { tag: '{{local_sessao}}',    descricao: 'Local da sessão',               grupo: 'sessao' },
  { tag: '{{tipo_sessao}}',     descricao: 'Tipo de sessão fotográfica',    grupo: 'sessao' },
  { tag: '{{valor_total}}',     descricao: 'Valor total do contrato',       grupo: 'financeiro' },
  { tag: '{{valor_sinal}}',     descricao: 'Valor do sinal (entrada)',      grupo: 'financeiro' },
  { tag: '{{limite_fotos}}',    descricao: 'Número máximo de fotos',        grupo: 'financeiro' },
  { tag: '{{nome_comercial}}',  descricao: 'Nome do estúdio',               grupo: 'estudio' },
  { tag: '{{cnpj_fotografo}}',  descricao: 'CPF/CNPJ do fotógrafo',         grupo: 'estudio' },
  { tag: '{{pix_estudio}}',     descricao: 'Chave Pix do estúdio',          grupo: 'estudio' },
  { tag: '{{whatsapp_estudio}}',descricao: 'WhatsApp do estúdio',           grupo: 'estudio' },
  { tag: '{{data_contrato}}',   descricao: 'Data de geração do contrato',   grupo: 'estudio' },
]

type EditorProps = {
  value: string
  onChange: (value: string) => void
}

const ToolbarButton = ({ onClick, isActive = false, disabled = false, children }: { onClick: () => void, isActive?: boolean, disabled?: boolean, children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '6px',
      background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
      color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </button>
)

export default function EditorContratoVisual({ value, onChange }: EditorProps) {
  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none',
        style: 'min-height: 800px; padding: 40px; background: white; color: #111; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 4px; margin: 0 auto; width: 100%; max-width: 800px;',
      },
    },
  })

  const injectVariable = useCallback((tag: string) => {
    if (editor) {
      editor.chain().focus().insertContent(` <strong>${tag}</strong> `).run()
    }
  }, [editor])

  if (!editor) {
    return <div style={{ height: '800px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando editor...</div>
  }

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      
      {/* LADO ESQUERDO: EDITOR WYSIWYG */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* TOOLBAR */}
        <div style={{ 
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', 
          padding: '12px', background: 'var(--color-bg-elevated)', 
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          position: 'sticky', top: '16px', zIndex: 10
        }}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
            <Strikethrough size={16} />
          </ToolbarButton>
          
          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />
          
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>
            <Heading1 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>
            <Heading2 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })}>
            <Heading3 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph')}>
            <Pilcrow size={16} />
          </ToolbarButton>

          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />

          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })}>
            <AlignLeft size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })}>
            <AlignCenter size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })}>
            <AlignRight size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })}>
            <AlignJustify size={16} />
          </ToolbarButton>

          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>
            <List size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>
            <ListOrdered size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>
            <Quote size={16} />
          </ToolbarButton>

          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo size={16} />
          </ToolbarButton>
        </div>

        {/* ÁREA A4 DO EDITOR */}
        <div style={{ background: 'var(--color-bg-subtle)', padding: '40px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <EditorContent editor={editor} />
        </div>

      </div>

      {/* LADO DIREITO: PAINEL DE VARIÁVEIS */}
      <div style={{ width: '320px', flexShrink: 0, position: 'sticky', top: '16px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 16px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            Variáveis Dinâmicas
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
            Clique na variável para inseri-la automaticamente no seu contrato.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {VARIAVEIS.map(v => (
              <button
                key={v.tag}
                type="button"
                onClick={() => injectVariable(v.tag)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '10px 12px', background: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                  e.currentTarget.style.background = 'var(--color-accent-subtle)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.background = 'var(--color-bg-base)'
                }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                  {v.tag}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {v.descricao}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
