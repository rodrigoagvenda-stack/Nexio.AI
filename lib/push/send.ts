import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

// Envio de Web Push (o aviso que chega com a aba fechada).
// Precisa de chaves VAPID nas variáveis de ambiente do servidor:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e (opcional) VAPID_EMAIL
// Gere com: npx web-push generate-vapid-keys
let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:suporte@zaapply.com.br', pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushTarget {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

/** Envia para cada aparelho. Inscrição que o navegador já descartou (404/410) é apagada. Devolve quantos foram. */
export async function sendPush(supabase: SupabaseClient, targets: PushTarget[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || targets.length === 0) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.keys_p256dh, auth: t.keys_auth } }, body, { TTL: 3600 });
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', t.id);
        } else {
          console.error('[push] falha ao enviar:', err?.statusCode ?? err?.message);
        }
      }
    }),
  );
  return sent;
}
