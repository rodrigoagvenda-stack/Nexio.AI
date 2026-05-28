'use client'

import { useState } from 'react'
import Image from 'next/image'

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function format(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return (
    <input
      type="tel"
      inputMode="numeric"
      placeholder="(11) 99999-9999"
      value={value}
      onChange={e => onChange(format(e.target.value))}
      required
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition"
    />
  )
}

export default function TrialFormPage({ params }: { params: { token: string } }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const whatsapp = telefone.replace(/\D/g, '')

    try {
      const res = await fetch(`/api/trial/webhook/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, whatsapp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro ao processar cadastro.')
      setDone(true)
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/favicon.svg" alt="Logo" width={48} height={48} className="opacity-90" />
        </div>

        {done ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-white">Cadastro realizado!</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              Em instantes você vai receber uma mensagem no WhatsApp com todas as informações do seu período de teste.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">Teste grátis</h1>
              <p className="text-sm text-white/40">Preencha seus dados para ativar o período de teste.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">WhatsApp</label>
                <PhoneInput value={telefone} onChange={setTelefone} />
              </div>

              {erro && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 text-sm transition-colors"
              >
                {loading ? 'Aguarde...' : 'Ativar teste grátis →'}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-white/20 mt-6">
          Ao se cadastrar, você concorda com nossa política de privacidade.
        </p>
      </div>
    </div>
  )
}
