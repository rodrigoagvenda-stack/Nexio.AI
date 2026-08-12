'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Phone, Wifi, WifiOff, Pencil, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaNumber {
  id: string;
  friendly_name: string;
  phone_number: string;
  phone_number_id: string | null;
  waba_id: string | null;
  provider: string;
  status: 'conectado' | 'desconectado' | 'pareando' | 'erro';
  sdr_enabled: boolean;
  created_at: string;
}

const STATUS_CONFIG = {
  conectado:    { label: 'Conectado',    color: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20' },
  desconectado: { label: 'Desconectado', color: 'bg-muted text-muted-foreground ring-border' },
  pareando:     { label: 'Pareando…',   color: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/20' },
  erro:         { label: 'Erro',         color: 'bg-red-500/15 text-red-400 ring-red-500/20' },
};

export function NumerosContent() {
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [form, setForm] = useState({
    friendly_name: '',
    phone_number: '',
    phone_number_id: '',
    waba_id: '',
    token: '',
  });
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetch('/api/whatsapp/numbers')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setNumbers(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.friendly_name.trim() || !form.phone_number.trim()) {
      toast({ title: 'Nome e número são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNumbers(prev => [...prev, d.data]);
      setForm({ friendly_name: '', phone_number: '', phone_number_id: '', waba_id: '', token: '' });
      setAddOpen(false);
      toast({ title: `Número "${d.data.friendly_name}" adicionado!` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao adicionar número', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/whatsapp/numbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendly_name: editName.trim() }),
      });
      if (!res.ok) throw new Error();
      setNumbers(prev => prev.map(n => n.id === id ? { ...n, friendly_name: editName.trim() } : n));
      setEditingId(null);
      toast({ title: 'Nome atualizado' });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    setDisconnecting(id);
    try {
      const res = await fetch(`/api/whatsapp/numbers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setNumbers(prev => prev.map(n => n.id === id ? { ...n, status: 'desconectado' } : n));
      toast({ title: `"${name}" desconectado. Histórico mantido.` });
    } catch {
      toast({ title: 'Erro ao desconectar', variant: 'destructive' });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleToggleSdr = async (id: string, current: boolean) => {
    setToggling(id);
    try {
      await fetch(`/api/whatsapp/numbers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdr_enabled: !current }),
      });
      setNumbers(prev => prev.map(n => n.id === id ? { ...n, sdr_enabled: !current } : n));
    } catch {
      toast({ title: 'Erro ao alterar SDR', variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie os números WhatsApp conectados à sua empresa</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(o => !o)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar número
        </Button>
      </div>

      {/* Formulário de novo número */}
      {addOpen && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold">Novo número WhatsApp</p>
          <div className="grid gap-2">
            <div>
              <Label className="text-xs">Nome amigável</Label>
              <Input
                value={form.friendly_name}
                onChange={e => setForm(f => ({ ...f, friendly_name: e.target.value }))}
                placeholder="Ex: Vendas SP, Suporte, Comercial"
                className="h-9 mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Número WhatsApp (com DDI)</Label>
              <Input
                value={form.phone_number}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                placeholder="5511999999999"
                className="h-9 mt-1 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone Number ID (Meta)</Label>
                <Input
                  value={form.phone_number_id}
                  onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  placeholder="Opcional"
                  className="h-9 mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs">WABA ID</Label>
                <Input
                  value={form.waba_id}
                  onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))}
                  placeholder="Opcional"
                  className="h-9 mt-1 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Token Meta (Bearer)</Label>
              <Input
                type="password"
                value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                placeholder="EAA..."
                className="h-9 mt-1 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar número'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de números */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : numbers.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Nenhum número cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione o número WhatsApp Business da sua empresa</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map(num => {
            const sc = STATUS_CONFIG[num.status] ?? STATUS_CONFIG.desconectado;
            const isEditing = editingId === num.id;
            return (
              <div
                key={num.id}
                className={cn(
                  'p-4 rounded-2xl border bg-card transition-colors',
                  num.status === 'conectado' ? 'border-emerald-500/20' : 'border-border'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Ícone */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    num.status === 'conectado' ? 'bg-emerald-500/10' : 'bg-muted'
                  )}>
                    {num.status === 'conectado'
                      ? <Wifi className="h-5 w-5 text-emerald-400" />
                      : num.status === 'erro'
                      ? <AlertTriangle className="h-5 w-5 text-red-400" />
                      : <WifiOff className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(num.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button onClick={() => handleRename(num.id)} className="text-emerald-400 hover:text-emerald-300">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{num.friendly_name}</p>
                        <button
                          onClick={() => { setEditingId(num.id); setEditName(num.friendly_name); }}
                          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{num.phone_number}</p>
                    {num.phone_number_id && (
                      <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">ID: {num.phone_number_id}</p>
                    )}
                  </div>

                  {/* Direita: status + ações */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full ring-1', sc.color)}>
                      {sc.label}
                    </span>
                  </div>
                </div>

                {/* Footer do card */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={num.sdr_enabled}
                      onCheckedChange={() => handleToggleSdr(num.id, num.sdr_enabled)}
                      disabled={toggling === num.id}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">SDR ativo neste número</span>
                  </div>
                  {num.status === 'conectado' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(num.id, num.friendly_name)}
                      disabled={disconnecting === num.id}
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {disconnecting === num.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Desconectar'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
