'use client';

import { useState } from 'react';
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
  ChevronDown,
  Pencil,
} from 'lucide-react';

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
  onFavorite?: () => void;
  onSelect?: () => void;
  onReport?: () => void;
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
  onFavorite,
  onSelect,
  onReport,
  onDelete,
}: MessageContextMenuProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
}
