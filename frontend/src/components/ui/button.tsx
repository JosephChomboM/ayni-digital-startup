import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ")
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#2c5f7c] text-white hover:bg-[#224a61] shadow-sm",
        outline: "border-gray-300 bg-white text-[#264653] hover:bg-gray-50",
        secondary: "bg-[#e76f51] text-white hover:bg-[#d65d3f] shadow-sm",
        ghost: "hover:bg-gray-100 text-[#264653]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        link: "text-[#2c5f7c] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-xs",
        xs: "h-7 px-2.5 text-[11px] rounded-lg",
        sm: "h-8 px-3 text-xs rounded-lg",
        lg: "h-12 px-6 text-sm font-bold rounded-2xl",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
