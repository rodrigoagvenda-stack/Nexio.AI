'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, Copy, MapPin, AlertTriangle, Megaphone, User, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ChatNotesTab } from './ChatNotesTab';
import { TagsManager } from './TagsManager';
import { AgendaTab } from './AgendaTab';
import { MidiaTab } from './MidiaTab';
import type { Lead } from '@/types/database.types';
import { computeWindowState, formatWindowBadge } from '@/lib/sdr/window';

type LeadSource = {
  type?: string;
  ctwa_clid?: string;
  source_id?: string;
  headline?: string;
  source_url?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  captured_at?: string;
}

interface LeadInfoSidebarProps {
  lead: Lead;
  phone: string;
  companyId: number;
  userId: string;
  chatId?: number;
  tags?: string[];
  className?: string;
  leadSource?: LeadSource | null;
  ultimaMensagemInboundAt?: string | null;
  ctwaClid?: string | null;
  ctwaFirstReplyAt?: string | null;
  waProvider?: 'uazapi' | 'meta';
  onLeadUpdate?: (updatedLead: Lead) => void;
  onTagsUpdate?: (tags: string[]) => void;
  /** abre o modal de cobrança da conversa */
  onCharge?: () => void;
}

const STAGES = ['Triagem', 'Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido', 'Remarketing'];
const SEGMENTS = ['E-commerce', 'Saúde/Medicina', 'Educação', 'Alimentação', 'Beleza/Estética', 'Imobiliária', 'Advocacia', 'Consultoria', 'Tecnologia', 'Moda/Fashion', 'Arquitetura', 'Auto Escola', 'Restaurante', 'Academia', 'Farmácia', 'Padaria', 'Supermercado', 'Floricultural', 'Hotel/Pousada', 'Oficina Mecânica', 'Pet Shop', 'Outros'];
const SOURCES = ['PEG', 'Linkedin', 'Interno', 'Meta Ads', 'Google Ads', 'Site/Landing Page', 'Indicação', 'WhatsApp', 'TikTok Ads', 'E-mail Marketing', 'Evento/Feira'];
const SEQ_TAG_NAMES = ['Follow up', 'No-show', 'Promoção'] as const;
type SeqTagName = typeof SEQ_TAG_NAMES[number];
const TABS = [['resumo', 'Resumo'], ['notas', 'Notas'], ['agenda', 'Agenda'], ['midia', 'Mídia']] as const;

const valueSelect = 'h-auto w-auto gap-1.5 border-0 bg-transparent p-0 text-[14.5px] shadow-none focus:ring-0 [&>span]:line-clamp-1';
const heading = 'text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground';

