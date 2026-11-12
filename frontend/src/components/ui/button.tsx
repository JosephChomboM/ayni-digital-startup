import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ")
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#235c50] select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#235c50] text-white hover:bg-[#194b40] shadow-xs",
        outline: "border-gray-300 bg-white text-[#223e38] hover:bg-gray-50",
        secondary: "bg-[#b94c35] text-white hover:bg-[#9e3f2c] shadow-xs",
        ghost: "hover:bg-gray-100 text-[#223e38]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        link: "text-[#235c50] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2 text-sm",
        xs: "min-h-11 px-3 text-sm rounded-lg",
        sm: "min-h-11 px-3 text-sm rounded-lg",
        lg: "h-12 px-6 text-sm font-bold rounded-2xl",
        icon: "size-11 rounded-xl",
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
