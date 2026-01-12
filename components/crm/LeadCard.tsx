'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, DollarSign, Building2, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { motion } from 'framer-motion';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  project_value: number;
  status: string;
  priority?: string;
}

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  'Lead novo': 'bg-blue-500',
  'Em contato': 'bg-purple-400',
  'Interessado': 'bg-primary',
  'Proposta enviada': 'bg-purple-600',
  'Fechado': 'bg-zinc-700',
  'Perdido': 'bg-red-500',
};

const priorityColors: Record<string, string> = {
  'Alta': 'destructive',
  'Média': 'secondary',
  'Baixa': 'outline',
};

export function LeadCard({ lead, onEdit, onDelete }: LeadCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-base">{lead.name}</h3>
              </div>
              <div
                className={`inline-block mt-2 h-1 w-12 rounded-full ${
                  statusColors[lead.status] || 'bg-gray-500'
                }`}
              />
            </div>
            {lead.priority && (
              <Badge variant={priorityColors[lead.priority] as any}>
                {lead.priority}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Contact Info */}
          <div className="space-y-2 text-sm">
            {lead.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{lead.company}</span>
              </div>
            )}
          </div>

          {/* Value */}
          {lead.project_value > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">
                {formatCurrency(lead.project_value)}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(lead)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => onDelete(lead.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
