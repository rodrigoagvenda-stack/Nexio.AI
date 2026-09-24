import type { SupabaseClient } from '@supabase/supabase-js';
import { logToItem } from './model';
import { sanitizePrefs } from './prefs-shared';
import { pushConfigured, sendPush, type PushTarget } from '@/lib/push/send';

type PushGroup = 'handoff' | 'billing' | 'messages';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Push (aviso com a aba fechada) para as pessoas da empresa que ligaram isso neste aparelho
 * e não desligaram a categoria nas preferências. `onlyUserIds` restringe a algumas pessoas.
 */
export async function pushToCompany(
  supabase: SupabaseClient,
  companyId: number,
  group: PushGroup,
  payload: { title: string; body: string; url: string; tag: string },
  onlyUserIds?: string[],
): Promise<number> {
  if (!pushConfigured()) return 0;
  try {
    let query = supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, keys_p256dh, keys_auth')
      .eq('company_id', companyId)
      .not('user_id', 'is', null);
    if (onlyUserIds) query = query.in('user_id', onlyUserIds);
    const { data: subs } = await query;
    if (!subs || subs.length === 0) return 0;

    const userIds = Array.from(new Set(subs.map((s: any) => s.user_id as string)));
    // só quem continua ativo na empresa (membro desativado não recebe aviso)
    const { data: activeRows } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .in('auth_user_id', userIds);
    const active = new Set((activeRows ?? []).map((r: any) => r.auth_user_id as string));
    const { data: prefRows } = await supabase
      .from('user_notification_prefs')
      .select('auth_user_id, prefs')
      .in('auth_user_id', userIds);
    const prefsByUser = new Map((prefRows ?? []).map((r: any) => [r.auth_user_id as string, sanitizePrefs(r.prefs)]));

    const targets: PushTarget[] = subs
      .filter((s: any) => active.has(s.user_id) && (prefsByUser.get(s.user_id) ?? sanitizePrefs(null))[group])
      .map((s: any) => ({ id: s.id, endpoint: s.endpoint, keys_p256dh: s.keys_p256dh, keys_auth: s.keys_auth }));

    return await sendPush(supabase, targets, { ...payload, body: clip(payload.body, 140) });
  } catch (e: any) {
    console.error(`[push:${companyId}] falhou:`, e?.message);
    return 0;
  }
}

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
 * Grava um aviso da empresa em activity_logs (o sino escuta essa tabela em tempo real) e,
 * quando é algo que precisa de uma pessoa, também manda push para quem ligou.
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
    const metadata = { ...(n.metadata ?? {}), ...(n.dedupeKey ? { dedupe: n.dedupeKey } : {}) };
    const { error } = await supabase.from('activity_logs').insert({
      company_id: n.companyId,
      action: n.action,
      description: n.description,
      metadata,
    });
    if (error) {
      console.error(`[notice:${n.companyId}] ${n.action} não gravou:`, error.message);
      return false;
    }

    const item = logToItem({ id: 0, action: n.action, description: n.description, created_at: new Date().toISOString(), read: false, metadata });
    if (item.kind === 'attention' && (item.group === 'handoff' || item.group === 'billing')) {
      await pushToCompany(supabase, n.companyId, item.group, {
        title: item.title,
        body: item.body || 'Abra o Zaapply para ver.',
        url: item.href ?? '/notificacoes',
        tag: `notice-${n.action}`,
      });
    }
    return true;
  } catch (e: any) {
    console.error(`[notice:${n.companyId}] ${n.action} falhou:`, e?.message);
    return false;
  }
}

// Uma mensagem de lead vira aviso no máximo a cada minuto por conversa, para uma rajada não virar 20 avisos.
const lastInboundPush = new Map<string, number>();
const INBOUND_PUSH_GAP_MS = 60_000;

/**
 * Mensagem recebida de um lead. Só chama uma pessoa quando há uma pessoa para chamar:
 *  - conversa atribuída: só quem é o dono dela
 *  - conversa na fila (agente pausado, sem dono): a empresa
 *  - conversa conduzida pelo SDR: ninguém (o agente está respondendo)
 */
export async function notifyInboundMessage(
  supabase: SupabaseClient,
  p: { companyId: number; conversationId: string | number; text: string | null },
): Promise<void> {
  try {
    if (!pushConfigured()) return;
    const key = `${p.companyId}:${p.conversationId}`;
    const now = Date.now();
    if (now - (lastInboundPush.get(key) ?? 0) < INBOUND_PUSH_GAP_MS) return;

    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('nome_do_contato, agente_pausado, assigned_to')
      .eq('id', p.conversationId)
      .eq('company_id', p.companyId)
      .maybeSingle();
    if (!conv || (!conv.agente_pausado && conv.assigned_to == null)) return;

    let onlyUserIds: string[] | undefined;
    if (conv.assigned_to != null) {
      const { data: owner } = await supabase.from('users').select('auth_user_id').eq('id', conv.assigned_to).maybeSingle();
      if (!owner?.auth_user_id) return;
      onlyUserIds = [owner.auth_user_id as string];
    }

    lastInboundPush.set(key, now);
    if (lastInboundPush.size > 5000) {
      lastInboundPush.forEach((t, k) => { if (now - t > INBOUND_PUSH_GAP_MS) lastInboundPush.delete(k); });
    }
    await pushToCompany(
      supabase,
      p.companyId,
      'messages',
      {
        title: conv.nome_do_contato || 'Nova mensagem',
        body: p.text || 'Arquivo de mídia',
        url: `/atendimento?convId=${p.conversationId}`,
        tag: `msg-${p.conversationId}`,
      },
      onlyUserIds,
    );
  } catch (e: any) {
    console.error(`[push:${p.companyId}] mensagem recebida falhou:`, e?.message);
  }
}
