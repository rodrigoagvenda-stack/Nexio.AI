"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-6 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-base font-semibold",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-8 w-8 bg-transparent p-0 hover:bg-accent rounded-md transition-colors inline-flex items-center justify-center"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell: "text-muted-foreground w-10 font-medium text-sm text-center",
        row: "flex w-full mt-1",
        cell: "relative p-0 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
        day: cn(
          "h-10 w-10 p-0 font-normal hover:bg-accent hover:text-accent-foreground rounded-md transition-colors inline-flex items-center justify-center"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground font-semibold",
        day_outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-30",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
