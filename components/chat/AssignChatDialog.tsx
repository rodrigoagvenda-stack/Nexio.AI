'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCircle, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  stats: {
    totalChats: number;
    activeChats: number;
    unreadChats: number;
  };
}

interface AssignChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: number;
  chatName: string;
  currentAssignedTo?: number | null;
  companyId: number;
  userId: number;
  onSuccess: () => void;
}

export function AssignChatDialog({
  open,
  onOpenChange,
  chatId,
  chatName,
  currentAssignedTo,
  companyId,
  userId,
  onSuccess,
}: AssignChatDialogProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    if (open) {
      fetchTeam();
    }
  }, [open, companyId]);

  async function fetchTeam() {
    setLoadingTeam(true);
    try {
      const response = await fetch(`/api/chats/team?companyId=${companyId}`);
      const data = await response.json();

      if (data.success) {
        setTeam(data.team);
      } else {
        toast({ title: 'Erro ao carregar equipe', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({ title: 'Erro ao carregar equipe', variant: 'destructive' });
    } finally {
      setLoadingTeam(false);
    }
  }

  async function handleAssign() {
    if (!selectedUser) {
      toast({ title: 'Selecione um membro da equipe', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chats/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          assignedTo: parseInt(selectedUser),
          assignedBy: userId,
          companyId,
          notes: notes.trim() || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: data.message });
        onSuccess();
        onOpenChange(false);
        setSelectedUser('');
        setNotes('');
      } else {
        toast({ title: data.message || 'Erro ao atribuir chat', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error assigning chat:', error);
      toast({ title: 'Erro ao atribuir chat', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUnassign() {
    if (!confirm('Deseja realmente desatribuir este chat?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/chats/assign?chatId=${chatId}&userId=${userId}&companyId=${companyId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Chat desatribuído com sucesso' });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({ title: data.message || 'Erro ao desatribuir chat', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error unassigning chat:', error);
      toast({ title: 'Erro ao desatribuir chat', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentAssignedTo ? 'Transferir Atendimento' : 'Atribuir Atendimento'}
          </DialogTitle>
          <DialogDescription>
            Chat: {chatName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Atribuição Atual */}
          {currentAssignedTo && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Atribuído atualmente para:</p>
                <p className="text-sm text-muted-foreground">
                  {team.find(m => m.id === currentAssignedTo)?.name || 'Carregando...'}
                </p>
              </div>
            </div>
          )}

          {/* Seleção de Membro */}
          <div className="space-y-2">
            <Label htmlFor="user">
              {currentAssignedTo ? 'Transferir para:' : 'Atribuir para:'}
            </Label>
            <Select value={selectedUser} onValueChange={setSelectedUser} disabled={loadingTeam}>
              <SelectTrigger>
                <SelectValue placeholder={loadingTeam ? 'Carregando...' : 'Selecione um membro'} />
              </SelectTrigger>
              <SelectContent>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{member.name}</span>
                      <div className="flex gap-1 ml-4">
                        <Badge variant="outline" className="text-xs">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {member.stats.activeChats}
                        </Badge>
                        {member.stats.unreadChats > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {member.stats.unreadChats}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os badges mostram: chats ativos • mensagens não lidas
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da transferência/atribuição..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentAssignedTo && (
            <Button
              variant="outline"
              onClick={handleUnassign}
              disabled={loading}
              className="sm:mr-auto"
            >
              Desatribuir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={loading || !selectedUser}>
            {loading ? 'Salvando...' : currentAssignedTo ? 'Transferir' : 'Atribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
