'use client'

import { useState, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import { Loader2, Save, Code2, Bot, ChevronDown } from 'lucide-react'

interface Company { id: number; name: string }

const AGENTS = [
  { key: 'agendamento', label: 'Agente de Agendamento' },
  { key: 'pipeline',    label: 'Agente de Pipeline' },
  { key: 'segmentacao', label: 'Agente de Segmentação' },
  { key: 'outbound',    label: 'Agente de Outbound' },
  { key: 'memory',      label: 'Agente de Memória' },
] as const

export default function AdminSdrPromptsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [flowId, setFlowId] = useState<string | null>(null)
  const [orchestratorPrompt, setOrchestratorPrompt] = useState('')
  const [agentPrompts, setAgentPrompts] = useState<Record<string, string>>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/companies')
      .then((r) => r.json())
      .then((d) => { if (d.companies) setCompanies(d.companies) })
  }, [])

  const loadPrompts = useCallback(async (companyId: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/sdr/${companyId}/prompts`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setFlowId(d.flow_id)
      setAgentPrompts(d.agent_prompts ?? {})
      setOrchestratorPrompt(d.orchestrator_prompt ?? '')
      setDefaults(d.default_agent_prompts ?? {})
    } catch (err: any) {
      toast({ title: 'Erro ao carregar prompts', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadPrompts(selectedId)
  }, [selectedId, loadPrompts])

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const r = await fetch(`/api/admin/sdr/${selectedId}/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_prompts: agentPrompts, orchestrator_prompt: orchestratorPrompt }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast({ title: 'Prompts salvos!' })
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prompts dos Agentes SDR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visualize e edite os prompts de cada sub-agente por empresa.</p>
        </div>
        {selectedId && (
          <Button onClick={handleSave} disabled={saving || !flowId}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        )}
      </div>

      {/* Seletor de empresa */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-sm font-medium">Empresa</p>
        </div>
        <div className="relative">
          <select
            className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm bg-background pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Selecione uma empresa...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && selectedId && !flowId && (
        <div className="text-sm text-muted-foreground border border-border rounded-lg p-4">
          Esta empresa não possui um fluxo SDR ativo configurado.
        </div>
      )}

      {!loading && selectedId && flowId && (
        <div className="space-y-6">
          {/* Prompt do Orquestrador */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Orquestrador</p>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Prompt principal</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Prompt base do agente SDR que o cliente configurou.</p>
            <Textarea
              className="font-mono text-xs min-h-[160px] resize-y"
              value={orchestratorPrompt}
              onChange={(e) => setOrchestratorPrompt(e.target.value)}
            />
          </div>

          <hr className="border-border" />

          {/* Sub-agentes */}
          {AGENTS.map(({ key, label }) => {
            const isCustom = !!(agentPrompts[key])
            const effective = agentPrompts[key] ?? defaults[key] ?? ''
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1">
                  <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">{label}</p>
                  {isCustom
                    ? <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Customizado</span>
                    : <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Padrão</span>
                  }
                </div>
                <Textarea
                  className="font-mono text-xs min-h-[200px] resize-y"
                  value={effective}
                  onChange={(e) => setAgentPrompts((p) => ({ ...p, [key]: e.target.value }))}
                />
                {isCustom && (
                  <button
                    className="mt-1 text-xs text-muted-foreground hover:text-destructive underline"
                    onClick={() => setAgentPrompts((p) => { const n = { ...p }; delete n[key]; return n })}
                  >
                    Restaurar padrão
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
