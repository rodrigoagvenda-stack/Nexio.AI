'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pin, Trash2, Edit2, Save, X, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils/format';
import type { ChatNote } from '@/types/database.types';

interface ChatNotesTabProps {
  leadId: number;
  companyId: number;
  userId: string;
  aiSummary?: string | null;
  resumoIa?: string | null;
  isOutbound?: boolean;
}

export function ChatNotesTab({ leadId, companyId, userId, aiSummary, resumoIa, isOutbound = false }: ChatNotesTabProps) {
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    fetchNotes();
  }, [leadId]);

  async function fetchNotes() {
    try {
      const response = await fetch(
        `/api/chat-notes?companyId=${companyId}&leadId=${leadId}`
      );
      const data = await response.json();
      if (data.success) {
        setNotes(data.data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  }

  async function handleCreateNote() {
    if (!newNoteText.trim()) {
      toast({ title: 'Digite o texto da nota', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chat-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          leadId,
          userId,
          noteText: newNoteText,
          isPinned: false,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setNotes((prev) => [data.data, ...prev]);
      setNewNoteText('');
      toast({ title: 'Nota adicionada!' });
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao criar nota', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateNote(
    noteId: number,
    updates: { noteText?: string; isPinned?: boolean }
  ) {
    setLoading(true);
    try {
      const response = await fetch(`/api/chat-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...updates,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setNotes((prev) =>
        prev.map((note) => (note.id === noteId ? data.data : note))
      );
      setEditingNoteId(null);
      toast({ title: 'Nota atualizada!' });
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao atualizar nota', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm('Deseja realmente deletar esta nota?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/chat-notes/${noteId}?companyId=${companyId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      toast({ title: 'Nota deletada!' });
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao deletar nota', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleTogglePin(note: ChatNote) {
    handleUpdateNote(note.id, { isPinned: !note.is_pinned });
  }

  function startEditing(note: ChatNote) {
    setEditingNoteId(note.id);
    setEditingText(note.note_text);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setEditingText('');
  }

  function saveEditing(noteId: number) {
    handleUpdateNote(noteId, { noteText: editingText });
  }

  // Lead Outbound: exibe apenas Observação MQL (read-only), sem notas manuais
  if (isOutbound) {
    return (
      <div className="space-y-4">
        <div className="relative p-4 rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
              Observação MQL
            </h3>
            <Badge variant="secondary" className="ml-auto text-xs">
              Gerado pela IA
            </Badge>
          </div>
          {aiSummary ? (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {aiSummary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              A IA ainda não gerou uma observação para este lead.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nova Nota */}
      <div className="space-y-2">
        <Textarea
          placeholder="Adicionar uma nota sobre este lead..."
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          className="min-h-[80px] resize-none"
          disabled={loading}
        />
        <Button
          onClick={handleCreateNote}
          disabled={loading || !newNoteText.trim()}
          size="sm"
          className="w-full"
        >
          Adicionar Nota
        </Button>
      </div>

      <Separator />

      {/* Lista de Notas */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma nota adicionada ainda
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`p-3 rounded-lg border ${
                note.is_pinned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
              }`}
            >
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveEditing(note.id)}
                      disabled={loading}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-primary">
                        {note.user?.name || 'Usuário'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleTogglePin(note)}
                        disabled={loading}
                      >
                        <Pin
                          className={`h-3 w-3 ${
                            note.is_pinned ? 'fill-current text-primary' : ''
                          }`}
                        />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEditing(note)}
                        disabled={loading}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                  {note.is_pinned && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Fixada
                    </Badge>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Resumo da IA */}
      {resumoIa && (
        <>
          <Separator />
          <div className="relative p-4 rounded-lg bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Resumo da IA
              </h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                Gerado pela IA
              </Badge>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {resumoIa}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
