/**
 * Config versionada por empresa (tabela sdr_company_configs). Toda query leva company_id no WHERE.
 * Salvar SEMPRE cria uma versão nova (nunca sobrescreve): dá para ver o que mudou e voltar.
 */
import { createServiceClient } from '@/lib/supabase/server'
import type { CompanyConfig } from './config-types'
import { validateCompanyConfig, type ConfigValidation } from './config-validate'

type Supabase = ReturnType<typeof createServiceClient>

export interface ConfigVersionRow {
  version: number
  ativo: boolean
  nota: string | null
  created_by: string | null
  created_at: string
}

export async function getActiveConfig(companyId: number, supabase: Supabase = createServiceClient()): Promise<{ version: number; config: CompanyConfig } | null> {
  const { data } = await supabase
    .from('sdr_company_configs')
    .select('version, config')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .maybeSingle()
  return data ? { version: data.version as number, config: data.config as CompanyConfig } : null
}

export async function listConfigVersions(companyId: number, supabase: Supabase = createServiceClient()): Promise<ConfigVersionRow[]> {
  const { data } = await supabase
    .from('sdr_company_configs')
    .select('version, ativo, nota, created_by, created_at')
    .eq('company_id', companyId)
    .order('version', { ascending: false })
    .limit(50)
  return (data ?? []) as ConfigVersionRow[]
}

export type SaveConfigResult =
  | { ok: true; version: number; avisos: string[] }
  | { ok: false; erros: string[]; avisos: string[] }

/** Valida, grava como nova versão e (por padrão) ativa. Com erro de validação nada é gravado. */
export async function saveConfigVersion(
  companyId: number,
  config: Omit<CompanyConfig, 'version'> & { version?: number },
  opts: { nota?: string; createdBy?: string; activate?: boolean } = {},
  supabase: Supabase = createServiceClient(),
): Promise<SaveConfigResult> {
  const { data: last } = await supabase
    .from('sdr_company_configs')
    .select('version')
    .eq('company_id', companyId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((last?.version as number | undefined) ?? 0) + 1
  const full = { ...config, version } as CompanyConfig

  const v: ConfigValidation = validateCompanyConfig(full)
  if (v.erros.length > 0) return { ok: false, erros: v.erros, avisos: v.avisos }

  const activate = opts.activate !== false
  if (activate) {
    const { error } = await supabase.from('sdr_company_configs').update({ ativo: false }).eq('company_id', companyId).eq('ativo', true)
    if (error) return { ok: false, erros: [error.message], avisos: v.avisos }
  }
  const { error: insErr } = await supabase.from('sdr_company_configs').insert({
    company_id: companyId,
    version,
    config: full,
    ativo: activate,
    nota: opts.nota ?? null,
    created_by: opts.createdBy ?? null,
  })
  if (insErr) return { ok: false, erros: [insErr.message], avisos: v.avisos }
  return { ok: true, version, avisos: v.avisos }
}
