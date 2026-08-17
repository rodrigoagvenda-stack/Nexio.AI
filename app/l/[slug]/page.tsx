'use client'

import { use, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LandingCapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  const gclid = searchParams.get('gclid')

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/l/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, gclid }),
      })
      const data = await res.json()
      if (!res.ok || !data.waUrl) {
        setError(data.error || 'Não foi possível continuar. Tente novamente.')
        setLoading(false)
        return
      }
      window.location.href = data.waUrl
    } catch {
      setError('Não foi possível continuar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: 24 }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 380, background: '#141414', borderRadius: 16, padding: 32, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      >
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Antes de continuar
        </h1>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 24 }}>
          Informe seu WhatsApp para falar com a gente.
        </p>
        <input
          type="tel"
          inputMode="tel"
          autoFocus
          placeholder="(11) 91234-5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #333',
            background: '#1e1e1e',
            color: '#fff',
            fontSize: 16,
            marginBottom: 16,
          }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 999,
            border: 'none',
            background: '#01573C',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 4px 0 #013b28',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Abrindo WhatsApp...' : 'Continuar no WhatsApp'}
        </button>
      </form>
    </div>
  )
}
