'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Zap } from 'lucide-react';

interface AutoResponse {
  id?: number;
  company_id: number;
  name: string;
  keywords: string[];
  response_message: string;
  match_type: 'contains' | 'exact' | 'starts_with' | 'ends_with';
  case_sensitive: boolean;
  is_active: boolean;
  priority: number;
  trigger_count?: number;
  last_triggered_at?: string;
}

interface AutoResponseManagerProps {
  companyId: number;
}

export function AutoResponseManager({ companyId }: AutoResponseManagerProps) {
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<AutoResponse | null>(null);
  const [formData, setFormData] = useState<Partial<AutoResponse>>({
    name: '',
    keywords: [],
    response_message: '',
    match_type: 'contains',
    case_sensitive: false,
    is_active: true,
    priority: 0,
  });
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    fetchResponses();
  }, [companyId]);

  async function fetchResponses() {
    setLoading(true);
    try {
      const res = await fetch(`/api/automation/auto-responses?companyId=${companyId}`);
      const data = await res.json();

      if (data.success) {
        setResponses(data.responses);
      } else {
        toast.error('Erro ao carregar auto-respostas');
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      toast.error('Erro ao carregar auto-respostas');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.name || !formData.keywords?.length || !formData.response_message) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const method = editingResponse ? 'PUT' : 'POST';
      const url = editingResponse
        ? `/api/automation/auto-responses/${editingResponse.id}`
        : '/api/automation/auto-responses';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...formData }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          editingResponse
            ? 'Auto-resposta atualizada com sucesso'
            : 'Auto-resposta criada com sucesso'
        );
        setDialogOpen(false);
        resetForm();
        fetchResponses();
      } else {
        toast.error('Erro ao salvar auto-resposta');
      }
    } catch (error) {
      console.error('Error saving response:', error);
      toast.error('Erro ao salvar auto-resposta');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deseja realmente excluir esta auto-resposta?')) return;

    try {
      const res = await fetch(
        `/api/automation/auto-responses/${id}?companyId=${companyId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (data.success) {
        toast.success('Auto-resposta excluída com sucesso');
        fetchResponses();
      } else {
        toast.error('Erro ao excluir auto-resposta');
      }
    } catch (error) {
      console.error('Error deleting response:', error);
      toast.error('Erro ao excluir auto-resposta');
    }
  }

  function handleEdit(response: AutoResponse) {
    setEditingResponse(response);
    setFormData({
      name: response.name,
      keywords: response.keywords,
      response_message: response.response_message,
      match_type: response.match_type,
      case_sensitive: response.case_sensitive,
      is_active: response.is_active,
      priority: response.priority,
    });
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingResponse(null);
    setFormData({
      name: '',
      keywords: [],
      response_message: '',
      match_type: 'contains',
      case_sensitive: false,
      is_active: true,
      priority: 0,
    });
    setKeywordInput('');
  }

  function addKeyword() {
    if (!keywordInput.trim()) return;

    const keywords = formData.keywords || [];
    if (!keywords.includes(keywordInput.trim())) {
      setFormData({ ...formData, keywords: [...keywords, keywordInput.trim()] });
      setKeywordInput('');
    }
  }

  function removeKeyword(keyword: string) {
    setFormData({
      ...formData,
      keywords: (formData.keywords || []).filter((k) => k !== keyword),
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Auto-Respostas por Palavra-Chave</h3>
          <p className="text-sm text-muted-foreground">
            Configure respostas automáticas baseadas em palavras-chave
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Auto-Resposta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingResponse ? 'Editar' : 'Nova'} Auto-Resposta
              </DialogTitle>
              <DialogDescription>
                Configure uma resposta automática baseada em palavras-chave
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Saudação, Horário, Preços..."
                />
              </div>

              <div>
                <Label>Palavras-Chave</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="Digite uma palavra-chave e pressione Enter"
                  />
                  <Button type="button" onClick={addKeyword} variant="outline">
                    Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(formData.keywords || []).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="cursor-pointer">
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="ml-2 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Mensagem de Resposta</Label>
                <Textarea
                  value={formData.response_message}
                  onChange={(e) =>
                    setFormData({ ...formData, response_message: e.target.value })
                  }
                  placeholder="Digite a mensagem que será enviada automaticamente..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Correspondência</Label>
                  <select
                    className="w-full mt-2 p-2 border rounded-md"
                    value={formData.match_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        match_type: e.target.value as any,
                      })
                    }
                  >
                    <option value="contains">Contém</option>
                    <option value="exact">Exato</option>
                    <option value="starts_with">Começa com</option>
                    <option value="ends_with">Termina com</option>
                  </select>
                </div>

                <div>
                  <Label>Prioridade (0-10)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.case_sensitive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, case_sensitive: checked })
                    }
                  />
                  <Label>Diferenciar maiúsculas/minúsculas</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label>Ativo</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Responses List */}
      <div className="grid gap-4">
        {responses.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Nenhuma auto-resposta configurada</p>
            </CardContent>
          </Card>
        ) : (
          responses.map((response) => (
            <Card key={response.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{response.name}</CardTitle>
                      {!response.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                      {response.priority > 0 && (
                        <Badge variant="outline">Prioridade: {response.priority}</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {response.keywords.length} palavra
                      {response.keywords.length !== 1 ? 's' : ''}-chave •{' '}
                      {response.trigger_count || 0} uso
                      {response.trigger_count !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(response)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => response.id && handleDelete(response.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Palavras-chave:</p>
                  <div className="flex flex-wrap gap-1">
                    {response.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Resposta:</p>
                  <p className="text-sm text-muted-foreground">
                    {response.response_message}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Tipo: {response.match_type}</span>
                  {response.case_sensitive && <span>Case-sensitive</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
