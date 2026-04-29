'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import {
  Smartphone, KeyRound, Save, Loader2, Eye, EyeOff,
  CreditCard, Calendar, CheckCircle2, XCircle, Copy, CheckCheck,
} from 'lucide-react';

interface Props {
  initialConfig: Record<string, string>;
}

const MASK = '••••••••••••••••';

const SECTIONS = [
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
    id: 'stripe',
    label: 'Stripe',
    icon: CreditCard,
    description: 'Chaves da API Stripe para processar pagamentos e gerenciar assinaturas.',
    fields: [
      { key: 'stripe_secret_key', label: 'Secret Key', placeholder: 'sk_live_...', sensitive: true },
      { key: 'stripe_webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...', sensitive: true },
      { key: 'stripe_price_starter', label: 'Price ID — Starter', placeholder: 'price_...', sensitive: false },
      { key: 'stripe_price_pro', label: 'Price ID — Pro', placeholder: 'price_...', sensitive: false },
      { key: 'stripe_price_scale', label: 'Price ID — Scale', placeholder: 'price_...', sensitive: false },
    ],
  },
];

function isConfigured(val: string | undefined) {
  return !!val && val !== MASK && val.trim() !== '';
}

export function PlatformConfigContent({ initialConfig }: Props) {
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      toast({ title: `${section.label} salvo!` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  function copyRedirectUri() {
    navigator.clipboard.writeText(`${appUrl}/api/google/callback`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Credenciais de infraestrutura. Alterações afetam todas as empresas imediatamente.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isSaving = saving === section.id;
        const allConfigured = section.fields.every((f) => isConfigured(config[f.key]));

        return (
          <div key={section.id} className="rounded-xl border border-border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-4 bg-muted/20 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
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
              {section.fields.map((field) => {
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
                        onFocus={() => {
                          if (isMasked) handleChange(field.key, '');
                        }}
                      />
                      {field.sensitive && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => toggle(field.key)}
                          className="shrink-0"
                        >
                          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Google redirect URI info */}
              {section.id === 'google' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    URI de Redirecionamento Autorizada
                  </Label>
                  <div className="flex gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {appUrl}/api/google/callback
                    </code>
                    <button onClick={copyRedirectUri} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adicione esta URL nas origens de JavaScript e URIs de redirecionamento no Google Cloud Console.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  onClick={() => handleSave(section.id)}
                  disabled={!!saving}
                  size="sm"
                  className="min-w-[120px]"
                >
                  {isSaving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Salvando…</>
                    : <><Save className="w-3.5 h-3.5 mr-1.5" />Salvar</>}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Security note */}
      <div className="flex items-start gap-2 p-4 rounded-xl bg-muted/30 border border-border">
        <KeyRound className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Valores sensíveis são criptografados com AES-256-GCM antes de serem armazenados.
          A descriptografia requer a <code className="font-mono">ENCRYPTION_KEY</code> configurada no servidor.
        </p>
      </div>
    </div>
  );
}
