import * as React from "react"
import { cn } from "@/lib/utils/cn"

export interface OrbitCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient?: string
  blur?: boolean
}

const OrbitCard = React.forwardRef<HTMLDivElement, OrbitCardProps>(
  ({ className, gradient, blur = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]",
          blur && "backdrop-blur-xl",
          className
        )}
        {...props}
      >
        {gradient && (
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", gradient)} />
        )}
        <div className="relative">{children}</div>
      </div>
    )
  }
)
OrbitCard.displayName = "OrbitCard"

const OrbitCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 border-b border-white/[0.08]", className)}
    {...props}
  />
))
OrbitCardHeader.displayName = "OrbitCardHeader"

const OrbitCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
OrbitCardTitle.displayName = "OrbitCardTitle"

const OrbitCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
OrbitCardDescription.displayName = "OrbitCardDescription"

const OrbitCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6", className)} {...props} />
))
OrbitCardContent.displayName = "OrbitCardContent"

const OrbitCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  />
))
OrbitCardFooter.displayName = "OrbitCardFooter"

export { OrbitCard, OrbitCardHeader, OrbitCardFooter, OrbitCardTitle, OrbitCardDescription, OrbitCardContent }
