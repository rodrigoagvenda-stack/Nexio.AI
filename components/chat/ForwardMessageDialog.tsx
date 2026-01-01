'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Conversation {
  id: number;
  nome_do_contato: string;
  numero_de_telefone: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  onForward: (selectedIds: number[]) => void;
  isLoading?: boolean;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  conversations,
  onForward,
  isLoading = false,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.nome_do_contato?.toLowerCase().includes(search.toLowerCase()) ||
      conv.numero_de_telefone.includes(search)
  );

  const handleToggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleForward = () => {
    onForward(selected);
    setSelected([]);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
          <DialogDescription>
            Selecione os contatos para encaminhar esta mensagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista de contatos */}
          <div className="h-[300px] rounded-md border p-2 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum contato encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                    onClick={() => handleToggle(conv.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(conv.id)}
                      onChange={() => handleToggle(conv.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.nome_do_contato || conv.numero_de_telefone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conv.numero_de_telefone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleForward}
            disabled={selected.length === 0 || isLoading}
            className="bg-[#005c4b] hover:bg-[#004d3d]"
          >
            {isLoading ? 'Encaminhando...' : `Encaminhar (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
