'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Template {
  id: number;
  name: string;
  content: string;
  shortcut: string | null;
  category: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

interface TemplatesManagerProps {
  companyId: number;
  userId: number;
}

const categories = [
  { value: 'geral', label: 'Geral' },
  { value: 'saudacao', label: 'Saudação' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'preco', label: 'Preço' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'encerramento', label: 'Encerramento' },
];

export function TemplatesManager({ companyId, userId }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form state
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formShortcut, setFormShortcut] = useState('');
  const [formCategory, setFormCategory] = useState('geral');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [companyId, categoryFilter]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const url = new URL('/api/templates', window.location.origin);
      url.searchParams.set('companyId', companyId.toString());
      if (categoryFilter !== 'all') {
        url.searchParams.set('category', categoryFilter);
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: 'Erro ao carregar templates', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormName('');
    setFormContent('');
    setFormShortcut('');
    setFormCategory('geral');
    setDialogOpen(true);
  }

  function openEditDialog(template: Template) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setFormShortcut(template.shortcut || '');
    setFormCategory(template.category);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formContent.trim()) {
      toast({ title: 'Preencha nome e conteúdo do template', variant: 'destructive' });
      return;
    }

    if (formShortcut && !formShortcut.startsWith('/')) {
      toast({ title: 'Atalho deve começar com /', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : '/api/templates';

      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          userId,
          name: formName.trim(),
          content: formContent.trim(),
          shortcut: formShortcut.trim() || null,
          category: formCategory,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 
          editingTemplate
            ? 'Template atualizado com sucesso'
            : 'Template criado com sucesso'
         });
        setDialogOpen(false);
        fetchTemplates();
      } else {
        toast({ title: data.message || 'Erro ao salvar template', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: 'Erro ao salvar template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: number) {
    if (!confirm('Deseja realmente excluir este template?')) return;

    try {
      const response = await fetch(
        `/api/templates/${templateId}?companyId=${companyId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Template excluído com sucesso' });
        fetchTemplates();
      } else {
        toast({ title: data.message || 'Erro ao excluir template', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: 'Erro ao excluir template', variant: 'destructive' });
    }
  }

  function copyToClipboard(content: string) {
    navigator.clipboard.writeText(content);
    toast({ title: 'Conteúdo copiado!' });
  }

  const filteredTemplates =
    categoryFilter === 'all'
      ? templates
      : templates.filter((t) => t.category === categoryFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates de Mensagens</h2>
          <p className="text-sm text-muted-foreground">
            Crie respostas rápidas com atalhos e variáveis dinâmicas
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Filtro de Categoria */}
      <div className="flex gap-2">
        <Button
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCategoryFilter('all')}
        >
          Todas
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.value}
            variant={categoryFilter === cat.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Lista de Templates */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Carregando templates...
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Nenhum template encontrado. Crie seu primeiro template!
          </p>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.shortcut && (
                        <Badge variant="secondary" className="text-xs mr-2">
                          {template.shortcut}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {categories.find((c) => c.value === template.category)?.label}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.content}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Usado {template.usage_count}x</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(template.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(template)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Use variáveis como {'{'}
              {'{'}nome{'}'},{' '}
              {'{'}
              {'{'}empresa{'}'},{' '}
              {'{'}
              {'{'}telefone{'}'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Boas-vindas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortcut">Atalho</Label>
                <Input
                  id="shortcut"
                  value={formShortcut}
                  onChange={(e) => setFormShortcut(e.target.value)}
                  placeholder="Ex: /oi"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Olá {{nome}}! Como posso ajudar?"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}
                {'{'}nome{'}'}, {'{'}
                {'{'}empresa{'}'}, {'{'}
                {'{'}telefone{'}'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
