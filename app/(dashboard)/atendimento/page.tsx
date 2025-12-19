'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Clock } from 'lucide-react';

export default function AtendimentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Atendimento WhatsApp</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas conversas em tempo real
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Chat em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Clock className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              O módulo de atendimento WhatsApp será implementado em breve.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Aqui você poderá visualizar e responder mensagens em tempo real,
              ver informações dos leads e gerenciar conversas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
