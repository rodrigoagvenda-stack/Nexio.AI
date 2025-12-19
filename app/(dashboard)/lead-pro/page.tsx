'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Clock } from 'lucide-react';

export default function LeadProPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Lead PRO - VendAgro</h1>
        <p className="text-muted-foreground mt-1">
          Leads qualificados baseados no seu ICP
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Leads Qualificados ICP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Clock className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              O módulo Lead PRO será implementado em breve.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Aqui você receberá leads qualificados baseados no ICP configurado
              pelo admin, com limite mensal de extração.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
