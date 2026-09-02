import { AlertTriangle } from 'lucide-react'

export function QuotaPausedBanner() {
  return (
    <div className="flex items-center gap-2 bg-red-600 text-white text-sm px-4 py-2 shrink-0">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        <strong>SDR pausado:</strong> a franquia de mensagens do mês foi excedida e o agente parou de responder para todos os leads.
        Fale com o suporte para reativar ou fazer upgrade de plano.
      </span>
    </div>
  )
}
