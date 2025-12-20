'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
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
import { Plus, LayoutGrid, Table as TableIcon, Pencil, Trash2, Search, Flame, User, Phone, DollarSign, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Lead } from '@/types/database.types';
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
    scale: isDragging ? 1.02 : 1,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lead novo': return 'border-l-blue-500';
      case 'Em contato': return 'border-l-pink-500';
      case 'Interessado': return 'border-l-purple-500';
      case 'Proposta enviada': return 'border-l-cyan-500';
      case 'Fechado': return 'border-l-green-500';
      case 'Perdido': return 'border-l-red-500';
      default: return 'border-l-gray-500';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      'Alta': 'bg-red-500/20 text-red-700',
      'Média': 'bg-yellow-500/20 text-yellow-700',
      'Baixa': 'bg-gray-500/20 text-gray-700',
    };
    return colors[priority as keyof typeof colors] || colors['Baixa'];
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className={`cursor-grab active:cursor-grabbing hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-l-4 ${getStatusColor(lead.status)} mb-3 bg-card`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-sm flex-1 pr-2">{lead.company_name}</h4>
            <div className="flex gap-1" style={{ pointerEvents: 'auto' }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-accent"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEdit();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-destructive/10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>

          {lead.contact_name && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <User className="h-3 w-3" />
              {lead.contact_name}
            </p>
          )}

          {lead.whatsapp && (
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.whatsapp}
            </p>
          )}

          {lead.project_value && lead.project_value > 0 && (
            <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              R$ {lead.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className={`text-xs px-2 py-1 rounded-full ${getPriorityBadge(lead.priority || 'Baixa')}`}>
              {lead.priority}
            </span>
            {lead.nivel_interesse && (
              <span className="text-xs bg-orange-500/20 text-orange-700 px-2 py-1 rounded-full flex items-center gap-1">
                {lead.nivel_interesse.includes('Quente') && <Flame className="h-3 w-3" />}
                {lead.nivel_interesse}
              </span>
            )}
          </div>

          {lead.segment && (
            <p className="text-xs text-muted-foreground mt-2 italic flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {lead.segment}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de coluna droppable - Design minimalista
function DroppableColumn({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id.replace('column-', ''),
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card border border-border rounded-t-lg p-3 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full font-medium">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 bg-secondary/20 border border-t-0 border-border rounded-b-lg p-3 min-h-[600px] transition-all duration-200 ${
          isOver ? 'bg-primary/10 border-primary ring-2 ring-primary/50 scale-[1.02]' : ''
        }`}
      >
        {children}
        {/* Espaço vazio para facilitar drop */}
        <div className="min-h-[100px]" />
      </div>
    </div>
  );
}

export default function CRMPage() {
  const { user, loading: userLoading } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
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
    nivel_interesse: 'Morno',
    import_source: 'Manual',
    project_value: 0,
    notes: '',
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
      if (user?.company_id) {
        fetchLeads();
        setHasFetched(true);
      } else {
        setError('Usuário não configurado. Verifique o banco de dados.');
        setLoading(false);
        setHasFetched(true);
      }
    }
  }, [userLoading, user?.company_id, hasFetched]);

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

    // Update otimista (atualiza UI imediatamente)
    setLeads(prevLeads => prevLeads.map(l =>
      (l.id === activeId || String(l.id) === String(activeId))
        ? { ...l, status: newStatus! }
        : l
    ));

    // Persistir no banco
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', lead.id);

      if (error) throw error;

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
        nivel_interesse: lead.nivel_interesse || 'Morno',
        import_source: lead.import_source || 'Manual',
        project_value: lead.project_value || 0,
        notes: lead.notes || '',
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
        nivel_interesse: 'Morno',
        import_source: 'Manual',
        project_value: 0,
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleSaveLead = async () => {
    if (!formData.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    try {
      const supabase = createClient();

      const leadData = {
        ...formData,
        company_id: user?.company_id,
      };

      if (editingLead) {
        // Update
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);

        if (error) throw error;
        toast.success(`Lead "${formData.company_name}" atualizado com sucesso!`);
      } else {
        // Insert
        const { error } = await supabase
          .from('leads')
          .insert([leadData]);

        if (error) throw error;
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
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', deletingLead.id);

      if (error) throw error;
      toast.success(`Lead "${deletingLead.company_name}" deletado com sucesso!`);
      setDeletingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao deletar lead');
    }
  };

  const columns = [
    { id: 'Lead novo', title: 'Lead novo' },
    { id: 'Em contato', title: 'Em contato' },
    { id: 'Interessado', title: 'Interessado' },
    { id: 'Proposta enviada', title: 'Proposta enviada' },
    { id: 'Fechado', title: 'Fechado' },
    { id: 'Perdido', title: 'Perdido' },
  ];

  const getLeadsByStatus = (status: string) => {
    return filteredLeads.filter((lead) => lead.status === status);
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
      case 'Média': return 'bg-yellow-500/20 text-yellow-700';
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
        <Card className="border-red-500">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <p className="text-red-500 font-semibold">❌ {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeLead = activeDragId ? leads.find(l => l.id === activeDragId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Planilha de Leads - Gerencie seus leads e oportunidades</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Lead
        </Button>
      </div>

      {/* Filtros e View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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
            <SelectTrigger className="w-40">
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
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum lead encontrado. Clique em "Adicionar Lead" para começar!
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {columns.map((column) => {
              const columnLeads = getLeadsByStatus(column.id);
              return (
                <DroppableColumn
                  key={column.id}
                  id={`column-${column.id}`}
                  title={column.title}
                  count={columnLeads.length}
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
              );
            })}
          </div>
          <DragOverlay>
            {activeLead ? (
              <Card className="cursor-grabbing shadow-2xl opacity-90 border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm">{activeLead.company_name}</h4>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-4 font-semibold text-sm">NOME DA EMPRESA</th>
                      <th className="text-left p-4 font-semibold text-sm">SEGMENTO</th>
                      <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                      <th className="text-left p-4 font-semibold text-sm">WEBSITE</th>
                      <th className="text-left p-4 font-semibold text-sm">TELEFONE</th>
                      <th className="text-left p-4 font-semibold text-sm">PRIORIDADE</th>
                      <th className="text-left p-4 font-semibold text-sm">IMPORTAÇÃO</th>
                      <th className="text-left p-4 font-semibold text-sm">OBSERVAÇÕES</th>
                      <th className="text-left p-4 font-semibold text-sm">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, index) => (
                      <tr
                        key={lead.id}
                        className={`border-b hover:bg-accent/50 transition-colors ${
                          index % 2 === 0 ? 'bg-background' : 'bg-secondary/20'
                        }`}
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-sm">{lead.company_name}</p>
                            {lead.contact_name && (
                              <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm">{lead.segment || '-'}</td>
                        <td className="p-4">
                          <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadgeColor(lead.status || '')}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {lead.website_or_instagram ? (
                            <a
                              href={lead.website_or_instagram.startsWith('http') ? lead.website_or_instagram : `https://${lead.website_or_instagram}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-500 hover:underline text-sm"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-sm">Não tem</span>
                          )}
                        </td>
                        <td className="p-4 text-sm">{lead.whatsapp || '-'}</td>
                        <td className="p-4">
                          <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 w-fit ${getPriorityBadgeColor(lead.priority || '')}`}>
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {lead.priority}
                          </span>
                        </td>
                        <td className="p-4 text-sm">{lead.import_source || '-'}</td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{lead.notes || '-'}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(lead)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingLead(lead)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLeads.length > 0 && (
                <div className="p-4 border-t bg-secondary/30 text-sm text-muted-foreground">
                  Mostrando {filteredLeads.length} de {leads.length} leads
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden grid gap-4">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4 space-y-3">
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
                </CardContent>
              </Card>
            ))}
            {filteredLeads.length > 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Mostrando {filteredLeads.length} de {leads.length} leads
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Adicionar/Editar Lead */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? `Editar Lead: ${editingLead.company_name}` : 'Adicionar Lead'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">1. Informações Básicas</TabsTrigger>
              <TabsTrigger value="contato">2. Contato</TabsTrigger>
              <TabsTrigger value="detalhes">3. Detalhes</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Ex: Empresa XYZ Ltda"
                />
              </div>
              <div>
                <Label htmlFor="segment">Segmento *</Label>
                <Input
                  id="segment"
                  value={formData.segment}
                  onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  placeholder="Ex: Saúde/Medicina, Tecnologia, etc."
                />
              </div>
              <div>
                <Label htmlFor="website">Site/Instagram</Label>
                <Input
                  id="website"
                  value={formData.website_or_instagram}
                  onChange={(e) => setFormData({ ...formData, website_or_instagram: e.target.value })}
                  placeholder="Ex: https://exemplo.com.br ou @instagram"
                />
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="contact_name">Nome do Contato</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="Ex: +55 11 98765-4321"
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Ex: contato@empresa.com"
                />
              </div>
            </TabsContent>

            <TabsContent value="detalhes" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Prioridade *</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
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
                <div>
                  <Label htmlFor="import_source">Fonte de Importação *</Label>
                  <Select value={formData.import_source} onValueChange={(value) => setFormData({ ...formData, import_source: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Google Maps">Google Maps</SelectItem>
                      <SelectItem value="PEG">PEG</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="project_value">Valor do Projeto (R$)</Label>
                <Input
                  id="project_value"
                  type="number"
                  value={formData.project_value}
                  onChange={(e) => setFormData({ ...formData, project_value: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: 5000"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações sobre o lead..."
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLead} className="bg-orange-500 hover:bg-orange-600">
              {editingLead ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
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
    </div>
  );
}
