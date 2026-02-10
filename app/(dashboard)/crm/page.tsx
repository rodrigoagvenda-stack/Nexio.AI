'use client';

import { useState, useEffect } from 'react';
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
import { Stepper, Step } from '@/components/ui/stepper';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Search, Flame, User, Phone, DollarSign, Building2, Download } from 'lucide-react';
import { toast } from 'sonner';
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

// Componente de card draggable para o Kanban
function SortableLeadCard({ lead, onEdit, onDelete }: { lead: Lead; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  });

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
      <OrbitCard className="group hover:shadow-md transition-all duration-200 mb-3 dark:bg-[#0A0A0A] bg-card h-[200px]">
        <OrbitCardContent className="p-4 space-y-3 h-full flex flex-col">
          {/* Header com ícone e ações */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {getInitials(lead.company_name)}
              </span>
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
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 h-fit">
                {lead.segment}
              </span>
            )}
          </div>

          {/* Footer com métricas */}
          <div className="flex items-center justify-between text-muted-foreground pt-2 border-t border-border/50 mt-auto">
            <div className="flex items-center gap-3 text-xs">
              {lead.whatsapp && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>1</span>
                </div>
              )}
              {lead.project_value && lead.project_value > 0 && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>R$ {(lead.project_value / 1000).toFixed(0)}k</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </OrbitCardContent>
      </OrbitCard>
    </div>
  );
}

