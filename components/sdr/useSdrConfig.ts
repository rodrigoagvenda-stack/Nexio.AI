'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface AgentPersona {
  nome_agente: string; tom: string; empresa: string
  produto: string; restricoes: string; horario: string
  url_empresa: string; preco: string; periodo_teste: string
  link_teste: string; link_playlist: string; link_agendamento: string
  link_catalogo: string; link_pedido: string; endereco: string
  taxa_entrega: string; tempo_entrega: string; area_entrega: string
  formas_pagamento: string; valor_minimo_pedido: string; pedido_tipo: string
  nicho_id: string
}

export interface SdrCfg {
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: AgentPersona
  agente_ativo: boolean
  instance_status: 'disconnected' | 'connecting' | 'connected'
  instance_phone: string | null
  whatsapp_provider: 'uazapi' | 'meta'
  meta_wa_phone_number_id: string | null
  meta_wa_waba_id: string | null
  meta_ad_account_id: string | null
  meta_ad_account_name: string | null
  meta_pixel_id: string | null
  meta_capi_waba_id: string | null
  meta_capi_page_id: string | null
  google_calendar_id: string
  flow_id: string | null
  inbox_mode: 'suporte' | 'vendas'
  event_title_template: string
  conhecimento_ativo: boolean
  objecoes_ativo: boolean
  billing_recurring: boolean
  meeting_duration_min: number | null
}

export const EMPTY_PERSONA: AgentPersona = {
  nome_agente: '', tom: '', empresa: '', produto: '', restricoes: '', horario: '',
  url_empresa: '', preco: '', periodo_teste: '', link_teste: '', link_playlist: '',
  link_agendamento: '', link_catalogo: '', link_pedido: '', endereco: '',
  taxa_entrega: '', tempo_entrega: '', area_entrega: '',
  formas_pagamento: '', valor_minimo_pedido: '', pedido_tipo: '',
  nicho_id: '',
}

export function parsePersona(raw: string): AgentPersona {
  if (!raw) return { ...EMPTY_PERSONA }
  try { const p = JSON.parse(raw); if (p && typeof p === 'object') return { ...EMPTY_PERSONA, ...p } } catch { /* prompt antigo em texto livre */ }
  return { ...EMPTY_PERSONA }
}

const DEFAULT_CFG: SdrCfg = {
  agent_type: 'atendimento_venda', persona: { ...EMPTY_PERSONA }, agente_ativo: false,
  instance_status: 'disconnected', instance_phone: null, whatsapp_provider: 'uazapi',
  meta_wa_phone_number_id: null, meta_wa_waba_id: null, meta_ad_account_id: null, meta_ad_account_name: null,
  meta_pixel_id: null, meta_capi_waba_id: null, meta_capi_page_id: null, google_calendar_id: '', flow_id: null, inbox_mode: 'suporte', event_title_template: '',
  conhecimento_ativo: true, objecoes_ativo: false, billing_recurring: false, meeting_duration_min: null,
}

/** Configuração do SDR da empresa: uma leitura só, e o salvar manda apenas o que mudou. */
export function useSdrConfig() {
  const [cfg, setCfg] = useState<SdrCfg>(DEFAULT_CFG)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const [configRes, statusRes] = await Promise.all([fetch('/api/sdr/config'), fetch('/api/sdr/status')])
      const data = await configRes.json()
      const live = statusRes.ok ? await statusRes.json() : null
      if (data.config) {
        const c = data.config
        setExists(true)
        setCfg({
          agent_type: c.agent_type ?? 'atendimento_venda',
          persona: parsePersona(c.prompt ?? ''),
          agente_ativo: c.agente_ativo ?? false,
          instance_status: live?.status ?? c.instance_status ?? 'disconnected',
          instance_phone: live?.phone ?? c.instance_phone ?? null,
          whatsapp_provider: c.whatsapp_provider ?? 'uazapi',
          meta_wa_phone_number_id: c.meta_wa_phone_number_id ?? null,
          meta_wa_waba_id: c.meta_wa_waba_id ?? null,
          meta_ad_account_id: c.meta_ad_account_id ?? null,
          meta_ad_account_name: c.meta_ad_account_name ?? null,
          meta_pixel_id: c.meta_pixel_id ?? null,
          meta_capi_waba_id: c.meta_capi_waba_id ?? null,
          meta_capi_page_id: c.meta_capi_page_id ?? null,
          google_calendar_id: c.google_calendar_id ?? '',
          flow_id: c.flow_id ?? null,
          inbox_mode: c.inbox_mode ?? 'suporte',
          event_title_template: c.event_title_template ?? '',
          conhecimento_ativo: c.conhecimento_ativo ?? true,
          objecoes_ativo: c.objecoes_ativo ?? false,
          billing_recurring: c.billing_recurring ?? false,
          meeting_duration_min: c.meeting_duration_min ?? null,
        })
      }
    } catch {
      toast({ title: 'Não foi possível carregar a configuração do agente', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  /** Salva só os campos informados (a persona vai junto como texto JSON no campo prompt). */
  const save = useCallback(async (patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch('/api/sdr/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Não foi possível salvar')
      await reload()
      return true
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Não foi possível salvar', variant: 'destructive' })
      return false
    }
  }, [reload])

  return { cfg, setCfg, exists, loading, reload, save }
}
