'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle2, X, Wifi } from 'lucide-react'

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

interface Props {
  connected: boolean
  phoneNumber?: string | null
  onConnected: (phoneNumberId: string, wabaId: string, token: string, phone: string) => void
  onDisconnect: () => void
}

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!
const CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID!

export function MetaWhatsAppConnect({ connected, phoneNumber, onConnected, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false)
  const codeRef = useRef<string | null>(null)
  const pendingRef = useRef<{ phoneNumberId?: string; wabaId: string; coex: boolean } | null>(null)
  const globalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onSDKLoad() {
      window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
      console.log('[MetaConnect] SDK init — APP_ID:', FB_APP_ID)
    }
    if (window.FB) {
      onSDKLoad()
    } else {
      window.fbAsyncInit = onSDKLoad
      if (!document.getElementById('facebook-jssdk')) {
        const s = document.createElement('script')
        s.id = 'facebook-jssdk'
        s.src = 'https://connect.facebook.net/pt_BR/sdk.js'
        s.async = true
        document.body.appendChild(s)
      }
    }
  }, [])

  function reset(msg?: string) {
    if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current)
    if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current)
    codeRef.current = null
    pendingRef.current = null
    setLoading(false)
    if (msg) toast({ title: msg, variant: 'destructive' })
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return

        console.log('[MetaConnect] postMessage ▶', data.event, JSON.stringify(data.data ?? {}))

        if (data.event === 'FINISH') {
          const { phone_number_id, waba_id } = data.data ?? {}
          console.log('[MetaConnect] FINISH — phone_number_id:', phone_number_id, '| waba_id:', waba_id)
          if (!phone_number_id || !waba_id) { console.warn('[MetaConnect] FINISH sem ids'); return }
          if (codeRef.current) {
            if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current)
            submit(codeRef.current, phone_number_id, waba_id, false)
          } else {
            pendingRef.current = { phoneNumberId: phone_number_id, wabaId: waba_id, coex: false }
            console.log('[MetaConnect] FINISH salvo — aguardando code')
          }
        } else if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          const { waba_id } = data.data ?? {}
          console.log('[MetaConnect] FINISH_COEX — waba_id:', waba_id)
          if (!waba_id) { console.warn('[MetaConnect] FINISH_COEX sem waba_id'); return }
          if (codeRef.current) {
            if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current)
            submit(codeRef.current, undefined, waba_id, true)
          } else {
            pendingRef.current = { wabaId: waba_id, coex: true }
            console.log('[MetaConnect] FINISH_COEX salvo — aguardando code')
          }
        } else if (data.event === 'CANCEL') {
          const isErr = !!data.data?.error_code
          console.log('[MetaConnect] CANCEL —', isErr
            ? `erro ${data.data.error_code}: ${data.data.error_message}`
            : `step: ${data.data?.current_step}`)
          reset(isErr ? `Erro Meta: ${data.data.error_message}` : 'Conexão cancelada')
        } else {
          console.log('[MetaConnect] evento desconhecido:', data.event)
        }
      } catch (e) {
        console.error('[MetaConnect] postMessage parse error:', e)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function submit(code: string, phoneNumberId: string | undefined, wabaId: string, coex: boolean) {
    console.log('[MetaConnect] submit → /api/meta/whatsapp/connect | coex:', coex, '| wabaId:', wabaId, '| phoneNumberId:', phoneNumberId)
    try {
      const res = await fetch('/api/meta/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, phoneNumberId, wabaId, coex }),
      })
      const json = await res.json()
      console.log('[MetaConnect] backend response', res.status, JSON.stringify(json))
      if (!res.ok) {
        reset(json.error ?? 'Erro ao conectar')
        return
      }
      onConnected(json.phoneNumberId ?? phoneNumberId ?? '', wabaId, json.token, json.phone ?? wabaId)
      toast({ title: 'WhatsApp conectado via Meta ✅' })
      reset()
    } catch (e: any) {
      console.error('[MetaConnect] submit error:', e)
      reset(e?.message ?? 'Erro ao conectar')
    }
  }

  function launch() {
    if (!window.FB) {
      toast({ title: 'SDK Meta ainda carregando, aguarde', variant: 'destructive' })
      return
    }
    console.log('[MetaConnect] launch — APP_ID:', FB_APP_ID, '| CONFIG_ID:', CONFIG_ID)
    window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
    codeRef.current = null
    pendingRef.current = null
    setLoading(true)

    // Timeout global: popup fechado sem evento — reseta após 3 minutos
    globalTimeoutRef.current = setTimeout(() => {
      console.warn('[MetaConnect] timeout global — nenhum evento em 3 min')
      reset('Tempo esgotado. Tente novamente.')
    }, 180_000)

    window.FB.login(
      (response: any) => {
        if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current)
        console.log('[MetaConnect] FB.login callback — status:', response?.status,
          '| authResponse:', JSON.stringify(response?.authResponse ?? null))

        if (response?.authResponse?.code) {
          const code = response.authResponse.code
          codeRef.current = code
          console.log('[MetaConnect] code recebido — aguardando FINISH postMessage')

          if (pendingRef.current) {
            const { phoneNumberId, wabaId, coex } = pendingRef.current
            pendingRef.current = null
            submit(code, phoneNumberId, wabaId, coex)
          } else {
            // FINISH event chega em <2s se vier — espera 5s e auto-discover (code expira em 30s)
            codeTimeoutRef.current = setTimeout(() => {
              console.warn('[MetaConnect] FINISH não chegou em 5s — tentando auto-discover WABA')
              if (codeRef.current) {
                submit(codeRef.current, undefined, '', true)
              } else {
                reset('Fluxo incompleto. Tente novamente.')
              }
            }, 5_000)
          }
        } else {
          console.log('[MetaConnect] sem code — status:', response?.status, '| authResponse:', JSON.stringify(response?.authResponse))
          reset('Login Meta cancelado ou incompleto')
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          version: 'v3',
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: 3,
        },
      }
    )
  }

  if (connected) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <div>
            <p className="text-sm font-medium">Meta Cloud API (CoEx)</p>
            <p className="text-xs text-muted-foreground">{phoneNumber ?? 'Conectado'}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={onDisconnect}>
          <X className="h-3.5 w-3.5 mr-1" />Desconectar
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={launch}
      disabled={loading}
      className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
      size="sm"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
      {loading ? 'Conectando...' : 'Conectar via Meta (CoEx)'}
    </Button>
  )
}
