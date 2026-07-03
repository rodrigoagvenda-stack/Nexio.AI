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

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? '155015019356201'

export function MetaWhatsAppConnect({ connected, phoneNumber, onConnected, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false)
  const sdkRef = useRef(false)

  useEffect(() => {
    function onSDKLoad() {
      window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
      sdkRef.current = true
    }

    if (window.FB) {
      // SDK já presente — inicializa agora
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

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.event === 'FINISH') {
          const { phone_number_id, waba_id } = data.data ?? {}
          if (phone_number_id && waba_id) handleFinish(phone_number_id, waba_id)
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleFinish(phoneNumberId: string, wabaId: string) {
    try {
      window.FB.getLoginStatus(async (response: any) => {
        const shortToken = response?.authResponse?.accessToken
        if (!shortToken) {
          toast({ title: 'Erro ao obter token Meta', variant: 'destructive' })
          setLoading(false)
          return
        }
        const res = await fetch('/api/meta/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortToken, phoneNumberId, wabaId }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast({ title: json.error ?? 'Erro ao conectar', variant: 'destructive' })
          setLoading(false)
          return
        }
        onConnected(phoneNumberId, wabaId, json.token, json.phone ?? phoneNumberId)
        toast({ title: 'WhatsApp conectado via Meta (CoEx) ✅' })
        setLoading(false)
      })
    } catch (e: any) {
      toast({ title: e?.message ?? 'Erro ao conectar', variant: 'destructive' })
      setLoading(false)
    }
  }

  function launch() {
    if (!window.FB) {
      toast({ title: 'SDK Meta ainda carregando, aguarde', variant: 'destructive' })
      return
    }
    // Garante FB.init() antes do login, independente do estado do sdkRef
    console.log('[MetaConnect] launch — FB_APP_ID:', FB_APP_ID)
    window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
    setLoading(true)
    window.FB.login(
      (response: any) => {
        if (!response?.authResponse) {
          setLoading(false)
          toast({ title: 'Login Meta cancelado', variant: 'destructive' })
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'coex', sessionInfoVersion: '3' },
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