// Componente de coluna droppable
function DroppableColumn({
  id,
  title,
  count,
  totalValue,
  children,
}: {
  id: string;
  title: string;
  count: number;
  totalValue?: number;
  children: React.ReactNode;
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
      case 'Lead novo': return '🔵';
      case 'Em contato': return '💬';
      case 'Interessado': return '⭐';
      case 'Proposta enviada': return '📄';
      case 'Fechado': return '✅';
      case 'Perdido': return '❌';
      default: return '📋';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="mb-3 px-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getColumnIcon()}</span>
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <span className="text-xs font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        {totalValue !== undefined && totalValue > 0 && (
          <p className="text-xs text-muted-foreground mt-1 ml-7">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg p-2 overflow-y-auto transition-all ${
          isOver ? 'bg-accent/50' : 'bg-transparent'
        }`}
      >
        {children}
        <div className="min-h-[100px]" />
      </div>
    </div>
  );
}

export default function CRMPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, user, company, loading: userLoading } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const viewMode = (searchParams.get('view') === 'kanban' ? 'kanban' : 'table') as 'kanban' | 'table';
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
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
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
    setOverId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setOverId(null);
    const { active, over } = event;
    setActiveDragId(null);

    console.group('🎯 DRAG & DROP DEBUG');
    console.log('Event:', event);
    console.log('Active ID:', active.id, 'Type:', typeof active.id);
    console.log('Over ID:', over?.id, 'Type:', typeof over?.id);
    console.log('Over Data:', over?.data);

    if (!over) {
      console.warn('❌ No drop target!');
      console.groupEnd();
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Determinar novo status
    let newStatus: Lead['status'] | null = null;

    // CASO 1: Drop direto na coluna (id = "column-{status}")
    if (String(overId).startsWith('column-')) {
      newStatus = String(overId).replace('column-', '') as Lead['status'];
      console.log('✅ Drop na COLUNA:', newStatus);
    }
    // CASO 2: Drop em outro card (pegar status do card de destino)
    else {
      const targetLead = leads.find(l => l.id === overId || String(l.id) === String(overId));
      if (targetLead) {
        newStatus = targetLead.status;
        console.log('✅ Drop no CARD. Usando status da coluna:', newStatus);
      } else {
        console.error('❌ Card de destino não encontrado:', overId);
      }
    }

    if (!newStatus) {
      console.error('❌ Não foi possível determinar o status de destino');
      console.groupEnd();
      return;
    }

    // Buscar lead sendo arrastado
    const lead = leads.find(l => l.id === activeId || String(l.id) === String(activeId));

    if (!lead) {
      console.error('❌ Lead arrastado não encontrado:', activeId);
      console.groupEnd();
      return;
    }

    if (lead.status === newStatus) {
      console.log('ℹ️ Lead já está neste status. Nada a fazer.');
      console.groupEnd();
      return;
    }

    console.log(`🔄 Movendo "${lead.company_name}" de "${lead.status}" → "${newStatus}"`);

    const oldStatus = lead.status;

    // Update otimista (atualiza UI imediatamente)
    setLeads(prevLeads => prevLeads.map(l =>
      (l.id === activeId || String(l.id) === String(activeId))
        ? { ...l, status: newStatus! }
        : l
    ));

    // Persistir no banco
    try {
      const supabase = createClient();

      // Preparar dados para atualização
      const updateData: any = { status: newStatus };

      // Se o novo status for "Fechado", adicionar closed_at
      if (newStatus === 'Fechado') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);

      if (error) throw error;

      // Criar log de atividade
      if (user && company) {
        await supabase.from('activity_logs').insert({
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

      console.log('✅ Status atualizado no banco com sucesso!');
      toast.success(`Lead movido para "${newStatus}"!`);
      console.groupEnd();
    } catch (error) {
      console.error('❌ Erro ao atualizar no banco:', error);
      toast.error('Erro ao atualizar lead');
      // Reverter mudança otimista
      fetchLeads();
      console.groupEnd();
    }
  };

  const handleOpenModal = (lead?: Lead) => {
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
  };

  const handleSaveLead = async () => {
    // Validar campos obrigatórios
    if (!formData.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      setCurrentStep(0);
      return;
    }
    if (!formData.segment) {
      toast.error('Segmento é obrigatório');
      setCurrentStep(0);
      return;
    }
    if (!formData.nivel_interesse) {
      toast.error('Nível de interesse é obrigatório');
      setCurrentStep(2);
      return;
    }
    if (!formData.import_source) {
      toast.error('Fonte de importação é obrigatória');
      setCurrentStep(2);
      return;
    }

    try {
      const supabase = createClient();

      // Verificar se temos os dados necessários
      if (!user?.company_id) {
        toast.error('Erro: company_id não encontrado. Faça login novamente.');
        console.error('Missing company_id. User:', user, 'AuthUser:', authUser);
        return;
      }

      // Remover cargo do objeto pois a coluna não existe no banco
      const { cargo, ...formDataWithoutCargo } = formData;
      const leadData = {
        ...formDataWithoutCargo,
        company_id: user.company_id,
        user_id: authUser?.id,
      };

      console.log('Saving lead with data:', leadData);

      if (editingLead) {
        // Update
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);

        if (error) throw error;

        // Criar log de atividade
        if (user && company) {
          await supabase.from('activity_logs').insert({
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

        toast.success(`Lead "${formData.company_name}" atualizado com sucesso!`);
      } else {
        // Insert
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert([leadData])
          .select()
          .single();

        if (error) throw error;

        // Criar log de atividade
        if (user && company && newLead) {
          await supabase.from('activity_logs').insert({
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

        toast.success(`Lead "${formData.company_name}" adicionado com sucesso!`);
      }

      setShowModal(false);
      fetchLeads();
    } catch (error: any) {
      console.error('Error saving lead:', error);
      toast.error(error.message || 'Erro ao salvar lead');
    }
  };

  const handleDeleteLead = async () => {
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

      // Criar log de atividade
      if (user && company) {
        await supabase.from('activity_logs').insert({
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

      toast.success(`Lead "${leadName}" deletado com sucesso!`);
      setDeletingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao deletar lead');
    }
  };

  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map((l) => String(l.id))));
    }
  };

  const handleDeleteMultipleLeads = async () => {
    if (selectedLeads.size === 0) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeads).map(id => parseInt(id)));

      if (error) throw error;
      toast.success(`${selectedLeads.size} leads deletados com sucesso!`);
      setSelectedLeads(new Set());
      setDeletingMultipleLeads(false);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting multiple leads:', error);
      toast.error('Erro ao deletar leads');
    }
  };

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
        lead.project_value ? `R$ ${lead.project_value.toFixed(2)}` : '',
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

      toast.success(`${filteredLeads.length} leads exportados com sucesso!`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Erro ao exportar CSV');
    }
  };

  const columns = [
    { id: 'Lead novo', title: 'Lead novo' },
    { id: 'Em contato', title: 'Em contato' },
    { id: 'Interessado', title: 'Interessado' },
    { id: 'Proposta enviada', title: 'Proposta enviada' },
    { id: 'Fechado', title: 'Fechado' },
    { id: 'Perdido', title: 'Perdido' },
    { id: 'Remarketing', title: 'Remarketing' },
  ];

  const getLeadsByStatus = (status: string) => {
    return filteredLeads.filter((lead) => lead.status === status);
  };

  const getTotalValueByStatus = (status: string) => {
    return filteredLeads
      .filter((lead) => lead.status === status)
      .reduce((sum, lead) => sum + (lead.project_value || 0), 0);
  };

  // Filtros
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'Todos' || lead.status === statusFilter;
    const matchesPriority = priorityFilter === 'Todas' || lead.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

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
      case 'Lead novo': return 'bg-blue-500/20 text-blue-700';
      case 'Em contato': return 'bg-pink-500/20 text-pink-700';
      case 'Interessado': return 'bg-purple-500/20 text-purple-700';
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
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse h-8 w-32 bg-secondary rounded-lg" />
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
    <div className="space-y-6">
      {/* Filtros e View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
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
              <SelectTrigger className="w-full md:w-40">
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
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('Todos');
                  setPriorityFilter('Todas');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          {selectedLeads.size > 0 && viewMode === 'table' && (
            <Button
              variant="destructive"
              onClick={() => setDeletingMultipleLeads(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Deletar {selectedLeads.size} selecionado(s)</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filteredLeads.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar Lead</span>
          </Button>
        </div>
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
          {/* Desktop Kanban */}
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="hidden md:block w-full">
              <div
                className="flex gap-4 pb-4"
                style={{
                  minWidth: 'min-content',
                  width: 'fit-content'
                }}
              >
                {columns.map((column) => {
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
            <DragOverlay>
              {activeLead ? (
                <OrbitCard className="cursor-grabbing shadow-2xl opacity-90 border-l-4 border-l-primary">
                  <OrbitCardContent className="p-4">
                    <h4 className="font-semibold text-sm">{activeLead.company_name}</h4>
                  </OrbitCardContent>
                </OrbitCard>
              ) : null}
            </DragOverlay>
          </DndContext>

        {/* Mobile Kanban - Vertical List with Status Selector */}
        <div className="md:hidden space-y-3">
          {filteredLeads.map((lead) => (
            <OrbitCard key={lead.id} className="hover:shadow-lg transition-shadow">
              <OrbitCardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm flex-1">{lead.company_name}</h4>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenModal(lead)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeletingLead(lead)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {lead.contact_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {lead.contact_name}
                    </p>
                  )}
                  {lead.whatsapp && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {lead.whatsapp}
                    </p>
                  )}
                  {lead.project_value && lead.project_value > 0 && (
                    <p className="text-sm font-semibold text-primary flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      R$ {lead.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}

                  {/* Status Selector */}
                  <div>
                    <Label htmlFor={`status-${lead.id}`} className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={lead.status}
                      onValueChange={async (newStatus) => {
                        // Update optimistically
                        setLeads(prevLeads =>
                          prevLeads.map(l =>
                            l.id === lead.id ? { ...l, status: newStatus as Lead['status'] } : l
                          )
                        );

                        // Persist to database
                        try {
                          const supabase = createClient();
                          const oldStatus = lead.status;

                          // Preparar dados para atualização
                          const updateData: any = { status: newStatus };

                          // Se o novo status for "Fechado", adicionar closed_at
                          if (newStatus === 'Fechado') {
                            updateData.closed_at = new Date().toISOString();
                          }

                          const { error } = await supabase
                            .from('leads')
                            .update(updateData)
                            .eq('id', lead.id);

                          if (error) throw error;

                          // Criar log de atividade
                          if (user && company) {
                            await supabase.from('activity_logs').insert({
                              user_id: user.auth_user_id,
                              company_id: company.id,
                              action: 'lead_status_change',
                              description: `Alterou status do lead "${lead.company_name}" de "${oldStatus}" para "${newStatus}"`,
                              metadata: {
                                lead_id: lead.id,
                                old_status: oldStatus,
                                new_status: newStatus,
                                lead_name: lead.company_name,
                                contact_name: lead.contact_name,
                              },
                            });
                          }

                          toast.success(`Status atualizado para "${newStatus}"!`);
                        } catch (error) {
                          console.error('Error updating status:', error);
                          toast.error('Erro ao atualizar status');
                          fetchLeads(); // Revert on error
                        }
                      }}
                    >
                      <SelectTrigger id={`status-${lead.id}`} className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority and Interest Level */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      lead.priority === 'Alta' ? 'bg-red-500/20 text-red-700' :
                      lead.priority === 'Média' ? 'bg-primary/20 text-primary' :
                      'bg-gray-500/20 text-gray-700'
                    }`}>
                      {lead.priority}
                    </span>
                    {lead.nivel_interesse && (
                      <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                        lead.nivel_interesse.includes('Quente') ? 'bg-red-500/10 text-red-600' :
                        lead.nivel_interesse.includes('Morno') ? 'bg-blue-500/10 text-blue-600' :
                        'bg-gray-500/10 text-gray-600'
                      }`}>
                        {lead.nivel_interesse.includes('Quente') && <Flame className="h-3 w-3" />}
                        {lead.nivel_interesse}
                      </span>
                    )}
                  </div>

                  {/* Segment */}
                  {lead.segment && (
                    <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {lead.segment}
                    </p>
                  )}
                </div>
              </OrbitCardContent>
            </OrbitCard>
          ))}
        </div>
        </>
      ) : (
        <>
          {/* Desktop Table View */}
          <OrbitCard className="hidden md:block border-border/50">
            <OrbitCardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-4 w-12">
                        <Checkbox
                          checked={selectedLeads.size === paginatedLeads.length && paginatedLeads.length > 0}
                          onCheckedChange={handleToggleSelectAll}
                        />
                      </th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Nome da Empresa</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Segmento</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Website</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Telefone</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Prioridade</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Importação</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Observações</th>
                      <th className="text-left px-6 py-4 font-medium text-xs text-muted-foreground uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {paginatedLeads.map((lead, index) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-3 py-4">
                          <Checkbox
                            checked={selectedLeads.has(String(lead.id))}
                            onCheckedChange={() => handleToggleSelectLead(String(lead.id))}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-sm text-foreground">{lead.company_name}</p>
                            {lead.contact_name && (
                              <p className="text-xs text-muted-foreground mt-0.5">{lead.contact_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{lead.segment || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${getStatusBadgeColor(lead.status || '')}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {lead.website_or_instagram ? (
                            <a
                              href={lead.website_or_instagram.startsWith('http') ? lead.website_or_instagram : `https://${lead.website_or_instagram}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 text-sm transition-colors"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{lead.whatsapp || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 w-fit ${getPriorityBadgeColor(lead.priority || '')}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {lead.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{lead.import_source || '-'}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground max-w-[200px] truncate">{lead.notes || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(lead)}
                              className="h-8 w-8 hover:bg-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingLead(lead)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-accent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-border/50 bg-[#0a0a0a]">
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

          {/* Progress bar minimalista */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    step <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${currentStep >= 0 ? 'text-primary' : 'text-muted-foreground'}`}>Empresa</span>
              <span className={`text-xs ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Contato</span>
              <span className={`text-xs ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Detalhes</span>
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
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(00) 00000-0000"
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
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Observações</Label>
                  <textarea
                    id="notes"
                    className="w-full min-h-[80px] px-3 py-2.5 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Adicione observações sobre este lead..."
                  />
                </div>
              </div>
            )}
          </div>

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
                      toast.error('Nome da empresa é obrigatório');
                      return;
                    }
                    if (!formData.segment) {
                      toast.error('Segmento é obrigatório');
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
