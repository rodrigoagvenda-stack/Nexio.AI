'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Clock, Zap } from 'lucide-react';
import { AutomationMessages } from './AutomationMessages';
import { BusinessHoursConfig } from './BusinessHoursConfig';
import { AutoResponseManager } from './AutoResponseManager';

interface AutomationDashboardProps {
  companyId: number;
}

export function AutomationDashboard({ companyId }: AutomationDashboardProps) {
  return (
    <Tabs defaultValue="messages" className="space-y-4">
      <TabsList>
        <TabsTrigger value="messages">
          <MessageSquare className="h-4 w-4 mr-2" />
          Mensagens Automáticas
        </TabsTrigger>
        <TabsTrigger value="hours">
          <Clock className="h-4 w-4 mr-2" />
          Horário de Atendimento
        </TabsTrigger>
        <TabsTrigger value="responses">
          <Zap className="h-4 w-4 mr-2" />
          Auto-Respostas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="messages" className="space-y-4">
        <AutomationMessages companyId={companyId} />
      </TabsContent>

      <TabsContent value="hours" className="space-y-4">
        <BusinessHoursConfig companyId={companyId} />
      </TabsContent>

      <TabsContent value="responses" className="space-y-4">
        <AutoResponseManager companyId={companyId} />
      </TabsContent>
    </Tabs>
  );
}
