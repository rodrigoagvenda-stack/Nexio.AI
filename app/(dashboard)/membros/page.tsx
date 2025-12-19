'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Clock } from 'lucide-react';

export default function MembrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Membros da Equipe</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie os membros da sua empresa
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Gestão de Membros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Clock className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              O módulo de gestão de membros será implementado em breve.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Aqui você poderá convidar membros, gerenciar permissões e visualizar
              a atividade da equipe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
