'use client'

import { useEffect, useState } from 'react'
import SplashScreen from './SplashScreen'
import RegisterSW from './RegisterSW'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Mostra a animação só uma vez por sessão do navegador
    const already = sessionStorage.getItem('lenilto-splash-shown')
    if (!already) {
      setShowSplash(true)
      sessionStorage.setItem('lenilto-splash-shown', '1')
    }
    setReady(true)
  }, [])

  if (!ready) return null

  return (
    <>
      <RegisterSW />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {children}
    </>
  )
}
