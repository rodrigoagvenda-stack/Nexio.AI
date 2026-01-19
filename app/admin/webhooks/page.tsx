import { createClient } from '@/lib/supabase/server';
import { WebhooksContent } from '@/components/admin/WebhooksContent';

export default async function WebhooksPage() {
  const supabase = await createClient();

  const { data: webhooks } = await supabase
    .from('webhook_configs')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('*')
    .single();

  const { data: uazapiConfig } = await supabase
    .from('uazapi_config')
    .select('*')
    .single();

  return (
    <WebhooksContent
      webhooks={webhooks || []}
      aiConfig={aiConfig}
      uazapiConfig={uazapiConfig}
    />
  );
}
