'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import {
  Smartphone, KeyRound, Save, Loader2, Eye, EyeOff,
  CreditCard, Calendar, CheckCircle2, XCircle, Copy, CheckCheck, AlertTriangle, Bot, Mic,
} from 'lucide-react';

interface Props {
  initialConfig: Record<string, string>;
  readError?: string;
}

const MASK = '••••••••••••••••';

const SECTIONS = [
  {
    id: 'openai',
    label: 'OpenAI',
    icon: Bot,
    description: 'Chave global da API OpenAI: usada por todos os agentes SDR. Cada empresa pode ter uma chave própria como override.',
    fields: [
      { key: 'openai_api_key', label: 'API Key', placeholder: 'sk-...', sensitive: true },
    ],
  },
  {
    id: 'uazapi',
    label: 'UAZapi',
    icon: Smartphone,
    description: 'Credenciais de administrador para criar instâncias WhatsApp automaticamente para cada empresa.',
    fields: [
      { key: 'uazapi_base_url', label: 'Base URL', placeholder: 'https://seuservidor.uazapi.com', sensitive: false },
      { key: 'uazapi_admin_token', label: 'Admin Token', placeholder: 'admintoken_...', sensitive: true },
    ],
  },
  {
    id: 'google',
    label: 'Google OAuth',
    icon: Calendar,
    description: 'Credenciais OAuth 2.0 para permitir que empresas conectem o Google Calendar.',
    fields: [
      { key: 'google_client_id', label: 'Client ID', placeholder: '123...apps.googleusercontent.com', sensitive: false },
      { key: 'google_client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', sensitive: true },
    ],
    info: 'URI de redirecionamento autorizada: {APP_URL}/api/google/callback',
  },
  {
    id: 'groq',
    label: 'Groq',
    icon: Mic,
    description: 'Transcrição de áudio (Whisper) para mensagens de voz do WhatsApp. Groq oferece Whisper com latência extremamente baixa.',
    fields: [
      { key: 'groq_api_key', label: 'API Key', placeholder: 'gsk_...', sensitive: true },
    ],
  },
  {
    id: 'asaas',
    label: 'Asaas',
    icon: CreditCard,
    description: 'Gateway de pagamentos brasileiro: mensalidades via cartão e pacotes extras via PIX.',
    fields: [
      { key: 'asaas_api_key', label: 'API Key', placeholder: '$aact_...', sensitive: true },
      { key: 'asaas_base_url', label: 'Base URL', placeholder: 'https://api.asaas.com/v3 (produção) ou https://api-sandbox.asaas.com/v3', sensitive: false },
      { key: 'asaas_webhook_token', label: 'Webhook Token', placeholder: 'Token configurado no painel Asaas → Integrações → Webhooks', sensitive: true },
    ],
    info: 'Webhook URL: {APP_URL}/api/webhooks/asaas/billing',
  },
];

function isConfigured(val: string | undefined) {
  return !!val && val.trim() !== '';
}

export function PlatformConfigContent({ initialConfig, readError }: Props) {
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function toggle(key: string) {
    setVisible((p) => ({ ...p, [key]: !p[key] }));
  }

  function handleChange(key: string, value: string) {
    setConfig((p) => ({ ...p, [key]: value }));
  }

  async function handleSave(sectionId: string) {
    const section = SECTIONS.find((s) => s.id === sectionId)!;
    const payload: Record<string, string> = {};
    for (const f of section.fields) {
      const v = config[f.key];
      if (v !== undefined) payload[f.key] = v;
    }

    setSaving(sectionId);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const fresh = await fetch('/api/admin/platform-config');
      if (fresh.ok) {
        const freshData = await fresh.json();
        setConfig((prev) => ({ ...prev, ...freshData.config }));
      }

      toast({ title: `${section.label} salvo!` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeSection = SECTIONS.find((s) => s.id === activeTab)!;
  const Icon = activeSection.icon;
  const isSaving = saving === activeSection.id;
  const allConfigured = activeSection.fields.every((f) => isConfigured(config[f.key]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Credenciais de infraestrutura. Alterações afetam todas as empresas imediatamente.
        </p>
      </div>

      {readError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Erro ao carregar configurações</p>
            <p className="text-xs mt-0.5 font-mono">{readError}</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Verifique se <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> e <code className="font-mono">ENCRYPTION_KEY</code> estão configuradas no EasyPanel.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Sidebar de navegação ── */}
        <aside className="w-48 shrink-0 space-y-1">
          {SECTIONS.map((section) => {
            const SIcon = section.icon;
            const configured = section.fields.every((f) => isConfigured(config[f.key]));
            const isActive = activeTab === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <SIcon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1">{section.label}</span>
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', configured ? 'bg-emerald-500' : 'bg-yellow-500')} />
              </button>
            );
          })}

          <div className="pt-4 px-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Valores sensíveis são criptografados com AES-256-GCM.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Conteúdo da seção ativa ── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-muted/20 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{activeSection.label}</p>
                  <p className="text-xs text-muted-foreground">{activeSection.description}</p>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
                allConfigured
                  ? 'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400'
                  : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400'
              )}>
                {allConfigured
                  ? <><CheckCircle2 className="w-3 h-3" /> Configurado</>
                  : <><XCircle className="w-3 h-3" /> Pendente</>}
              </div>
            </div>

            {/* Fields */}
            <div className="p-5 space-y-4">
              {activeSection.fields.map((field) => {
                const val = config[field.key] ?? '';
                const show = visible[field.key];
                const isMasked = val === MASK;

                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{field.label}</Label>
                    <div className="flex gap-2">
                      <Input
                        type={field.sensitive && !show ? 'password' : 'text'}
                        value={isMasked && !show ? MASK : val}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="flex-1 font-mono text-sm"
                        onFocus={() => { if (isMasked) handleChange(field.key, ''); }}
                      />
                      {field.sensitive && (
                        <Button type="button" variant="outline" size="icon" onClick={() => toggle(field.key)} className="shrink-0">
                          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Asaas webhook URL */}
              {activeSection.id === 'asaas' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Webhook URL: configure no painel Asaas → Integrações → Webhooks
                  </Label>
                  <div className="flex gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {appUrl}/api/webhooks/asaas/billing
                    </code>
                    <button onClick={() => copyText(`${appUrl}/api/webhooks/asaas/billing`, 'asaas_webhook')} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {copied === 'asaas_webhook' ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Google redirect URI */}
              {activeSection.id === 'google' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    URI de Redirecionamento Autorizada
                  </Label>
                  <div className="flex gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {appUrl}/api/google/callback
                    </code>
                    <button onClick={() => copyText(`${appUrl}/api/google/callback`, 'google_redirect')} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {copied === 'google_redirect' ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adicione esta URL nas origens de JavaScript e URIs de redirecionamento no Google Cloud Console.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button onClick={() => handleSave(activeSection.id)} disabled={!!saving} size="sm" className="min-w-[120px]">
                  {isSaving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Salvando…</>
                    : <><Save className="w-3.5 h-3.5 mr-1.5" />Salvar</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
