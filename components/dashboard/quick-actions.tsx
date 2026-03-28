"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  UserPlus,
  Calendar,
  DollarSign,
  MessageSquare,
  FileText,
  Users
} from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  const actions = [
    {
      title: "Novo Membro",
      icon: UserPlus,
      href: "/membros/novo",
      color: "text-primary"
    },
    {
      title: "Criar Evento",
      icon: Calendar,
      href: "/eventos/novo",
      color: "text-accent"
    },
    {
      title: "Lançamento",
      icon: DollarSign,
      href: "/financeiro/lancamentos/novo",
      color: "text-[#8a8345]"
    },
    {
      title: "Gerar Escala",
      icon: FileText,
      href: "/escalas/nova",
      color: "text-blue-600"
    },
    {
      title: "Enviar Mensagem",
      icon: MessageSquare,
      href: "/comunicacao",
      color: "text-purple-600"
    },
    {
      title: "Frequência",
      icon: Users,
      href: "/frequencia",
      color: "text-orange-600"
    }
  ]

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle>Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Button
                variant="outline"
                className="w-full h-auto flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/50 transition-all"
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium">{action.title}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
