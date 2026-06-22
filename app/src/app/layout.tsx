import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MeuStudio — Gestão de Fotografia',
  description: 'Plataforma SaaS para fotógrafos gerenciarem contratos, leads e entregas de forma profissional.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isTestMode = process.env.PLAYWRIGHT_TEST === '1'

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              const theme = localStorage.getItem('theme') || 'dark';
              if (theme === 'light') {
                document.documentElement.classList.add('light');
              }
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
