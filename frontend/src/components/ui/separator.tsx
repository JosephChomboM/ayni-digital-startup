import * as React from "react"

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ")
}

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      data-slot="separator"
      className={cn(
        "shrink-0 bg-[#2c5f7c]/15",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px] self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
