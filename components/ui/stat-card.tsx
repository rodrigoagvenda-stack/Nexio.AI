import Link from "next/link"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  /** e.g. { value: 12, label: "vs. mês anterior" } — positive = up, negative = down */
  trend?: { value: number; label: string }
  /** When provided the whole card becomes a link */
  href?: string
  /** Tailwind text color class for the icon, e.g. "text-emerald-600" */
  iconColor?: string
  /** Tailwind bg color class for the icon box, e.g. "bg-emerald-50" */
  iconBg?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  href,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
}: StatCardProps) {
  const isUp = trend && trend.value >= 0

  const content = (
    <CardContent className="p-5">
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <div
          className={cn(
            "rounded-lg h-9 w-9 flex items-center justify-center shrink-0",
            iconBg
          )}
        >
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>

      {/* Value */}
      <p className="text-3xl font-bold mt-3 tracking-tight">{value}</p>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}

      {/* Trend badge */}
      {trend && (
        <div
          className={cn(
            "inline-flex items-center gap-1 mt-3 text-xs font-semibold px-2 py-0.5 rounded-full",
            isUp
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
          )}
        >
          {isUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>
            {isUp ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        </div>
      )}
    </CardContent>
  )

  if (href) {
    return (
      <Card className="hover:shadow-md transition-all cursor-pointer group">
        <Link href={href} className="block">
          {content}
        </Link>
      </Card>
    )
  }

  return <Card>{content}</Card>
}
