import { createServiceClient } from '@/lib/supabase/server'

type Severity = 'info' | 'warning' | 'error' | 'critical'
type LogType = 'sdr' | 'follow_up' | 'billing' | 'webhook' | 'error' | 'system'

export function writeSystemLog(
  type: LogType,
  severity: Severity,
  companyId: number | null,
  message: string,
  payload?: Record<string, unknown>,
  stackTrace?: string,
): void {
  // Fire-and-forget — never throws, never blocks the main flow
  ;(async () => {
    try {
      const supabase = createServiceClient()
      await supabase.from('system_logs').insert({
        type,
        severity,
        company_id: companyId ?? null,
        message,
        payload: payload ?? null,
        stack_trace: stackTrace ?? null,
      })
    } catch {
      // intentionally silent
    }
  })()
}
