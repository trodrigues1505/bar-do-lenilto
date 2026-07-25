'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setClosing(true), 1900)
    const t2 = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`splash ${closing ? 'splash-out' : ''}`}>
      <div className="splash-glow" />
      <img src="/logo.jpg" alt="Bar do Lenilto" className="splash-logo" />
      <div className="splash-title">Bar do Lenilto</div>
      <div className="splash-sub">Gestão de Mesas</div>
    </div>
  )
}
