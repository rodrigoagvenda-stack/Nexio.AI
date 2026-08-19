'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle2, X, Target } from 'lucide-react'

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

interface AdAccount {
  id: string
  name: string
  status: number
  currency: string
}

interface Props {
  connected: boolean
  accountName?: string | null
  onConnected: (adAccountId: string, name: string | null) => void
  onDisconnect: () => void
}

const FB_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID!

// Diferente do WhatsApp (Embedded Signup escolhe a conta dentro do próprio
// popup da Meta via config_id), conexão de conta de anúncios usa login
// padrão pedindo o escopo ads_management (superconjunto de ads_read -- já
// aprovado na revisão do app) e depois lista as contas reais do usuário pra
// ele escolher por nome, não por ID cru.
export function MetaAdsConnect({ connected, accountName, onConnected, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null)
  const [picking, setPicking] = useState(false)

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

  async function handleLoginCode(code: string) {
    try {
      const res = await fetch('/api/meta/ads/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? 'Erro ao buscar contas de anúncio', variant: 'destructive' })
        return
      }
      setAccounts(json.accounts)
    } catch (e: any) {
      toast({ title: e?.message ?? 'Erro ao conectar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function launch() {
    if (!window.FB) {
      toast({ title: 'SDK Meta ainda carregando, aguarde', variant: 'destructive' })
      return
    }

    setLoading(true)
    setAccounts(null)
    const timeout = setTimeout(() => {
      setLoading(false)
      toast({ title: 'Fluxo não completado. Tente novamente.', variant: 'destructive' })
    }, 120_000)

    // FB.login rejeita callback async direto ("Expression is of type
    // asyncfunction, not function") -- o callback tem que ser síncrono,
    // disparando a lógica async por dentro sem await.
    window.FB.login(
      (response: any) => {
        clearTimeout(timeout)
        if (!response?.authResponse?.code) {
          setLoading(false)
          toast({ title: 'Login cancelado ou não completado', variant: 'destructive' })
          return
        }
        handleLoginCode(response.authResponse.code)
      },
      {
        scope: 'ads_management,business_management',
        response_type: 'code',
        override_default_response_type: true,
      }
    )
  }

  async function pickAccount(account: AdAccount) {
    setPicking(true)
    try {
      const res = await fetch('/api/meta/ads/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: account.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: json.error ?? 'Erro ao salvar conta de anúncio', variant: 'destructive' })
        return
      }
      onConnected(json.adAccountId ?? account.id, json.name ?? account.name)
      toast({ title: 'Conta de anúncios conectada ✅' })
      setAccounts(null)
    } catch (e: any) {
      toast({ title: e?.message ?? 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setPicking(false)
    }
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

  if (accounts) {
    return (
      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-xs text-muted-foreground mb-1">Escolha a conta de anúncios:</p>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => pickAccount(acc)}
            disabled={picking}
            className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
          >
            <div>
              <p className="text-sm font-medium">{acc.name}</p>
              <p className="text-xs text-muted-foreground">act_{acc.id} · {acc.currency}</p>
            </div>
            {picking && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setAccounts(null)} disabled={picking}>
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={launch}
      disabled={loading || !sdkReady}
      className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
      size="sm"
    >
      {(loading || !sdkReady) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
      {loading ? 'Buscando contas...' : !sdkReady ? 'Carregando...' : 'Conectar via Meta'}
    </Button>
  )
}
