import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import React from "react"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success-500 text-white",
        warning: "border-transparent bg-warning-500 text-white",
        danger: "border-transparent bg-destructive text-white",
        outline: "border-border",
        ghost: "border-transparent bg-muted text-muted-foreground",
      },
      isGradient: {
        true: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        isGradient: true,
        class: "border-transparent bg-jade-100 text-jade-800",
      },
      {
        variant: "success",
        isGradient: true,
        class: "border-transparent bg-success-50 text-success-700",
      },
      {
        variant: "warning",
        isGradient: true,
        class: "border-transparent bg-warning-50 text-warning-700",
      },
      {
        variant: "danger",
        isGradient: true,
        class: "border-transparent bg-red-50 text-red-700",
      },
    ],
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, isGradient, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, isGradient, className }))} {...props} />
  )
}

export { Badge, badgeVariants } 