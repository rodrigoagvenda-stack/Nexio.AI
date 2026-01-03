'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Zap } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  content: string;
  shortcut: string | null;
  category: string;
  usage_count: number;
}

interface QuickReplyMenuProps {
  companyId: number;
  searchQuery: string; // O que o usuário digitou (ex: "/oi" ou "/pr")
  position: { top: number; left: number };
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const categoryIcons: Record<string, string> = {
  saudacao: '👋',
  followup: '📞',
  preco: '💰',
  agendamento: '📅',
  encerramento: '✅',
  geral: '💬',
};

export function QuickReplyMenu({
  companyId,
  searchQuery,
  position,
  onSelect,
  onClose,
}: QuickReplyMenuProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, [companyId]);

  useEffect(() => {
    // Reset selected index when search query changes
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    // Handle keyboard navigation
    function handleKeyDown(e: KeyboardEvent) {
      const filtered = getFilteredTemplates();

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, searchQuery, templates]);

  async function fetchTemplates() {
    try {
      const url = new URL('/api/templates', window.location.origin);
      url.searchParams.set('companyId', companyId.toString());
      url.searchParams.set('activeOnly', 'true');

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }

  function getFilteredTemplates(): Template[] {
    const query = searchQuery.toLowerCase().replace('/', '');

    if (!query) {
      // Se digitou apenas "/", mostrar os 10 mais usados
      return templates
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 10);
    }

    // Filtrar por atalho ou nome
    return templates.filter((t) => {
      const matchesShortcut = t.shortcut?.toLowerCase().includes(`/${query}`);
      const matchesName = t.name.toLowerCase().includes(query);
      return matchesShortcut || matchesName;
    });
  }

  const filteredTemplates = getFilteredTemplates();

  if (filteredTemplates.length === 0) {
    return (
      <Card
        ref={menuRef}
        className="absolute z-50 w-96 max-h-64 overflow-y-auto shadow-lg"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="p-4 text-center text-sm text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum template encontrado</p>
          <p className="text-xs mt-1">
            Digite / para ver templates disponíveis
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={menuRef}
      className="absolute z-50 w-96 max-h-80 overflow-y-auto shadow-lg scrollbar-minimal"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>Respostas Rápidas</span>
          <span className="ml-auto">
            ↑↓ Navegar • Enter Selecionar • Esc Fechar
          </span>
        </div>
      </div>

      <div className="p-1">
        {filteredTemplates.map((template, index) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`w-full text-left p-3 rounded-md transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10 border border-primary'
                : 'hover:bg-accent'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">
                {categoryIcons[template.category] || '💬'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{template.name}</span>
                  {template.shortcut && (
                    <Badge variant="secondary" className="text-xs">
                      {template.shortcut}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {template.content}
                </p>
                {template.usage_count > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado {template.usage_count}x
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
