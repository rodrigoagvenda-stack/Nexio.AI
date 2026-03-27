import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Lucide icon component */
  icon: React.ElementType
  title: string
  description?: string
  /** Optional count/label badge rendered next to the title */
  badge?: number | string
  /** Action buttons rendered on the right side */
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      {/* Left side: icon + text */}
      <div className="flex items-start gap-3">
        {/* Colored icon box */}
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        {/* Title + optional description */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight leading-none">
              {title}
            </h1>
            {badge !== undefined && (
              <Badge
                variant="secondary"
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
              >
                {badge}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* Right side: action buttons slot */}
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  )
}
