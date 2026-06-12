'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrbitCard, OrbitCardContent } from '@/components/ui/orbit-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Search, Flame, Phone, DollarSign, Building2, Download, Filter, Megaphone, UserPlus, MessageCircle, Star, FileText, CheckCircle2, XCircle, Repeat2, LayoutList, LayoutGrid, GitBranch, Clock, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Lead } from '@/types/database.types';
import { SimplePagination } from '@/components/ui/pagination-simple';
import {
  DndContext,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function fmtCompact(v: number): string {
  if (!v || v <= 0) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) {
    const k = v / 1_000;
    return `R$ ${(k >= 100 ? Math.round(k).toString() : k.toFixed(1).replace('.', ','))}k`;
  }
  return `R$ ${Math.round(v)}`;
}

const photoCache: Record<string, string | null> = {}

// 🚀 PERFORMANCE: Componente memoizado para evitar re-renders desnecessários
const SortableLeadCard = memo(function SortableLeadCard({ lead, onEdit, onDelete }: { lead: Lead; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  });

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!lead.whatsapp) return;
    if (lead.whatsapp in photoCache) { setPhotoUrl(photoCache[lead.whatsapp]); return; }
    fetch(`/api/chat/contact-photo?phone=${encodeURIComponent(lead.whatsapp)}&leadId=${lead.id}`)
      .then(r => r.json())
      .then(d => { photoCache[lead.whatsapp!] = d.photo ?? null; setPhotoUrl(d.photo ?? null); })
      .catch(() => {});
  }, [lead.whatsapp]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'Alta': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Média': 'bg-primary/10 text-primary',
      'Baixa': 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    };
    return colors[priority as keyof typeof colors] || colors['Baixa'];
  };

  const getInterestColor = (interest: string) => {
    if (interest?.includes('Quente')) return 'bg-primary/10 text-primary';
    if (interest?.includes('Morno')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OrbitCard className="group hover:shadow-md transition-all duration-200 mb-3 bg-card">
        <OrbitCardContent className="p-4 space-y-3 flex flex-col">
          {/* Header com ícone e ações */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: 'rgba(1,87,60,0.18)', flexShrink: 0 }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={lead.contact_name || lead.company_name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <span className="text-xs font-bold" style={{ color: '#34B270' }}>{getInitials(lead.contact_name || lead.company_name)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                {lead.company_name}
              </h4>
              {lead.contact_name && (
                <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
              )}
            </div>
            <div className="flex gap-0.5 flex-shrink-0" style={{ pointerEvents: 'auto' }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-accent rounded-md transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEdit();
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-destructive rounded-md transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {lead.priority && (
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium h-fit ${getPriorityColor(lead.priority)}`}>
                {lead.priority}
              </span>
            )}
            {lead.nivel_interesse && (
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-0.5 h-fit ${getInterestColor(lead.nivel_interesse)}`}>
                {lead.nivel_interesse.includes('Quente') && <Flame className="h-2.5 w-2.5" />}
                {lead.nivel_interesse}
              </span>
            )}
            {lead.segment && (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400 h-fit">
                {lead.segment}
              </span>
            )}
            {(lead.lead_tags as any[])?.map((lt: any) => {
              const tag = lt.tags;
              if (!tag) return null;
              return (
                <span
                  key={lt.tag_id}
                  className="text-[10px] px-2 py-0.5 rounded-md font-medium h-fit"
                  style={{ backgroundColor: `${tag.tag_color}22`, color: tag.tag_color }}
                >
                  {tag.tag_name}
                </span>
              );
            })}
          </div>

          {/* Footer com métricas */}
          <div className="flex items-center justify-between text-muted-foreground pt-2 border-t border-border/50 mt-2">
            <div className="flex items-center gap-1 text-xs font-medium text-foreground/80">
              <DollarSign className="h-3 w-3 text-primary/60" />
              <span>{fmtCompact(lead.project_value || 0)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </OrbitCardContent>
      </OrbitCard>
    </div>
  );
});

// 🚀 PERFORMANCE: Componente memoizado para evitar re-renders
const DroppableColumn = memo(function DroppableColumn({
  id,
  title,
  count,
  totalValue,
  children,
  onPromoteAll,
  onDemoteAll,
}: {
  id: string;
  title: string;
  count: number;
  totalValue?: number;
  children: React.ReactNode;
  onPromoteAll?: () => void;
  onDemoteAll?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id.replace('column-', ''),
    },
  });

  const getColumnIcon = () => {
    const status = id.replace('column-', '');
    switch (status) {
      case 'Lead novo':       return <UserPlus      className="h-4 w-4 text-blue-500" />;
      case 'Em contato':      return <MessageCircle className="h-4 w-4 text-pink-500" />;
      case 'Interessado':     return <Star          className="h-4 w-4 text-green-500" />;
      case 'Proposta enviada':return <FileText      className="h-4 w-4 text-cyan-500" />;
      case 'Fechado':         return <CheckCircle2  className="h-4 w-4 text-green-500" />;
      case 'Perdido':         return <XCircle       className="h-4 w-4 text-red-500" />;
      case 'Remarketing':     return <Repeat2       className="h-4 w-4 text-yellow-500" />;
      default:                return <Filter        className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-300px)]">
      <div className="mb-3 px-1 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {getColumnIcon()}
          <span className="font-medium text-sm text-foreground">{title}</span>
          <span className="text-xs font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded-full tabular-nums">
            {count}
          </span>
          {totalValue && totalValue > 0 ? (
            <>
              <span className="text-muted-foreground/30 text-xs select-none">·</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmtCompact(totalValue)}</span>
            </>
          ) : null}
          {onPromoteAll && count > 0 && (
            <button
              onClick={onPromoteAll}
              title="Mover todos para Outbound"
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
            >
              <Megaphone className="h-3 w-3" />
              Promover
            </button>
          )}
          {onDemoteAll && count > 0 && (
            <button
              onClick={onDemoteAll}
              title="Voltar todos para Triagem"
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
            >
              <Filter className="h-3 w-3" />
              Voltar
            </button>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl px-1.5 overflow-y-auto transition-all duration-150',
          isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-transparent'
        )}
      >
        {count === 0 && !isOver ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 mx-0.5 mt-0.5 border border-dashed border-border/40 rounded-lg">
            <p className="text-xs text-muted-foreground/50">Sem leads</p>
          </div>
        ) : (
          <>
            {children}
            <div className="min-h-[60px]" />
          </>
        )}
      </div>
    </div>
  );
});

