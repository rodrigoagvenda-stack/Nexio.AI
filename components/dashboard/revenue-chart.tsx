"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"

interface RevenueChartProps {
  igrejaId: string
}

export function RevenueChart({ igrejaId }: RevenueChartProps) {
  // Mock data - você pode implementar com Recharts depois
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"]
  const revenue = [4500, 5200, 4800, 6100, 5800, 6500]
  const expenses = [3200, 3800, 3500, 4200, 3900, 4100]

  const maxValue = Math.max(...revenue, ...expenses)
  const total = revenue.reduce((a, b) => a + b, 0)
  const avgRevenue = total / revenue.length

  return (
    <Card className="chart-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Receita vs Despesas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Receita</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-sm text-muted-foreground">Despesas</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Receita</p>
              <p className="text-2xl font-bold text-primary">R$ {(total / 1000).toFixed(1)}k</p>
              <div className="flex items-center gap-1 text-xs text-[#8a8345] mt-1">
                <TrendingUp className="h-3 w-3" />
                +12.5%
              </div>
            </div>
            <div className="rounded-lg bg-accent/5 p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Despesas</p>
              <p className="text-2xl font-bold text-accent">
                R$ {(expenses.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}k
              </p>
              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                <TrendingUp className="h-3 w-3" />
                +8.2%
              </div>
            </div>
            <div className="rounded-lg bg-[#C1BC7A]/5 p-4">
              <p className="text-sm text-muted-foreground mb-1">Saldo</p>
              <p className="text-2xl font-bold text-[#8a8345]">
                R$ {((total - expenses.reduce((a, b) => a + b, 0)) / 1000).toFixed(1)}k
              </p>
              <div className="flex items-center gap-1 text-xs text-[#8a8345] mt-1">
                <TrendingUp className="h-3 w-3" />
                +18.3%
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="space-y-2">
            {months.map((month, index) => (
              <div key={month} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground w-8">{month}</span>
                  <div className="flex-1 mx-4 flex gap-1">
                    <div
                      className="bg-primary/80 rounded-sm transition-all hover:bg-primary"
                      style={{ width: `${(revenue[index] / maxValue) * 100}%`, height: '32px' }}
                    />
                    <div
                      className="bg-accent/80 rounded-sm transition-all hover:bg-accent"
                      style={{ width: `${(expenses[index] / maxValue) * 100}%`, height: '32px' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    R$ {(revenue[index] / 1000).toFixed(1)}k
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
