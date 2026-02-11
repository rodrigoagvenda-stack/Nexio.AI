'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Phone, Mail, Tag, User, DollarSign, FileText, StickyNote, Calendar, Image, ChevronDown, ChevronUp, Copy, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChatNotesTab } from './ChatNotesTab';
import { TagsManager } from './TagsManager';
import { AgendaTab } from './AgendaTab';
import { MidiaTab } from './MidiaTab';
import type { Lead } from '@/types/database.types';

interface LeadInfoSidebarProps {
  lead: Lead;
  phone: string;
  companyId: number;
  userId: string;
  chatId?: number;
  tags?: string[];
  onLeadUpdate?: (updatedLead: Lead) => void;
  onTagsUpdate?: (tags: string[]) => void;
}

export function LeadInfoSidebar({
  lead,
  phone,
  companyId,
  userId,
  chatId,
  tags = [],
  onLeadUpdate,
  onTagsUpdate,
}: LeadInfoSidebarProps) {
  const [updating, setUpdating] = useState(false);
  const [isResumoExpanded, setIsResumoExpanded] = useState(true);
  const [copiedResumo, setCopiedResumo] = useState(false);
  const [editingProjectValue, setEditingProjectValue] = useState<string>('');
  const [hasProjectValueChanged, setHasProjectValueChanged] = useState(false);

  async function handleFieldUpdate(field: string, value: any) {
    setUpdating(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          field,
          value,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      toast.success(`${field} atualizado!`);

      // Notificar componente pai
      if (onLeadUpdate && data.data) {
        onLeadUpdate(data.data);
      }
    } catch (error: any) {
      console.error(`Error updating ${field}:`, error);
      toast.error(error.message || `Erro ao atualizar ${field}`);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card className="hidden lg:flex lg:col-span-3 flex-col overflow-hidden">
      {lead ? (
        <>
          <CardHeader className="border-b flex-shrink-0">
            <CardTitle className="text-base">Informações do Lead</CardTitle>
          </CardHeader>
          <Tabs defaultValue="dados" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full justify-start px-4 pt-2">
              <TabsTrigger value="dados" className="text-xs">Dados</TabsTrigger>
              <TabsTrigger value="notas" className="text-xs">
                <StickyNote className="h-3 w-3 mr-1" />
                Notas
              </TabsTrigger>
              <TabsTrigger value="tags" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                Tags
              </TabsTrigger>
              <TabsTrigger value="agenda" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="midia" className="text-xs">
                <Image className="h-3 w-3 mr-1" />
                Mídia
              </TabsTrigger>
            </TabsList>

            {/* Aba: Dados */}
            <TabsContent value="dados" className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-minimal mt-0">
            {/* Dados Básicos */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Empresa
              </h4>
              <p className="text-sm font-medium">{lead.company_name}</p>
              {lead.contact_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  Contato: {lead.contact_name}
                </p>
              )}
            </div>

            <Separator />

            {/* Telefone */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Telefone:</span>
              </div>
              <p className="text-sm font-medium pl-6">{phone}</p>
            </div>

            {/* Email */}
            {lead.email && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                </div>
                <p className="text-sm font-medium pl-6">{lead.email}</p>
              </div>
            )}

            <Separator />

            {/* Status (Nível de Interesse) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Status</Label>
              <Select
                value={lead.nivel_interesse}
                onValueChange={(value) => handleFieldUpdate('nivel_interesse', value)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quente 🔥">Quente 🔥</SelectItem>
                  <SelectItem value="Morno 🌡️">Morno 🌡️</SelectItem>
                  <SelectItem value="Frio ❄️">Frio ❄️</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estágio */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Estágio</Label>
              <Select
                value={lead.status}
                onValueChange={(value) => handleFieldUpdate('status', value)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead novo">Lead novo</SelectItem>
                  <SelectItem value="Em contato">Em contato</SelectItem>
                  <SelectItem value="Interessado">Interessado</SelectItem>
                  <SelectItem value="Proposta enviada">Proposta enviada</SelectItem>
                  <SelectItem value="Fechado">Fechado</SelectItem>
                  <SelectItem value="Perdido">Perdido</SelectItem>
                  <SelectItem value="Remarketing">Remarketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Prioridade</Label>
              <Select
                value={lead.priority}
                onValueChange={(value) => handleFieldUpdate('priority', value)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Segmento */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Segmento</Label>
              <Select
                value={lead.segment || undefined}
                onValueChange={(value) => handleFieldUpdate('segment', value)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="E-commerce">E-commerce</SelectItem>
                  <SelectItem value="Saúde/Medicina">Saúde/Medicina</SelectItem>
                  <SelectItem value="Educação">Educação</SelectItem>
                  <SelectItem value="Alimentação">Alimentação</SelectItem>
                  <SelectItem value="Beleza/Estética">Beleza/Estética</SelectItem>
                  <SelectItem value="Imobiliária">Imobiliária</SelectItem>
                  <SelectItem value="Advocacia">Advocacia</SelectItem>
                  <SelectItem value="Consultoria">Consultoria</SelectItem>
                  <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                  <SelectItem value="Moda/Fashion">Moda/Fashion</SelectItem>
                  <SelectItem value="Arquitetura">Arquitetura</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Origem */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Origem</Label>
              <Select
                value={lead.import_source || undefined}
                onValueChange={(value) => handleFieldUpdate('import_source', value)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEG">PEG</SelectItem>
                  <SelectItem value="Linkedin">Linkedin</SelectItem>
                  <SelectItem value="Interno">Interno</SelectItem>
                  <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Site/Landing Page">Site/Landing Page</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="TikTok Ads">TikTok Ads</SelectItem>
                  <SelectItem value="E-mail Marketing">E-mail Marketing</SelectItem>
                  <SelectItem value="Evento/Feira">Evento/Feira</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cargo */}
            {lead.cargo && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Cargo</Label>
                <Select
                  value={lead.cargo}
                  onValueChange={(value) => handleFieldUpdate('cargo', value)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Proprietário/Dono">Proprietário/Dono</SelectItem>
                    <SelectItem value="Gerente Comercial">Gerente Comercial</SelectItem>
                    <SelectItem value="Vendedor">Vendedor</SelectItem>
                    <SelectItem value="Representante Comercial">
                      Representante Comercial
                    </SelectItem>
                    <SelectItem value="Consultor de Vendas">Consultor de Vendas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Valor do Projeto */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Valor do Projeto
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={
                      hasProjectValueChanged
                        ? editingProjectValue
                        : lead.project_value
                        ? new Intl.NumberFormat('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(lead.project_value)
                        : ''
                    }
                    onChange={(e) => {
                      setEditingProjectValue(e.target.value);
                      setHasProjectValueChanged(true);
                    }}
                    className="pl-8"
                    disabled={updating}
                  />
                </div>
                {hasProjectValueChanged && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      const value = editingProjectValue.replace(/\D/g, '');
                      const numValue = value ? parseFloat(value) / 100 : null;
                      await handleFieldUpdate('project_value', numValue);
                      setHasProjectValueChanged(false);
                      setEditingProjectValue('');
                    }}
                    disabled={updating}
                    className="shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Etiquetas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Nota SDR (Read-only) */}
            {lead.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <button
                    onClick={() => setIsResumoExpanded(!isResumoExpanded)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold text-primary">
                        nexio.ai resumo
                      </h4>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        IA
                      </Badge>
                    </div>
                    {isResumoExpanded ? (
                      <ChevronUp className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    )}
                  </button>

                  {isResumoExpanded && (
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20 space-y-3">
                      <div className="relative">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {lead.notes}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                        <p className="text-xs text-muted-foreground italic">
                          Gerado automaticamente
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(lead.notes || '');
                            setCopiedResumo(true);
                            toast.success('Resumo copiado!');
                            setTimeout(() => setCopiedResumo(false), 2000);
                          }}
                        >
                          {copiedResumo ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copiar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            </TabsContent>

            {/* Aba: Notas */}
            <TabsContent value="notas" className="flex-1 overflow-y-auto p-4 mt-0">
              <ChatNotesTab
                leadId={lead.id}
                companyId={companyId}
                userId={userId}
              />
            </TabsContent>

            {/* Aba: Tags */}
            <TabsContent value="tags" className="flex-1 overflow-y-auto p-4 mt-0">
              <TagsManager
                leadId={lead.id}
                companyId={companyId}
                currentTags={tags}
                onTagsUpdate={onTagsUpdate}
              />
            </TabsContent>

            {/* Aba: Agenda */}
            <TabsContent value="agenda" className="flex-1 overflow-y-auto p-4 mt-0">
              {chatId ? (
                <AgendaTab
                  chatId={chatId}
                  leadId={lead.id}
                  companyId={companyId}
                />
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conversa selecionada
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Aba: Mídia */}
            <TabsContent value="midia" className="flex-1 overflow-y-auto p-4 mt-0">
              {chatId ? (
                <MidiaTab
                  chatId={chatId}
                  companyId={companyId}
                />
              ) : (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conversa selecionada
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Selecione uma conversa para ver as informações do lead
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
