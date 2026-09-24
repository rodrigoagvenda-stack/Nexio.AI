import type { SupabaseClient } from '@supabase/supabase-js';

interface CompanyNotice {
  companyId: number;
  /** Tipo do aviso. O nome decide em qual grupo ele cai (ver logToItem em model.ts). */
  action: string;
  /** Frase de destaque, ponto final, e depois o detalhe. Ex.: "Franquia esgotada. O agente foi pausado." */
  description: string;
  metadata?: Record<string, unknown>;
  /** Evita repetir o mesmo aviso: com a mesma chave dentro da janela, não grava de novo. */
  dedupeKey?: string;
  dedupeHours?: number;
}

/**
 * Grava um aviso da empresa em activity_logs. O sino escuta essa tabela em tempo real,
 * então o aviso aparece sozinho para todo mundo da empresa.
 * Nunca lança erro: aviso não pode derrubar o fluxo que o gerou (cobrança, webhook, motor do SDR).
 */
export async function logCompanyNotice(supabase: SupabaseClient, n: CompanyNotice): Promise<boolean> {
  try {
    if (n.dedupeKey) {
      const since = new Date(Date.now() - (n.dedupeHours ?? 24) * 3600_000).toISOString();
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('company_id', n.companyId)
        .eq('action', n.action)
        .gte('created_at', since)
        .contains('metadata', { dedupe: n.dedupeKey })
        .limit(1);
      if (existing && existing.length > 0) return false;
    }
    const { error } = await supabase.from('activity_logs').insert({
      company_id: n.companyId,
      action: n.action,
      description: n.description,
      metadata: { ...(n.metadata ?? {}), ...(n.dedupeKey ? { dedupe: n.dedupeKey } : {}) },
    });
    if (error) {
      console.error(`[notice:${n.companyId}] ${n.action} não gravou:`, error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error(`[notice:${n.companyId}] ${n.action} falhou:`, e?.message);
    return false;
  }
}