export function LeadInfoSidebar({
  lead, phone, companyId, userId, chatId, tags = [], className, leadSource, ultimaMensagemInboundAt, ctwaClid, ctwaFirstReplyAt,
  waProvider = 'uazapi', onLeadUpdate, onTagsUpdate, onCharge,
}: LeadInfoSidebarProps) {
  const [updating, setUpdating] = useState(false);
  const [copiedResumo, setCopiedResumo] = useState(false);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number][0]>('resumo');
  const [sequenceTagIds, setSequenceTagIds] = useState<Record<SeqTagName, number | null>>({ 'Follow up': null, 'No-show': null, 'Promoção': null });
  const [updatingSeqTag, setUpdatingSeqTag] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tags?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        const byName = (name: string) => data.data.find((t: { id: number; tag_name: string }) => t.tag_name === name)?.id ?? null;
        setSequenceTagIds({ 'Follow up': byName('Follow up'), 'No-show': byName('No-show'), 'Promoção': byName('Promoção') });
      })
      .catch(() => {});
  }, [companyId]);

  async function handleToggleSequenceTag(tagName: SeqTagName) {
    const tagId = sequenceTagIds[tagName];
    if (!tagId) {
      toast({ title: 'Etiqueta de sistema não encontrada', description: 'Recarregue a página e tente de novo.', variant: 'destructive' });
      return;
    }
    const isActive = tags.includes(tagName);
    setUpdatingSeqTag(tagName);
    try {
      const res = await fetch(isActive ? '/api/tags/unassign' : '/api/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, tagId, companyId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      // O servidor já desmarca as outras sequências (exclusão mútua): reflete isso aqui também
      const outras = SEQ_TAG_NAMES.filter((t) => t !== tagName);
      const updatedTags = isActive ? tags.filter((t) => t !== tagName) : [...tags.filter((t) => !outras.includes(t as SeqTagName)), tagName];
      onTagsUpdate?.(updatedTags);
      toast({ title: isActive ? `Saiu de "${tagName}"` : `Entrou em "${tagName}"` });
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setUpdatingSeqTag(null);
    }
  }

  async function handleFieldUpdate(field: string, value: any) {
    setUpdating(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, field, value }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      toast({ variant: 'success', title: 'Lead atualizado' });
      if (onLeadUpdate && data.data) onLeadUpdate(data.data);
    } catch (error: any) {
      console.error(`Error updating ${field}:`, error);
      toast({ title: error.message || 'Não foi possível atualizar', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  }

  async function saveValue() {
    if (editingValue == null) return;
    // Aceita "1900", "1.900", "1900,50" e "1.900,50"
    const value = parseFloat(editingValue.replace(/\./g, '').replace(',', '.'));
    await handleFieldUpdate('project_value', isNaN(value) ? null : value);
    setEditingValue(null);
  }

  const isInline = !!className; // com className é a versão de celular (sem cabeçalho próprio)
  const resumo = (lead.resumo_ia || lead.notes || '').trim();
  const resumoLines = resumo.split('\n').map((l) => l.replace(/^[\s\-•*]+/, '').trim()).filter(Boolean);
  const meeting = lead.call_de_venda && lead.call_agendada_para && lead.call_status !== 'cancelada'
    ? new Date(lead.call_agendada_para).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
    : null;
  const temperature = lead.nivel_interesse ?? undefined;

  const Row = ({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) => (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-2.5', !first && 'border-t border-border')}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[14.5px] text-foreground">{children}</span>
    </div>
  );

  return (
    <Card className={cn('flex flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-none', className ?? 'hidden md:flex md:col-span-4 lg:col-span-3')}>
      {lead ? (
        <>
          {!isInline && (
            <div className="flex flex-shrink-0 items-center justify-between px-[18px] pt-[18px]">
              <h2 className="text-xl font-semibold leading-6 text-foreground">Lead</h2>
              <span className="truncate pl-3 text-sm text-muted-foreground">{lead.contact_name || lead.company_name}</span>
            </div>
          )}
          <div className="flex-shrink-0 px-[18px] pb-3 pt-3.5">
            <div role="tablist" aria-label="Informações do lead" className="flex w-full items-center rounded-full bg-muted p-1">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                  className={cn('flex-1 rounded-full px-3 py-1.5 text-[13px] transition-colors', activeTab === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-[18px] pb-4 scrollbar-minimal">
            {activeTab === 'resumo' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col rounded-xl border border-border bg-muted">
                  <Row label="Etapa" first>
                    <Select value={lead.status} onValueChange={(v) => handleFieldUpdate('status', v)} disabled={updating}>
                      <SelectTrigger className={valueSelect} aria-label="Etapa"><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row label="Temperatura">
                    <Select value={temperature} onValueChange={(v) => handleFieldUpdate('nivel_interesse', v)} disabled={updating}>
                      <SelectTrigger className={valueSelect} aria-label="Temperatura"><SelectValue placeholder="Definir" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quente 🔥">Quente 🔥</SelectItem>
                        <SelectItem value="Morno 🌡️">Morno 🌡️</SelectItem>
                        <SelectItem value="Frio ❄️">Frio ❄️</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="Prioridade">
                    <Select value={lead.priority} onValueChange={(v) => handleFieldUpdate('priority', v)} disabled={updating}>
                      <SelectTrigger className={valueSelect} aria-label="Prioridade"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Alta">Alta</SelectItem><SelectItem value="Média">Média</SelectItem><SelectItem value="Baixa">Baixa</SelectItem></SelectContent>
                    </Select>
                  </Row>
                  <Row label="Valor">
                    {editingValue != null ? (
                      <span className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          inputMode="decimal"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveValue(); if (e.key === 'Escape') setEditingValue(null); }}
                          placeholder="0,00"
                          aria-label="Valor do projeto"
                          className="h-8 w-28 text-right text-sm"
                          disabled={updating}
                        />
                        <Button size="icon" className="h-8 w-8" onClick={() => void saveValue()} disabled={updating} aria-label="Salvar valor">{updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setEditingValue(lead.project_value ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(lead.project_value) : '')} className={cn('hover:underline', !lead.project_value && 'text-muted-foreground')}>
                        {lead.project_value ? `R$ ${Number(lead.project_value).toLocaleString('pt-BR')}` : 'Sem valor'}
                      </button>
                    )}
                  </Row>
                  <Row label="Segmento">
                    <Select value={lead.segment || undefined} onValueChange={(v) => handleFieldUpdate('segment', v)} disabled={updating}>
                      <SelectTrigger className={valueSelect} aria-label="Segmento"><SelectValue placeholder="Definir" /></SelectTrigger>
                      <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row label="Origem">
                    <Select value={lead.import_source || undefined} onValueChange={(v) => handleFieldUpdate('import_source', v)} disabled={updating}>
                      <SelectTrigger className={valueSelect} aria-label="Origem"><SelectValue placeholder="Sem origem" /></SelectTrigger>
                      <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Row>
                  <Row label="Reunião"><span className={cn(!meeting && 'text-muted-foreground')}>{meeting ?? 'Nenhuma marcada'}</span></Row>
                  <Row label="Contato"><span className="tabular-nums">{phone}</span></Row>
                  {lead.email && <Row label="E-mail"><span className="block max-w-[170px] truncate">{lead.email}</span></Row>}
                </div>

                {resumoLines.length > 0 && (
                  <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={heading}>Resumo da IA</h3>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(resumo).then(() => { setCopiedResumo(true); setTimeout(() => setCopiedResumo(false), 2000); }).catch(() => {}); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {copiedResumo ? <><Check className="h-3 w-3" />Copiado</> : <><Copy className="h-3 w-3" />Copiar</>}
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {resumoLines.map((l, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm leading-normal text-foreground">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{l}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Gerado automaticamente</p>
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className={heading}>Sequência de reengajamento</h3>
                  <div className="flex gap-2">
                    {SEQ_TAG_NAMES.map((tagName) => {
                      const on = tags.includes(tagName);
                      return (
                        <button
                          key={tagName}
                          type="button"
                          aria-pressed={on}
                          disabled={updatingSeqTag === tagName}
                          onClick={() => void handleToggleSequenceTag(tagName)}
                          className={cn('h-9 flex-1 rounded-full border text-[13px] font-medium transition-colors disabled:opacity-60', on ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground')}
                        >
                          {tagName}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className={heading}>Etiquetas</h3>
                  <TagsManager leadId={lead.id} companyId={companyId} currentTags={tags} onTagsUpdate={onTagsUpdate} />
                </section>

                {leadSource && (
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className={heading}>Anúncio de origem</h3>
                      {ctwaClid && <span className="ml-auto rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">CTWA</span>}
                    </div>
                    <div className="space-y-2 rounded-xl border border-border bg-muted p-3 text-xs">
                      {leadSource.headline && <div><p className="mb-0.5 text-[11px] text-muted-foreground">Anúncio</p><p className="font-medium leading-snug">{leadSource.headline}</p></div>}
                      {(leadSource.utm_campaign || leadSource.utm_source) && (
                        <div className="grid grid-cols-2 gap-2">
                          {leadSource.utm_campaign && <div><p className="mb-0.5 text-[11px] text-muted-foreground">Campanha</p><p className="truncate font-medium">{leadSource.utm_campaign}</p></div>}
                          {leadSource.utm_source && <div><p className="mb-0.5 text-[11px] text-muted-foreground">Fonte</p><p className="truncate font-medium">{leadSource.utm_source}</p></div>}
                        </div>
                      )}
                      {leadSource.utm_medium && <div><p className="mb-0.5 text-[11px] text-muted-foreground">Mídia</p><p className="font-medium">{leadSource.utm_medium}</p></div>}
                      {leadSource.source_url && (
                        <div><p className="mb-0.5 text-[11px] text-muted-foreground">Endereço do anúncio</p>
                          <a href={leadSource.source_url} target="_blank" rel="noopener noreferrer" className="block max-w-full truncate text-primary hover:underline">{leadSource.source_url.replace(/^https?:\/\//, '')}</a>
                        </div>
                      )}
                      {waProvider === 'meta' && ultimaMensagemInboundAt && (() => {
                        const state = computeWindowState({ ultimaMensagemInboundAt: ultimaMensagemInboundAt ?? null, ctwaClid: ctwaClid ?? null, ctwaFirstReplyAt: ctwaFirstReplyAt ?? null });
                        const label = formatWindowBadge(state);
                        if (!state.serviceWindow.open) return <p className="text-muted-foreground">{label}</p>;
                        const color = state.ctwaWindow?.active ? 'text-purple-600 dark:text-purple-300' : state.billing === 'charged_24h' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
                        return <div><p className="mb-0.5 text-[11px] text-muted-foreground">Janela de mensagem</p><p className={cn('font-medium', color)}>{label}</p></div>;
                      })()}
                    </div>
                  </section>
                )}

                {lead.places_analysis?.gaps?.length ? (
                  <section className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className={heading}>Perfil no Google</h3>
                      {lead.places_analysis.score && (
                        <span className={cn('ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold', lead.places_analysis.score.total < 50 ? 'bg-red-500/15 text-red-700 dark:text-red-300' : lead.places_analysis.score.total < 75 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
                          {lead.places_analysis.score.total}/100 · {lead.places_analysis.score.grade}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 rounded-xl border border-border bg-muted p-3 text-xs">
                      {lead.places_analysis.gaps.map((gap) => (
                        <div key={gap.key} className="flex items-start gap-1.5">
                          <AlertTriangle className={cn('mt-0.5 h-3 w-3 shrink-0', gap.severidade === 'critico' ? 'text-red-500' : 'text-amber-500')} />
                          <div><p className="font-medium leading-snug">{gap.titulo}</p><p className="text-[11px] leading-snug text-muted-foreground">{gap.texto}</p></div>
                        </div>
                      ))}
                      {lead.places_analysis.fetchedAt && <p className="border-t border-border pt-1 text-[11px] text-muted-foreground">Analisado em {new Date(lead.places_analysis.fetchedAt).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            {activeTab === 'notas' && (
              <ChatNotesTab leadId={lead.id} companyId={companyId} userId={userId} aiSummary={lead.mql_resumo} resumoIa={lead.resumo_ia} isOutbound={lead.status === 'Outbound'} />
            )}

            {activeTab === 'agenda' && (
              chatId ? <AgendaTab chatId={chatId} leadId={lead.id} companyId={companyId} /> : <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma conversa selecionada</p>
            )}

            {activeTab === 'midia' && (
              chatId ? <MidiaTab chatId={chatId} companyId={companyId} /> : <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma conversa selecionada</p>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2.5 border-t border-border px-[18px] py-3.5">
            <Button className="h-11 gap-2 text-[15px]" onClick={() => setActiveTab('agenda')}>Marcar reunião</Button>
            <div className="flex gap-2.5">
              <Button variant="secondary" className="h-11 flex-1 text-sm" onClick={onCharge} disabled={!onCharge}>Gerar cobrança</Button>
              <Button variant="secondary" className="h-11 flex-1 text-sm" asChild><Link href="/crm?view=table">Abrir no CRM</Link></Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecione uma conversa para ver as informações do lead</p>
          </div>
        </div>
      )}
    </Card>
  );
}