export default function CRMPage() {
  const router = useRouter();
  const { authUser, user, company, loading: userLoading } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 FIX: Pega viewMode direto da URL usando useSearchParams (reativo)
  const viewMode = useMemo(() => {
    const view = searchParams.get('view');
    return view === 'kanban' ? 'kanban' : 'table';
  }, [searchParams]);
  const [hasFetched, setHasFetched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
  const [mobileColumnPages, setMobileColumnPages] = useState<Record<string, number>>({});
  const MOBILE_PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [deletingMultipleLeads, setDeletingMultipleLeads] = useState(false);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    segment: '',
    website_or_instagram: '',
    whatsapp: '',
    email: '',
    priority: 'Média',
    status: 'Lead novo',
    nivel_interesse: 'Quente 🔥',
    import_source: 'Interno',
    project_value: 0,
    notes: '',
    cargo: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper: registrar log via API (service client, bypassa RLS)
  const logActivity = (payload: { user_id?: string; company_id: number; action: string; description: string; metadata?: object }) => {
    fetch('/api/activity-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}); // fire-and-forget, nunca bloqueia o fluxo principal
  };


  useEffect(() => {
    if (!userLoading && !hasFetched) {
      if (!user) {
        // Usuário não está logado - redireciona para login
        router.push('/login');
        return;
      }

      if (user?.company_id) {
        fetchLeads();
        setHasFetched(true);
      } else if (user && !user.company_id) {
        setError('Usuário não configurado. Verifique o banco de dados.');
        setLoading(false);
        setHasFetched(true);
      }
    }
  }, [userLoading, user, hasFetched, router]);

  async function fetchLeads() {
    try {
      const supabase = createClient();
      let query = supabase
        .from('leads')
        .select('*, lead_tags(tag_id, tags(id, tag_name, tag_color))')
        .eq('company_id', user?.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Closer puro só vê seus próprios leads atribuídos
      if (user?.role === 'closer') {
        query = query.eq('user_id', user.user_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // 🚀 PERFORMANCE: Memoizar handlers para evitar re-renders
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
    setOverId(null);
  }, []);

  // 🚀 PERFORMANCE: Remover handleDragOver - causava 100+ re-renders/segundo!
  // const handleDragOver = (event: DragOverEvent) => {
  //   const { over } = event;
  //   setOverId(over?.id ?? null);
  // };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setOverId(null);
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Determinar novo status
    let newStatus: Lead['status'] | null = null;

    // CASO 1: Drop direto na coluna (id = "column-{status}")
    if (String(overId).startsWith('column-')) {
      newStatus = String(overId).replace('column-', '') as Lead['status'];
    }
    // CASO 2: Drop em outro card (pegar status do card de destino)
    else {
      const targetLead = leads.find(l => l.id === overId || String(l.id) === String(overId));
      if (targetLead) {
        newStatus = targetLead.status;
      }
    }

    if (!newStatus) return;

    const lead = leads.find(l => l.id === activeId || String(l.id) === String(activeId));
    if (!lead || lead.status === newStatus) return;

    const oldStatus = lead.status;

    // Update otimista (atualiza UI imediatamente)
    setLeads(prevLeads => prevLeads.map(l =>
      (l.id === activeId || String(l.id) === String(activeId))
        ? { ...l, status: newStatus! }
        : l
    ));

    // Persistir no banco via API (handle outbound_campaigns unique constraint)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user?.company_id,
          field: 'status',
          value: newStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      // Criar log de atividade (fire-and-forget via API — bypassa RLS)
      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_status_change',
          description: `Moveu lead "${lead.company_name}" para "${newStatus}"`,
          metadata: {
            lead_id: lead.id,
            old_status: oldStatus,
            new_status: newStatus,
            lead_name: lead.company_name,
            contact_name: lead.contact_name,
          },
        });
      }

      toast({ title: 'Lead movido!', description: `Movido para "${newStatus}"` });
      router.refresh(); // invalida cache do Next.js → dashboard refetch ao voltar
    } catch {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
      fetchLeads();
    }
  }, [leads, user, company, router]);

  const handleOpenModal = useCallback((lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        company_name: lead.company_name || '',
        contact_name: lead.contact_name || '',
        segment: lead.segment || '',
        website_or_instagram: lead.website_or_instagram || '',
        whatsapp: lead.whatsapp || '',
        email: lead.email || '',
        priority: lead.priority || 'Média',
        status: lead.status || 'Lead novo',
        nivel_interesse: lead.nivel_interesse || 'Quente 🔥',
        import_source: lead.import_source || 'Interno',
        project_value: lead.project_value || 0,
        notes: lead.notes || '',
        cargo: lead.cargo || '',
      });
    } else {
      setEditingLead(null);
      setFormData({
        company_name: '',
        contact_name: '',
        segment: '',
        website_or_instagram: '',
        whatsapp: '',
        email: '',
        priority: 'Média',
        status: 'Lead novo',
        nivel_interesse: 'Quente 🔥',
        import_source: 'Interno',
        project_value: 0,
        notes: '',
        cargo: '',
      });
    }
    setCurrentStep(0); // Reset stepper to first step
    setShowModal(true);
  }, []);

  const handleSaveLead = useCallback(async () => {
    // Validar campos obrigatórios
    if (!formData.company_name.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Nome da empresa é obrigatório', variant: 'destructive' });
      setCurrentStep(0);
      return;
    }
    if (!formData.segment) {
      toast({ title: 'Campo obrigatório', description: 'Segmento é obrigatório', variant: 'destructive' });
      setCurrentStep(0);
      return;
    }
    if (!formData.nivel_interesse) {
      toast({ title: 'Campo obrigatório', description: 'Nível de interesse é obrigatório', variant: 'destructive' });
      setCurrentStep(2);
      return;
    }
    if (!formData.import_source) {
      toast({ title: 'Campo obrigatório', description: 'Fonte de importação é obrigatória', variant: 'destructive' });
      setCurrentStep(2);
      return;
    }

    try {
      const supabase = createClient();

      // Verificar se temos os dados necessários
      if (!user?.company_id) {
        toast({ title: 'Erro de autenticação', description: 'company_id não encontrado. Faça login novamente.', variant: 'destructive' });
        return;
      }

      // Remover cargo do objeto pois a coluna não existe no banco
      const { cargo, ...formDataWithoutCargo } = formData;
      const leadData = {
        ...formDataWithoutCargo,
        company_id: user.company_id,
        user_id: authUser?.id,
      };


      if (editingLead) {
        // Update
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);

        if (error) throw error;

        // Criar log de atividade (fire-and-forget via API — bypassa RLS)
        if (user && company) {
          logActivity({
            user_id: user.auth_user_id,
            company_id: company.id,
            action: 'lead_update',
            description: `Atualizou informações do lead "${formData.company_name}"`,
            metadata: {
              lead_id: editingLead.id,
              lead_name: formData.company_name,
            },
          });
        }

        toast({
          title: 'Lead atualizado!',
          description: `Lead "${formData.company_name}" foi atualizado com sucesso.`,
        });
      } else {
        // Insert
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert([leadData])
          .select()
          .single();

        if (error) throw error;

        // Criar log de atividade (fire-and-forget via API — bypassa RLS)
        if (user && company && newLead) {
          logActivity({
            user_id: user.auth_user_id,
            company_id: company.id,
            action: 'lead_created',
            description: `Criou novo lead "${formData.company_name}"`,
            metadata: {
              lead_id: newLead.id,
              lead_name: formData.company_name,
              segment: formData.segment,
            },
          });
        }

        toast({
          title: 'Lead criado!',
          description: `Lead "${formData.company_name}" foi adicionado com sucesso.`,
        });
      }

      setShowModal(false);
      fetchLeads();
    } catch (error: any) {
      console.error('Error saving lead:', error);
      toast({
        title: 'Erro ao salvar lead',
        description: error.message || 'Ocorreu um erro ao tentar salvar o lead.',
        variant: 'destructive',
      });
    }
  }, [formData, editingLead, user, company, authUser]);

  const handleDeleteLead = useCallback(async () => {
    if (!deletingLead) return;

    try {
      const supabase = createClient();
      const leadName = deletingLead.company_name;
      const leadId = deletingLead.id;

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      // Criar log de atividade (fire-and-forget via API — bypassa RLS)
      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_deleted',
          description: `Deletou lead "${leadName}"`,
          metadata: {
            lead_id: leadId,
            lead_name: leadName,
          },
        });
      }

      toast({ title: 'Lead deletado!', description: `Lead "${leadName}" foi removido com sucesso.` });
      setDeletingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({ title: 'Erro ao deletar lead', variant: 'destructive' });
    }
  }, [deletingLead, user, company]);

  const handleToggleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  }, []);

  const handleToggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map((l) => String(l.id))));
    }
  };

  const handleDeleteMultipleLeads = useCallback(async () => {
    if (selectedLeads.size === 0) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeads).map(id => parseInt(id)));

      if (error) throw error;
      toast({ title: 'Leads deletados!', description: `${selectedLeads.size} leads foram removidos com sucesso.` });
      setSelectedLeads(new Set());
      setDeletingMultipleLeads(false);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting multiple leads:', error);
      toast({ title: 'Erro ao deletar leads', variant: 'destructive' });
    }
  }, [selectedLeads]);

  const exportToCSV = () => {
    try {
      // Cabeçalhos do CSV
      const headers = [
        'Nome da Empresa',
        'Nome do Contato',
        'Segmento',
        'Status',
        'Website/Instagram',
        'WhatsApp',
        'Email',
        'Prioridade',
        'Nível de Interesse',
        'Valor do Projeto',
        'Fonte de Importação',
        'Observações',
        'Data de Criação'
      ];

      // Converter leads para linhas CSV
      const rows = filteredLeads.map(lead => [
        lead.company_name || '',
        lead.contact_name || '',
        lead.segment || '',
        lead.status || '',
        lead.website_or_instagram || '',
        lead.whatsapp || '',
        lead.email || '',
        lead.priority || '',
        lead.nivel_interesse || '',
        lead.project_value ? `R$ ${lead.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        lead.import_source || '',
        lead.notes || '',
        lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : ''
      ]);

      // Escapar vírgulas e aspas nos valores
      const escapeCsvValue = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // Montar CSV
      const csvContent = [
        headers.map(escapeCsvValue).join(','),
        ...rows.map(row => row.map(escapeCsvValue).join(','))
      ].join('\n');

      // Criar blob e fazer download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Exportação concluída!', description: `${filteredLeads.length} leads foram exportados com sucesso.` });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({ title: 'Erro ao exportar CSV', variant: 'destructive' });
    }
  };

  const columns = [
    { id: 'Triagem', title: 'Triagem' },
    { id: 'Outbound', title: 'Outbound' },
    { id: 'Lead novo', title: 'Lead novo' },
    { id: 'Em contato', title: 'Em contato' },
    { id: 'Interessado', title: 'Interessado' },
    { id: 'Proposta enviada', title: 'Proposta enviada' },
    { id: 'Fechado', title: 'Fechado' },
    { id: 'Perdido', title: 'Perdido' },
    { id: 'Remarketing', title: 'Remarketing' },
  ];

  // Filtros
  // 🚀 Performance: Memoizar filtragem para evitar re-computação desnecessária
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch =
        lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'Todos' || lead.status === statusFilter;
      const matchesPriority = priorityFilter === 'Todas' || lead.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [leads, searchTerm, statusFilter, priorityFilter]);

  // 🚀 Performance: Pré-computar leads por status para evitar filtrar múltiplas vezes
  const leadsByStatus = useMemo(() => {
    const statusMap = new Map<string, typeof filteredLeads>();
    const valueMap = new Map<string, number>();

    filteredLeads.forEach((lead) => {
      const status = lead.status;
      if (!statusMap.has(status)) {
        statusMap.set(status, []);
        valueMap.set(status, 0);
      }
      statusMap.get(status)!.push(lead);
      valueMap.set(status, (valueMap.get(status) || 0) + (lead.project_value || 0));
    });

    return { statusMap, valueMap };
  }, [filteredLeads]);

  const getLeadsByStatus = (status: string) => {
    return leadsByStatus.statusMap.get(status) || [];
  };

  const totalPipelineValue = useMemo(() =>
    leads
      .filter(l => l.status !== 'Fechado' && l.status !== 'Perdido')
      .reduce((sum, l) => sum + (l.project_value || 0), 0),
    [leads]
  );

  const closedCount = useMemo(() =>
    leads.filter(l => l.status === 'Fechado').length,
    [leads]
  );

  const getTotalValueByStatus = (status: string) => {
    return leadsByStatus.valueMap.get(status) || 0;
  };

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, priorityFilter]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Triagem': return 'bg-orange-500/20 text-orange-700';
      case 'Lead novo': return 'bg-blue-500/20 text-blue-700';
      case 'Em contato': return 'bg-pink-500/20 text-pink-700';
      case 'Interessado': return 'bg-green-500/20 text-green-700';
      case 'Proposta enviada': return 'bg-cyan-500/20 text-cyan-700';
      case 'Fechado': return 'bg-green-500/20 text-green-700';
      case 'Perdido': return 'bg-red-500/20 text-red-700';
      default: return 'bg-gray-500/20 text-gray-700';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-500/20 text-red-700';
      case 'Média': return 'bg-primary/20 text-primary';
      case 'Baixa': return 'bg-gray-500/20 text-gray-700';
      default: return 'bg-gray-500/20 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 bg-muted/50 animate-pulse rounded-xl" />
        <div className="h-10 bg-muted/30 animate-pulse rounded-xl" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[320px] flex-shrink-0 space-y-3">
              <div className="h-7 bg-muted/50 animate-pulse rounded-lg" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-[88px] bg-muted/30 animate-pulse rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <OrbitCard className="border-red-500">
          <OrbitCardContent className="p-6">
            <div className="text-center space-y-4">
              <p className="text-red-500 font-semibold">❌ {error}</p>
            </div>
          </OrbitCardContent>
        </OrbitCard>
      </div>
    );
  }

  const activeLead = activeDragId ? leads.find(l => l.id === activeDragId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CRM</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.length > 0
              ? `${leads.length} leads · ${fmtCompact(totalPipelineValue)} em pipeline · ${closedCount} fechado${closedCount !== 1 ? 's' : ''}`
              : 'Gerencie seus leads e oportunidades'}
          </p>
        </div>
        {/* View switcher — segmented control */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl flex-shrink-0">
          <button
            onClick={() => router.push('?view=table')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150',
              viewMode === 'table'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Planilha</span>
          </button>
          <button
            onClick={() => router.push('?view=kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150',
              viewMode === 'kanban'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      {/* Filter bar — zona de descoberta (esquerda) + ações (direita) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Zona 1: Descoberta */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {columns.map(col => (
              <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Média">Média</SelectItem>
            <SelectItem value="Baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'Todos' || priorityFilter !== 'Todas') && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            onClick={() => { setSearchTerm(''); setStatusFilter('Todos'); setPriorityFilter('Todas'); }}
          >
            Limpar
          </button>
        )}

        {/* Separador */}
        <div className="flex-1" />

        {/* Zona 2: Ações */}
        {selectedLeads.size > 0 && viewMode === 'table' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeletingMultipleLeads(true)}
            className="gap-1.5 h-9"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Deletar {selectedLeads.size}</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={exportToCSV}
          disabled={filteredLeads.length === 0}
          className="gap-1.5 h-9"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
        <Button size="sm" onClick={() => handleOpenModal()} className="gap-1.5 h-9">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Novo Lead</span>
        </Button>
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <OrbitCard>
          <OrbitCardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum lead encontrado. Clique em "Adicionar Lead" para começar!
            </p>
          </OrbitCardContent>
        </OrbitCard>
      ) : viewMode === 'kanban' ? (
        <>
          {/* Mobile Kanban - Horizontal snap scroll, one column per screen */}

          {/* Desktop Kanban */}
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="hidden md:block relative">
            <ScrollArea className="w-full">
              <div
                className="flex gap-4 pb-4"
                style={{
                  minWidth: 'min-content',
                  width: 'fit-content'
                }}
              >
                {columns.filter(c => c.id !== 'Triagem' && c.id !== 'Outbound').map((column) => {
                  const columnLeads = getLeadsByStatus(column.id);
                  return (
                    <div key={column.id} className="w-[320px] flex-shrink-0">
                      <DroppableColumn
                        id={`column-${column.id}`}
                        title={column.title}
                        count={columnLeads.length}
                        totalValue={getTotalValueByStatus(column.id)}
                      >
                        <SortableContext items={columnLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                          {columnLeads.map((lead) => (
                            <SortableLeadCard
                              key={lead.id}
                              lead={lead}
                              onEdit={() => handleOpenModal(lead)}
                              onDelete={() => setDeletingLead(lead)}
                            />
                          ))}
                        </SortableContext>
                      </DroppableColumn>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {/* Fade edge — indica mais colunas à direita */}
            <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
            </div>
            <DragOverlay>
              {activeLead ? (
                <OrbitCard className="cursor-grabbing shadow-2xl rotate-1 w-[308px] border-primary/20">
                  <OrbitCardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {activeLead.company_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{activeLead.company_name}</p>
                        {activeLead.contact_name && (
                          <p className="text-xs text-muted-foreground truncate">{activeLead.contact_name}</p>
                        )}
                      </div>
                    </div>
                    {(activeLead.priority || (activeLead.project_value && activeLead.project_value > 0)) && (
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/50">
                        {activeLead.priority && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                            activeLead.priority === 'Alta' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                            activeLead.priority === 'Média' ? 'bg-primary/10 text-primary' :
                            'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                          }`}>{activeLead.priority}</span>
                        )}
                        {activeLead.project_value && activeLead.project_value > 0 && (
                          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                            {fmtCompact(activeLead.project_value)}
                          </span>
                        )}
                      </div>
                    )}
                  </OrbitCardContent>
                </OrbitCard>
              ) : null}
            </DragOverlay>
          </DndContext>

        {/* Mobile Kanban - Horizontal snap scroll */}
        <div className="md:hidden -mx-3 overflow-x-auto flex snap-x snap-mandatory gap-3 px-3 pb-3" style={{ scrollbarWidth: 'none' }}>
          {columns.filter(c => c.id !== 'Triagem' && c.id !== 'Outbound').map((column) => {
            const colLeads = getLeadsByStatus(column.id);
            const page = mobileColumnPages[column.id] || 0;
            const totalPages = Math.ceil(colLeads.length / MOBILE_PAGE_SIZE);
            const pageLeads = colLeads.slice(page * MOBILE_PAGE_SIZE, (page + 1) * MOBILE_PAGE_SIZE);

            return (
              <div key={column.id} className="snap-center flex-shrink-0 w-[85vw] flex flex-col gap-2">
                {/* Column header */}
                <div className="flex items-center justify-between px-1 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{column.title}</span>
                    <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">{colLeads.length}</span>
                  </div>
                </div>

                {/* Cards */}
                {colLeads.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    Sem leads
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {pageLeads.map((lead) => (
                        <OrbitCard key={lead.id} className="hover:shadow-md transition-shadow">
                          <OrbitCardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-semibold text-sm flex-1 leading-tight">{lead.company_name}</h4>
                              <div className="flex gap-0.5 flex-shrink-0">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenModal(lead)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeletingLead(lead)}>
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                            {lead.contact_name && <p className="text-xs text-muted-foreground">{lead.contact_name}</p>}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${lead.priority === 'Alta' ? 'bg-red-500/20 text-red-600' : lead.priority === 'Média' ? 'bg-primary/20 text-primary' : 'bg-gray-500/20 text-gray-600'}`}>{lead.priority}</span>
                              {lead.project_value && lead.project_value > 0 && (
                                <span className="text-[10px] font-medium text-primary">R$ {lead.project_value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                              )}
                            </div>
                          </OrbitCardContent>
                        </OrbitCard>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          disabled={page === 0}
                          onClick={() => setMobileColumnPages(p => ({ ...p, [column.id]: page - 1 }))}
                          className="text-xs px-2 py-1 rounded bg-accent disabled:opacity-30"
                        >‹</button>
                        <span className="text-xs text-muted-foreground">{page + 1}/{totalPages}</span>
                        <button
                          disabled={page >= totalPages - 1}
                          onClick={() => setMobileColumnPages(p => ({ ...p, [column.id]: page + 1 }))}
                          className="text-xs px-2 py-1 rounded bg-accent disabled:opacity-30"
                        >›</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
</>
      ) : (
        <>
          {/* Desktop Table View */}
          <OrbitCard className="hidden md:block border-border/50">
            <OrbitCardContent className="p-0">
              {/* Result counter */}
              <div className="flex items-center px-4 py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground">
                  {filteredLeads.length === leads.length
                    ? `${leads.length} lead${leads.length !== 1 ? 's' : ''}`
                    : `${filteredLeads.length} de ${leads.length} leads`}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2.5 w-10">
                        <Checkbox
                          checked={selectedLeads.size === paginatedLeads.length && paginatedLeads.length > 0}
                          onCheckedChange={handleToggleSelectAll}
                        />
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Empresa</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Segmento</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Website</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Telefone</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Prioridade</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Observações</th>
                      <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paginatedLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={selectedLeads.has(String(lead.id))}
                            onCheckedChange={() => handleToggleSelectLead(String(lead.id))}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="font-medium text-sm text-foreground">{lead.company_name}</p>
                            {lead.contact_name && (
                              <p className="text-xs text-muted-foreground mt-0.5">{lead.contact_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{lead.segment || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getStatusBadgeColor(lead.status || '')}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {lead.website_or_instagram ? (
                            <a
                              href={lead.website_or_instagram.startsWith('http') ? lead.website_or_instagram : `https://${lead.website_or_instagram}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/70 text-xs transition-colors"
                            >
                              Link ↗
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{lead.whatsapp || '—'}</td>
                        <td className="px-4 py-2.5">
                          {lead.priority ? (
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1 w-fit ${getPriorityBadgeColor(lead.priority)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {lead.priority}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          {lead.notes ? (
                            <span
                              className="text-xs text-muted-foreground truncate block max-w-[180px] cursor-default"
                              title={lead.notes}
                            >
                              {lead.notes}
                            </span>
                          ) : <span className="text-muted-foreground/40 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(lead)}
                              className="h-7 w-7 hover:bg-accent"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingLead(lead)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-accent"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </OrbitCardContent>
            {filteredLeads.length > 0 && (
              <SimplePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredLeads.length}
                itemsPerPage={itemsPerPage}
              />
            )}
          </OrbitCard>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            <div className="grid gap-4">
              {paginatedLeads.map((lead) => (
              <OrbitCard key={lead.id} className="hover:shadow-lg transition-shadow">
                <OrbitCardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{lead.company_name}</h3>
                      {lead.contact_name && (
                        <p className="text-sm text-muted-foreground">{lead.contact_name}</p>
                      )}
                    </div>
                    {lead.priority && (
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityBadgeColor(lead.priority)}`}>
                        {lead.priority}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {lead.segment && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{lead.segment}</span>
                      </div>
                    )}
                    {lead.whatsapp && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{lead.whatsapp}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadgeColor(lead.status || '')}`}>
                      {lead.status}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(lead)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingLead(lead)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </OrbitCardContent>
              </OrbitCard>
              ))}
            </div>
            {filteredLeads.length > 0 && (
              <OrbitCard>
                <SimplePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredLeads.length}
                  itemsPerPage={itemsPerPage}
                />
              </OrbitCard>
            )}
          </div>
        </>
      )}

      {/* Modal Adicionar/Editar Lead */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-border/50 bg-background">
          {/* Header minimalista */}
          <div className="px-6 py-5 border-b border-border/50">
            <DialogTitle className="text-lg font-medium">
              {editingLead ? 'Editar Lead' : 'Novo Lead'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentStep === 0 && 'Informações da empresa'}
              {currentStep === 1 && 'Dados de contato'}
              {currentStep === 2 && 'Detalhes e observações'}
            </p>
          </div>

          {/* Stepper */}
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-start">
              {['Empresa', 'Contato', 'Detalhes'].map((label, i) => (
                <div key={i} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                      style={
                        i < currentStep
                          ? { backgroundColor: '#96F63C', color: '#07261C' }
                          : i === currentStep
                          ? { backgroundColor: '#96F63C', color: '#07261C', boxShadow: '0 0 0 5px rgba(150,246,60,0.18)' }
                          : { backgroundColor: '#1C1C1C', color: '#555', border: '1.5px solid #2A2A2A' }
                      }
                    >
                      {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: i <= currentStep ? '#96F63C' : '#555' }}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className="flex-1 h-[2px] mx-2 mt-4 rounded-full transition-colors"
                      style={{ backgroundColor: i < currentStep ? '#96F63C' : '#1F1F1F' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form content */}
          <div className="px-6 py-6">
            {/* Step 1: Informações Básicas */}
            {currentStep === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium">
                    Nome da Empresa <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Digite o nome da empresa"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="segment" className="text-sm font-medium">
                    Segmento <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.segment} onValueChange={(value) => setFormData({ ...formData, segment: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o segmento" />
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
                      <SelectItem value="Auto Escola">Auto Escola</SelectItem>
                      <SelectItem value="Restaurante">Restaurante</SelectItem>
                      <SelectItem value="Academia">Academia</SelectItem>
                      <SelectItem value="Farmácia">Farmácia</SelectItem>
                      <SelectItem value="Padaria">Padaria</SelectItem>
                      <SelectItem value="Supermercado">Supermercado</SelectItem>
                      <SelectItem value="Floricultural">Floricultural</SelectItem>
                      <SelectItem value="Hotel/Pousada">Hotel/Pousada</SelectItem>
                      <SelectItem value="Oficina Mecânica">Oficina Mecânica</SelectItem>
                      <SelectItem value="Pet Shop">Pet Shop</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium">Site ou Instagram</Label>
                  <Input
                    id="website"
                    value={formData.website_or_instagram}
                    onChange={(e) => setFormData({ ...formData, website_or_instagram: e.target.value })}
                    placeholder="https://... ou @usuario"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Contato */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="contact_name" className="text-sm font-medium">Nome do Contato</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Nome da pessoa de contato"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => {
                      // Remove tudo que não é dígito
                      let digits = e.target.value.replace(/\D/g, '');
                      // Adiciona 55 se não começar com 55
                      if (digits.length > 0 && !digits.startsWith('55')) {
                        digits = '55' + digits;
                      }
                      // Limita a 13 dígitos (55 + DDD + 9 dígitos)
                      digits = digits.slice(0, 13);
                      setFormData({ ...formData, whatsapp: digits });
                    }}
                    placeholder="55981680532"
                    maxLength={13}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Detalhes */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">Estágio</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="h-11">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-medium">Prioridade</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alta">Alta</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nivel_interesse" className="text-sm font-medium">Interesse</Label>
                    <Select value={formData.nivel_interesse} onValueChange={(value) => setFormData({ ...formData, nivel_interesse: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quente 🔥">Quente 🔥</SelectItem>
                        <SelectItem value="Morno 🌡️">Morno 🌡️</SelectItem>
                        <SelectItem value="Frio ❄️">Frio ❄️</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="import_source" className="text-sm font-medium">Fonte</Label>
                    <Select value={formData.import_source} onValueChange={(value) => setFormData({ ...formData, import_source: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
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
                  <div className="space-y-2">
                    <Label htmlFor="project_value" className="text-sm font-medium">Valor do Projeto</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        id="project_value"
                        type="text"
                        value={formData.project_value > 0 ? formData.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        onChange={(e) => {
                          // Remove tudo que não é número
                          const rawValue = e.target.value.replace(/\D/g, '');
                          // Converte para número (considerando os 2 últimos dígitos como centavos)
                          const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
                          setFormData({ ...formData, project_value: numericValue });
                        }}
                        placeholder="0,00"
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>
                </div>
                {editingLead?.status !== 'Triagem' && (
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Observações</Label>
                    <textarea
                      id="notes"
                      className="w-full min-h-[80px] px-3 py-2.5 rounded-xl border border-[#212121] bg-[#141414] text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#96F63C]/40 placeholder:text-muted-foreground"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Adicione observações sobre este lead..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mini-timeline de sequências — só ao editar lead existente */}
          {editingLead && <LeadSequenceTimeline leadId={editingLead.id} />}

          {/* Footer minimalista */}
          <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : setShowModal(false)}
              className="text-muted-foreground"
            >
              {currentStep > 0 ? 'Voltar' : 'Cancelar'}
            </Button>
            {currentStep < 2 ? (
              <Button
                onClick={() => {
                  if (currentStep === 0) {
                    if (!formData.company_name.trim()) {
                      toast({ title: 'Campo obrigatório', description: 'Nome da empresa é obrigatório', variant: 'destructive' });
                      return;
                    }
                    if (!formData.segment) {
                      toast({ title: 'Campo obrigatório', description: 'Segmento é obrigatório', variant: 'destructive' });
                      return;
                    }
                  }
                  setCurrentStep(currentStep + 1);
                }}
              >
                Continuar
              </Button>
            ) : (
              <Button onClick={handleSaveLead}>
                {editingLead ? 'Salvar' : 'Adicionar Lead'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog para Delete */}
      <AlertDialog open={!!deletingLead} onOpenChange={() => setDeletingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o lead <strong>"{deletingLead?.company_name}"</strong>?
              {deletingLead?.contact_name && (
                <span> (Contato: {deletingLead.contact_name})</span>
              )}
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              className="bg-red-500 hover:bg-red-600"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog para Delete Múltiplo */}
      <AlertDialog open={deletingMultipleLeads} onOpenChange={() => setDeletingMultipleLeads(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Múltiplos Leads</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{selectedLeads.size} leads selecionados</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMultipleLeads}
              className="bg-red-500 hover:bg-red-600"
            >
              Deletar Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ─── LeadSequenceTimeline ────────────────────────────────────────────────────

interface TimelineStep {
  stepId: string
  diaOffset: number
  horario: string
  tipoMensagem: string
  ordem: number
  disparado: boolean
  disparadoEm: string | null
  status: string | null
}

interface TimelineSequence {
  sequenceId: string
  sequenceName: string
  sequenceTipo: string
  sequenceAtivo: boolean
  steps: TimelineStep[]
}

const TIPO_LABEL: Record<string, string> = {
  follow_geral: 'Follow-up',
  anti_noshow: 'Anti-noshow',
  remarketing: 'Remarketing',
  trial_saas: 'Trial',
}

const TIPO_COLOR: Record<string, string> = {
  follow_geral: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  anti_noshow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  remarketing: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  trial_saas: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

function LeadSequenceTimeline({ leadId }: { leadId: number }) {
  const [data, setData] = useState<TimelineSequence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/follow/lead-timeline?lead_id=${leadId}`)
      .then((r) => r.json())
      .then((j) => setData(j.timeline ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) {
    return (
      <div className="px-6 py-3 border-t border-border/40">
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (data.length === 0) return null

  return (
    <div className="px-6 py-5 border-t border-border/40 space-y-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        <GitBranch className="h-3 w-3" />
        Sequências ativas
      </div>

      <div className="space-y-4">
        {data.map((seq) => {
          const sent = seq.steps.filter((s) => s.disparado).length
          const total = seq.steps.length
          return (
            <div key={seq.sequenceId} className="rounded-xl p-3 space-y-3" style={{ backgroundColor: '#0E0E0E', border: '1px solid #1A1A1A' }}>
              {/* Header da sequência */}
              <div className="flex items-center gap-2.5">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TIPO_COLOR[seq.sequenceTipo] ?? 'bg-muted text-muted-foreground')}>
                  {TIPO_LABEL[seq.sequenceTipo] ?? seq.sequenceTipo}
                </span>
                <span className="text-xs font-medium text-foreground truncate flex-1">{seq.sequenceName}</span>
                <span className="text-[10px] font-medium shrink-0" style={{ color: '#666' }}>{sent}/{total} enviados</span>
              </div>

              {/* Steps rail */}
              <div className="flex items-center gap-1.5 pl-0.5">
                {seq.steps.map((step, idx) => (
                  <div key={step.stepId} className="flex items-center gap-1.5">
                    <div
                      title={step.disparado
                        ? `Dia ${step.diaOffset} · ${step.horario} · ${step.disparadoEm ? new Date(step.disparadoEm).toLocaleDateString('pt-BR') : 'enviado'}`
                        : `Dia ${step.diaOffset} · ${step.horario} · pendente`}
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                        step.disparado
                          ? step.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                      style={!step.disparado ? { backgroundColor: '#1A1A1A' } : undefined}
                    >
                      {step.disparado
                        ? step.status === 'failed'
                          ? <XCircle className="h-3 w-3" />
                          : <CheckCheck className="h-3 w-3" />
                        : <Clock className="h-3 w-3" />}
                    </div>
                    {idx < seq.steps.length - 1 && (
                      <div className="h-px w-4 shrink-0 rounded-full" style={{ backgroundColor: step.disparado ? 'rgba(52,178,112,0.35)' : '#242424' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
