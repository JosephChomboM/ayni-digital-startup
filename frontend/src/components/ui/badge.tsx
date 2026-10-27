import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ")
}

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#2c5f7c] text-white hover:bg-[#2c5f7c]/80",
        secondary:
          "border-transparent bg-[#e76f51] text-white hover:bg-[#e76f51]/80",
        destructive:
          "border-transparent bg-red-600 text-white hover:bg-red-600/80",
        outline: "text-[#264653] border-gray-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
