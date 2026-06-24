'use client'

import { useState } from 'react'
import { X, CreditCard, QrCode, FileText, Loader2, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lead {
  id: number
  company_name: string
  contact_name?: string | null
  whatsapp?: string | null
  email?: string | null
}

interface ChargeResult {
  payment: {
    id: string
    status: string
    invoiceUrl?: string
    bankSlipUrl?: string
    pixPayload?: { encodedImage: string; payload: string; expirationDate: string } | null
  }
}

interface ChargeLeadModalProps {
  lead: Lead
  onClose: () => void
}

type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD'

const BILLING_OPTIONS: { type: BillingType; label: string; icon: React.ReactNode }[] = [
  { type: 'PIX', label: 'PIX', icon: <QrCode className="w-4 h-4" /> },
  { type: 'BOLETO', label: 'Boleto', icon: <FileText className="w-4 h-4" /> },
  { type: 'CREDIT_CARD', label: 'Cartão', icon: <CreditCard className="w-4 h-4" /> },
]

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function ChargeLeadModal({ lead, onClose }: ChargeLeadModalProps) {
  const [billingType, setBillingType] = useState<BillingType>('PIX')
  const [value, setValue] = useState('')
  const [dueDate, setDueDate] = useState(getTomorrow())
  const [description, setDescription] = useState('')
  const [sendWhatsapp, setSendWhatsapp] = useState(!!lead.whatsapp)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ChargeResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit() {
    if (!value || Number(value) <= 0) { setError('Informe um valor válido'); return }
    if (!dueDate) { setError('Informe a data de vencimento'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/asaas/company/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          value: Number(value),
          dueDate,
          billingType,
          description: description || undefined,
          sendWhatsapp,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar cobrança')
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  function copyPix() {
    const code = result?.payment.pixPayload?.payload
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[420px] mx-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="text-sm font-semibold">Gerar cobrança</p>
              <p className="text-xs text-muted-foreground">{lead.contact_name || lead.company_name}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {result ? (
            /* Success state */
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-sm font-semibold">Cobrança gerada!</p>
                {sendWhatsapp && lead.whatsapp && (
                  <p className="text-xs text-muted-foreground text-center">Link enviado via WhatsApp para {lead.whatsapp}</p>
                )}
              </div>

              {result.payment.pixPayload?.payload && (
                <div className="flex flex-col gap-2">
                  {result.payment.pixPayload.encodedImage && (
                    <img
                      src={`data:image/png;base64,${result.payment.pixPayload.encodedImage}`}
                      alt="QR Code PIX"
                      className="w-40 h-40 mx-auto rounded-xl border border-border"
                    />
                  )}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted border border-border">
                    <p className="text-xs font-mono text-muted-foreground truncate flex-1">{result.payment.pixPayload.payload.slice(0, 40)}…</p>
                    <button onClick={copyPix} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium flex-shrink-0">
                      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {(result.payment.invoiceUrl || result.payment.bankSlipUrl) && (
                <a
                  href={result.payment.invoiceUrl || result.payment.bankSlipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {billingType === 'BOLETO' ? 'Abrir boleto' : 'Abrir link de pagamento'}
                </a>
              )}

              <button onClick={onClose}
                className="w-full px-4 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={{ backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}>
                Fechar
              </button>
            </div>
          ) : (
            /* Form state */
            <div className="p-5 flex flex-col gap-4">
              {/* Billing type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo de cobrança</label>
                <div className="grid grid-cols-3 gap-2">
                  {BILLING_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => setBillingType(opt.type)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border transition-all',
                        billingType === opt.type
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Consultoria — Outubro 2026"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Send via WhatsApp */}
              {lead.whatsapp && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div
                    onClick={() => setSendWhatsapp((v) => !v)}
                    className={cn(
                      'w-9 h-5 rounded-full border transition-all flex-shrink-0',
                      sendWhatsapp ? 'bg-primary border-primary' : 'bg-muted border-border'
                    )}>
                    <span className={cn(
                      'block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mt-[3px]',
                      sendWhatsapp ? 'translate-x-4' : 'translate-x-0.5'
                    )} />
                  </div>
                  <span className="text-sm text-muted-foreground">Enviar link via WhatsApp</span>
                </label>
              )}

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border">
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {loading ? 'Gerando…' : 'Gerar cobrança'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
