'use client';

import { useState, useRef, useEffect } from 'react';
import { Reply, Copy, Forward, Pin, Trash2, Pencil, ChevronDown, MapPin, MoreHorizontal } from 'lucide-react';

interface MessageContextMenuProps {
  children: React.ReactNode;
  isOutbound?: boolean;
  className?: string;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onForward?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageContextMenu({
  children,
  isOutbound = false,
  className = '',
  onReact,
  onReply,
  onCopy,
  onEdit,
  onForward,
  onPin,
  onDelete,
}: MessageContextMenuProps) {
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const menuItems = [
    onReply   && { icon: <Reply className="h-4 w-4" />,   label: 'Responder',           action: onReply },
    onCopy    && { icon: <Copy className="h-4 w-4" />,    label: 'Copiar',               action: onCopy },
    onForward && { icon: <Forward className="h-4 w-4" />, label: 'Encaminhar',           action: onForward },
    onPin     && { icon: <Pin className="h-4 w-4" />,     label: 'Fixar',               action: onPin },
    onEdit    && { icon: <Pencil className="h-4 w-4" />,  label: 'Editar',              action: onEdit },
    onDelete  && { icon: <Trash2 className="h-4 w-4 text-destructive" />, label: 'Apagar para todos', action: onDelete, destructive: true },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; action: () => void; destructive?: boolean }[];

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => {
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        setHovered(true);
      }}
      onMouseLeave={() => {
        hideTimer.current = setTimeout(() => { setHovered(false); }, 300);
      }}
    >
      {children}

      {/* Hover toolbar — aparece acima do balão, alinhado à direita (outbound) ou esquerda (inbound) */}
      {(hovered || dropdownOpen) && (
        <div
          className={`absolute bottom-full pb-1 flex items-center gap-1 z-20 ${
            isOutbound ? 'right-0' : 'left-0'
          }`}
        >
          {/* Quick reactions */}
          {onReact && (
            <div className="flex items-center bg-background border border-border rounded-full shadow-md px-1 py-0.5 gap-0.5">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact(emoji); setHovered(false); }}
                  className="text-base hover:scale-125 transition-transform px-0.5 leading-none"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Dropdown trigger */}
          {menuItems.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(o => !o); }}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border shadow-md hover:bg-accent transition-colors"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {dropdownOpen && (
                <div
                  className={`absolute bottom-full pb-1 z-30 bg-background border border-border rounded-lg shadow-xl min-w-[180px] py-1 ${
                    isOutbound ? 'right-0' : 'left-0'
                  }`}
                >
                  {menuItems.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { item.action(); setDropdownOpen(false); setHovered(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent transition-colors text-left ${
                        item.destructive ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
