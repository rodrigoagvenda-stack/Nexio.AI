"use client"

import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description: string
  trend?: "up" | "down" | "neutral"
  gradient?: "primary" | "success" | "orange" | "info"
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend = "neutral",
  gradient = "primary"
}: StatsCardProps) {
  const gradients = {
    primary: "from-primary/10 to-primary/5",
    success: "from-[#C1BC7A]/10 to-[#C1BC7A]/5",
    orange: "from-accent/10 to-accent/5",
    info: "from-blue-500/10 to-blue-500/5"
  }

  const iconColors = {
    primary: "text-primary",
    success: "text-[#8a8345]",
    orange: "text-accent",
    info: "text-blue-600"
  }

  const trendColors = {
    up: "text-[#8a8345]",
    down: "text-red-600",
    neutral: "text-muted-foreground"
  }

  return (
    <Card className="stat-card group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn(
            "p-2.5 rounded-lg bg-gradient-to-br transition-transform group-hover:scale-110",
            gradients[gradient]
          )}>
            <Icon className={cn("h-5 w-5", iconColors[gradient])} />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-bold tracking-tight mb-1">{value}</h3>
          <p className={cn("text-xs font-medium", trendColors[trend])}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
