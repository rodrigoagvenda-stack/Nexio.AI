import { createServiceClient } from '@/lib/supabase/server'

type Severity = 'info' | 'warning' | 'error' | 'critical'

interface LogOpts {
  type: 'sdr' | 'follow_up' | 'billing' | 'webhook' | 'error' | 'system' | string
  severity?: Severity
  message: string
  payload?: Record<string, unknown> | null
  company_id?: number | null
}

export async function syslog(opts: LogOpts): Promise<void> {
  try {
    const sb = createServiceClient()
    await sb.from('system_logs').insert({
      type: opts.type,
      severity: opts.severity ?? 'info',
      message: opts.message,
      payload: opts.payload ?? null,
      company_id: opts.company_id ?? null,
    })
  } catch {
    // Logging must never break the main flow
  }
}
