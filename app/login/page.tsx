'use client'

import { createClient } from '@/lib/supabase/client'
import { withBasePath } from '@/lib/basePath'

export default function LoginPage() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    // Sem servidor (GitHub Pages): o Supabase lê o token direto na URL quando
    // o Google redireciona de volta para o app (detectSessionInUrl: true no client).
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${withBasePath('/mesas/')}`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-bgElevated border border-line rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(90deg,#c81d25_0_18px,#6e0f14_18px_36px)]" />
        <img
          src={withBasePath('/logo.jpg')}
          alt="Bar do Lenilto"
          className="w-[90px] h-[90px] mx-auto mt-2 mb-5 rounded-full object-cover shadow-xl"
          style={{ boxShadow: '0 0 24px rgba(200,29,37,.45)' }}
        />
        <h1 className="text-2xl mb-1">Bar do Lenilto</h1>
        <p className="text-muted text-xs tracking-widest mb-8">GESTÃO DE MESAS &amp; PEDIDOS</p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2.5 bg-paper text-[#1a1414] rounded-lg py-3 font-semibold text-sm hover:bg-paperDim transition"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
          </svg>
          Entrar com Google
        </button>

        <p className="text-muted text-[11px] mt-6 leading-relaxed">
          Ao entrar pela primeira vez você recebe o perfil <b>Cliente</b>. Peça para um admin
          liberar seu acesso como Funcionário direto no Supabase.
        </p>
      </div>
    </div>
  )
}
