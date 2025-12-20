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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, Table as TableIcon, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Lead } from '@/types/database.types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Componente de card draggable para o Kanban
function SortableLeadCard({ lead, onEdit, onDelete }: { lead: Lead; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lead novo': return 'border-l-blue-500';
      case 'Em contato': return 'border-l-yellow-500';
      case 'Interessado': return 'border-l-orange-500';
      case 'Proposta enviada': return 'border-l-purple-500';
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
      <Card className={`cursor-move hover:shadow-lg transition-all border-l-4 ${getStatusColor(lead.status)} mb-2`}>
        <CardContent className="p-3">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-sm">{lead.company_name}</h4>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          </div>
          {lead.contact_name && (
            <p className="text-xs text-muted-foreground mb-2">{lead.contact_name}</p>
          )}
          {lead.project_value && (
            <p className="text-sm font-semibold text-primary mb-2">
              R$ {lead.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(lead.priority || 'Baixa')}`}>
              {lead.priority}
            </span>
            {lead.nivel_interesse && (
              <span className="text-xs">{lead.nivel_interesse}</span>
            )}
          </div>
          {lead.segment && (
            <p className="text-xs text-muted-foreground mt-2">{lead.segment}</p>
          )}
        </CardContent>
      </Card>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');

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
    nivel_interesse: 'Morno 🌡️',
    import_source: 'Manual',
    project_value: 0,
    notes: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Se foi dropado em uma coluna, atualizar status
    if (typeof overId === 'string' && overId.startsWith('column-')) {
      const newStatus = overId.replace('column-', '') as Lead['status'];
      const lead = leads.find(l => l.id === activeId);

      if (lead && lead.status !== newStatus) {
        try {
          const supabase = createClient();
          const { error } = await supabase
            .from('leads')
            .update({ status: newStatus })
            .eq('id', activeId);

          if (error) throw error;

          setLeads(leads.map(l => l.id === activeId ? { ...l, status: newStatus } : l));
          toast.success('Status atualizado!');
        } catch (error) {
          console.error('Error updating lead:', error);
          toast.error('Erro ao atualizar lead');
        }
      }
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
        nivel_interesse: lead.nivel_interesse || 'Morno 🌡️',
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
        nivel_interesse: 'Morno 🌡️',
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
        toast.success('Lead atualizado com sucesso!');
      } else {
        // Insert
        const { error } = await supabase
          .from('leads')
          .insert([leadData]);

        if (error) throw error;
        toast.success('Lead adicionado com sucesso!');
      }

      setShowModal(false);
      fetchLeads();
    } catch (error: any) {
      console.error('Error saving lead:', error);
      toast.error(error.message || 'Erro ao salvar lead');
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este lead?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Lead deletado com sucesso!');
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao deletar lead');
    }
  };

  const columns = [
    'Lead novo',
    'Em contato',
    'Interessado',
    'Proposta enviada',
    'Fechado',
    'Perdido',
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
      case 'Em contato': return 'bg-yellow-500/20 text-yellow-700';
      case 'Interessado': return 'bg-orange-500/20 text-orange-700';
      case 'Proposta enviada': return 'bg-purple-500/20 text-purple-700';
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
              {columns.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {columns.map((column) => {
              const columnLeads = getLeadsByStatus(column);
              return (
                <div key={column} className="space-y-3">
                  <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                    <h3 className="font-semibold text-sm">{column}</h3>
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>
                  <SortableContext items={columnLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 min-h-[200px]" id={`column-${column}`}>
                      {columnLeads.map((lead) => (
                        <SortableLeadCard
                          key={lead.id}
                          lead={lead}
                          onEdit={() => handleOpenModal(lead)}
                          onDelete={() => handleDeleteLead(lead.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
      ) : (
        <Card>
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
                      <td className="p-4 text-sm text-muted-foreground">{lead.notes || '-'}</td>
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
                            onClick={() => handleDeleteLead(lead.id)}
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
      )}

      {/* Modal Adicionar/Editar Lead */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Editar Lead' : 'Adicionar Lead'}</DialogTitle>
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
    </div>
  );
}
