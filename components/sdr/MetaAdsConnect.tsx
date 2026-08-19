'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle2, X, Target } from 'lucide-react'

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

interface Props {
  connected: boolean
  accountName?: string | null
  onConnected: (adAccountId: string, name: string | null) => void
  onDisconnect: () => void
}

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!

// Diferente do WhatsApp (Embedded Signup com config_id dedicado), conexão de
// conta de anúncios usa login padrão da Meta pedindo o escopo ads_management
// (superconjunto de ads_read -- lê e opcionalmente gerencia anúncios; é o
// que já veio aprovado na revisão do app, ads_read isolado foi rejeitado).
export function MetaAdsConnect({ connected, accountName, onConnected, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [adAccountId, setAdAccountId] = useState('')

  useEffect(() => {
    function onSDKLoad() {
      window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v21.0' })
      setSdkReady(true)
    }
    if (window.FB) {
      onSDKLoad()
    } else if (!document.getElementById('facebook-jssdk')) {
      window.fbAsyncInit = onSDKLoad
      const s = document.createElement('script')
      s.id = 'facebook-jssdk'
      s.src = 'https://connect.facebook.net/pt_BR/sdk.js'
      s.async = true
      document.body.appendChild(s)
    } else {
      window.fbAsyncInit = onSDKLoad
    }
  }, [])

  function launch() {
    const normalized = adAccountId.trim().replace(/^act_/, '')
    if (!normalized) {
      toast({ title: 'Informe o ID da conta de anúncios primeiro', variant: 'destructive' })
      return
    }
    if (!window.FB) {
      toast({ title: 'SDK Meta ainda carregando, aguarde', variant: 'destructive' })
      return
    }

    setLoading(true)
    const timeout = setTimeout(() => {
      setLoading(false)
      toast({ title: 'Fluxo não completado. Tente novamente.', variant: 'destructive' })
    }, 120_000)

    window.FB.login(
      async (response: any) => {
        clearTimeout(timeout)
        if (!response?.authResponse?.code) {
          setLoading(false)
          toast({ title: 'Login cancelado ou não completado', variant: 'destructive' })
          return
        }
        try {
          const res = await fetch('/api/meta/ads/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.authResponse.code, adAccountId: normalized }),
          })
          const json = await res.json()
          if (!res.ok) {
            toast({ title: json.error ?? 'Erro ao conectar conta de anúncios', variant: 'destructive' })
            setLoading(false)
            return
          }
          onConnected(json.adAccountId ?? normalized, json.name ?? null)
          toast({ title: 'Conta de anúncios conectada ✅' })
        } catch (e: any) {
          toast({ title: e?.message ?? 'Erro ao conectar', variant: 'destructive' })
        } finally {
          setLoading(false)
        }
      },
      {
        scope: 'ads_management,business_management',
        response_type: 'code',
        override_default_response_type: true,
      }
    )
  }

  if (connected) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <div>
            <p className="text-sm font-medium">Conta de anúncios conectada</p>
            <p className="text-xs text-muted-foreground">{accountName ?? 'Conectado'}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={onDisconnect}>
          <X className="h-3.5 w-3.5 mr-1" />Desconectar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Input
        placeholder="ID da conta de anúncios (ex: 123456789012345)"
        value={adAccountId}
        onChange={(e) => setAdAccountId(e.target.value)}
        className="h-9 text-sm"
      />
      <Button
        onClick={launch}
        disabled={loading || !sdkReady}
        className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white shrink-0"
        size="sm"
      >
        {(loading || !sdkReady) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
        {loading ? 'Conectando...' : !sdkReady ? 'Carregando...' : 'Conectar via Meta'}
      </Button>
    </div>
  )
}
