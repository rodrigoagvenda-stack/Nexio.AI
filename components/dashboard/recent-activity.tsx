"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  UserPlus,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare
} from "lucide-react"

export function RecentActivity() {
  // Mock data - você pode buscar do banco depois
  const activities = [
    {
      id: 1,
      type: "member",
      icon: UserPlus,
      title: "Novo membro cadastrado",
      description: "Maria Silva foi adicionada ao sistema",
      time: "2 horas atrás",
      color: "text-primary"
    },
    {
      id: 2,
      type: "financial",
      icon: DollarSign,
      title: "Dízimo registrado",
      description: "R$ 500,00 - João Santos",
      time: "5 horas atrás",
      color: "text-[#8a8345]"
    },
    {
      id: 3,
      type: "event",
      icon: Calendar,
      title: "Evento criado",
      description: "Escola Bíblica - 16 Jan 2026",
      time: "1 dia atrás",
      color: "text-blue-600"
    },
    {
      id: 4,
      type: "schedule",
      icon: FileText,
      title: "Escala gerada",
      description: "Escala de Janeiro enviada",
      time: "2 dias atrás",
      color: "text-accent"
    },
    {
      id: 5,
      type: "message",
      icon: MessageSquare,
      title: "Mensagem enviada",
      description: "Lembrete enviado para 50 membros",
      time: "3 dias atrás",
      color: "text-purple-600"
    }
  ]

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle>Atividades Recentes</CardTitle>
        <CardDescription>Últimas ações realizadas no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0`}>
                <activity.icon className={`h-4 w-4 ${activity.color}`} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">{activity.title}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
