"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface UpcomingEventsProps {
  igrejaId: string
}

export function UpcomingEvents({ igrejaId }: UpcomingEventsProps) {
  // Mock data - você pode buscar do banco depois
  const events = [
    {
      id: 1,
      title: "Culto de Domingo",
      date: "15 Jan 2026",
      time: "19:00",
      location: "Templo Principal",
      type: "Culto"
    },
    {
      id: 2,
      title: "Escola Bíblica",
      date: "16 Jan 2026",
      time: "14:00",
      location: "Sala 1",
      type: "Estudo"
    },
    {
      id: 3,
      title: "Reunião de Oração",
      date: "17 Jan 2026",
      time: "20:00",
      location: "Templo Principal",
      type: "Oração"
    }
  ]

  const typeColors: Record<string, string> = {
    "Culto": "bg-primary/10 text-primary",
    "Estudo": "bg-blue-500/10 text-blue-600",
    "Oração": "bg-purple-500/10 text-purple-600"
  }

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle>Próximos Eventos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{event.title}</p>
                  <Badge className={typeColors[event.type]} variant="secondary">
                    {event.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {event.date}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
