'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Reply,
  Copy,
  Forward,
  Pin,
  Star,
  CheckSquare,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

interface MessageContextMenuProps {
  children: React.ReactNode;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onPin?: () => void;
  onFavorite?: () => void;
  onSelect?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageContextMenu({
  children,
  onReact,
  onReply,
  onCopy,
  onForward,
  onPin,
  onFavorite,
  onSelect,
  onReport,
  onDelete,
}: MessageContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 p-1 bg-popover/95 backdrop-blur-sm border-border/50"
      >
        {/* Reações rápidas */}
        {onReact && (
          <>
            <div className="flex items-center justify-between px-3 py-2">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                  title={`Reagir com ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => {/* TODO: abrir seletor de emoji */}}
                className="text-lg text-muted-foreground hover:text-foreground transition-colors"
                title="Mais reações"
              >
                +
              </button>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Ações */}
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Responder
          </DropdownMenuItem>
        )}

        {onCopy && (
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </DropdownMenuItem>
        )}

        {onForward && (
          <DropdownMenuItem onClick={onForward}>
            <Forward className="h-4 w-4 mr-2" />
            Encaminhar
          </DropdownMenuItem>
        )}

        {onPin && (
          <DropdownMenuItem onClick={onPin}>
            <Pin className="h-4 w-4 mr-2" />
            Fixar
          </DropdownMenuItem>
        )}

        {onFavorite && (
          <DropdownMenuItem onClick={onFavorite}>
            <Star className="h-4 w-4 mr-2" />
            Favoritar
          </DropdownMenuItem>
        )}

        {onSelect && (
          <DropdownMenuItem onClick={onSelect}>
            <CheckSquare className="h-4 w-4 mr-2" />
            Selecionar
          </DropdownMenuItem>
        )}

        {(onReport || onDelete) && <DropdownMenuSeparator />}

        {onReport && (
          <DropdownMenuItem onClick={onReport}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Denunciar
          </DropdownMenuItem>
        )}

        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Apagar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
