'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, X, Edit2, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Tag, LeadTag } from '@/types/database.types';

interface TagsManagerProps {
  leadId: number;
  companyId: number;
  currentTags?: string[]; // Array of tag names from conversation
  onTagsUpdate?: (tags: string[]) => void;
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#30184C', // roxo Nexio
  '#462068', // roxo Nexio claro
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export function TagsManager({
  leadId,
  companyId,
  currentTags = [],
  onTagsUpdate,
}: TagsManagerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [leadTags, setLeadTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    fetchAllTags();
    fetchLeadTags();
  }, [leadId]);

  async function fetchAllTags() {
    try {
      const response = await fetch(`/api/tags?companyId=${companyId}`);
      const data = await response.json();
      if (data.success) {
        setAllTags(data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  async function fetchLeadTags() {
    // Note: We'll need to create an endpoint to fetch lead tags
    // For now, use the currentTags prop
    // In a future enhancement, we can add GET /api/leads/[leadId]/tags
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      toast.error('Digite o nome da tag');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          tagName: newTagName,
          tagColor: newTagColor,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setAllTags((prev) => [...prev, data.data]);
      setNewTagName('');
      setNewTagColor(DEFAULT_COLORS[0]);
      setShowNewTagForm(false);
      toast.success('Tag criada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar tag');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignTag(tag: Tag) {
    setLoading(true);
    try {
      const response = await fetch('/api/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          tagId: tag.id,
          companyId,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Update local state
      const updatedTags = [...currentTags, tag.tag_name];
      if (onTagsUpdate) onTagsUpdate(updatedTags);

      toast.success('Tag atribuída!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atribuir tag');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveTag(tag: Tag) {
    setLoading(true);
    try {
      const response = await fetch('/api/tags/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          tagId: tag.id,
          companyId,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // Update local state
      const updatedTags = currentTags.filter((t) => t !== tag.tag_name);
      if (onTagsUpdate) onTagsUpdate(updatedTags);

      toast.success('Tag removida!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover tag');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTag(tagId: number) {
    if (!confirm('Deseja realmente deletar esta tag? Ela será removida de todos os leads.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/tags/${tagId}?companyId=${companyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setAllTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success('Tag deletada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar tag');
    } finally {
      setLoading(false);
    }
  }

  const assignedTagNames = currentTags;
  const availableTags = allTags.filter((tag) => !assignedTagNames.includes(tag.tag_name));
  const assignedTags = allTags.filter((tag) => assignedTagNames.includes(tag.tag_name));

  return (
    <div className="space-y-4">
      {/* Tags Atribuídas */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Tags do Lead</Label>
        {assignedTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tag atribuída</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
                style={{ backgroundColor: `${tag.tag_color}20`, color: tag.tag_color, borderColor: tag.tag_color }}
              >
                {tag.tag_name}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  disabled={loading}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tags Disponíveis */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Tags Disponíveis</Label>
        {availableTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas as tags estão atribuídas</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:opacity-80"
                  style={{ borderColor: tag.tag_color, color: tag.tag_color }}
                  onClick={() => handleAssignTag(tag)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {tag.tag_name}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  onClick={() => handleDeleteTag(tag.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Criar Nova Tag */}
      {showNewTagForm ? (
        <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Nome da Tag</Label>
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Ex: VIP, Urgente, Follow-up..."
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs mb-2 block">Cor</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {newTagColor === color && (
                    <Check className="h-3 w-3 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateTag} disabled={loading || !newTagName.trim()}>
              Criar Tag
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewTagForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowNewTagForm(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          Nova Tag
        </Button>
      )}
    </div>
  );
}
