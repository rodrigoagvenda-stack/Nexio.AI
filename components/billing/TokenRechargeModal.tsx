'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Zap, Copy, Check, QrCode, X } from 'lucide-react';

const PACKS = [
  { tokens: 100_000,   price: 15,  label: '100K', highlight: false },
  { tokens: 500_000,   price: 60,  label: '500K', highlight: true  },
  { tokens: 1_000_000, price: 100, label: '1M',   highlight: false },
  { tokens: 2_000_000, price: 180, label: '2M',   highlight: false },
];

interface PixData {
  qrcodeImage: string;
  copyPaste: string;
  expiresAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tokensUsed?: number;
  tokensLimit?: number;
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tkFmt = (n: number) =>
  n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`;

export function TokenRechargeModal({
  open,
  onClose,
  tokensUsed = 0,
  tokensLimit = 0,
}: Props) {
  const [selected, setSelected] = useState<(typeof PACKS)[0] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [pix, setPix]           = useState<PixData | null>(null);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');

  const pct = tokensLimit > 0
    ? Math.min((tokensUsed / tokensLimit) * 100, 100)
    : 0;

  async function handleBuy() {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/extra-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: selected.tokens, amount: selected.price }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Erro ao gerar cobrança');
      setPix(json.pix);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!pix) return;
    navigator.clipboard.writeText(pix.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleClose() {
    setSelected(null);
    setPix(null);
    setError('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#369E47]" />
            Recarregar tokens
          </DialogTitle>
          <DialogDescription>
            Adicione tokens ao seu plano via PIX. Liberados em até 1 minuto após o pagamento.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de uso */}
        {tokensLimit > 0 && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Uso atual</span>
              <span className={`font-semibold ${
                pct >= 100 ? 'text-red-500' : pct >= 80 ? 'text-amber-500' : 'text-gray-800'
              }`}>
                {tokensUsed.toLocaleString('pt-BR')} / {tokensLimit.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#369E47]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {pct >= 100 && (
              <p className="text-xs text-red-500 font-medium">
                ⚠ Limite atingido: Nexio pausado
              </p>
            )}
          </div>
        )}

        {!pix ? (
          <>
            {/* Seleção de pacote */}
            <div className="grid grid-cols-2 gap-3">
              {PACKS.map(pack => (
                <button
                  key={pack.tokens}
                  type="button"
                  onClick={() => setSelected(pack)}
                  className={`relative text-left border-2 rounded-xl p-4 transition-all ${
                    selected?.tokens === pack.tokens
                      ? 'border-[#369E47] bg-[#369E47]/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {pack.highlight && (
                    <span className="absolute -top-2.5 left-3 text-[10px] font-bold bg-[#369E47] text-white px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected?.tokens === pack.tokens
                        ? 'bg-[#369E47] border-[#369E47]'
                        : 'border-gray-300'
                    }`}>
                      {selected?.tokens === pack.tokens && (
                        <Check className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                    <span className="font-bold text-gray-900 text-sm">
                      {pack.label} tokens
                    </span>
                  </div>
                  <p className="text-xl font-black text-gray-900">{brl(pack.price)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {brl((pack.price / pack.tokens) * 1000)}/1K tokens
                  </p>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <X className="h-4 w-4 flex-shrink-0" /> {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBuy}
                disabled={!selected || loading}
                className="flex-1 bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando PIX...</>
                  : <><QrCode className="h-4 w-4" />Gerar PIX</>}
              </button>
            </div>
          </>
        ) : (
          /* QR Code screen */
          <div className="space-y-4">
            <div className="bg-[#369E47]/5 border border-[#369E47]/20 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Pague <strong>{brl(selected!.price)}</strong> e ganhe{' '}
                <strong>{tkFmt(selected!.tokens)} tokens</strong>
              </p>
              <div className="flex justify-center mb-3">
                <img
                  src={`data:image/png;base64,${pix.qrcodeImage}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-lg border border-gray-200 bg-white"
                />
              </div>
              <p className="text-xs text-gray-400">Escaneie com o app do seu banco</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                Ou copie o código PIX:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 truncate">
                  {pix.copyPaste}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5 text-[#369E47]" />Copiado!</>
                    : <><Copy className="h-3.5 w-3.5" />Copiar</>}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 leading-relaxed">
                ✅ Os tokens são liberados automaticamente em até 1 minuto após a confirmação do pagamento pelo banco.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Fechar: vou pagar pelo app do banco
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
