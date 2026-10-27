import * as React from "react"

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ")
}

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      data-slot="progress"
      className={cn("relative w-full overflow-hidden rounded-full bg-gray-100 border border-gray-200 h-2.5", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-[#2c5f7c] transition-all duration-300 ease-in-out rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function ProgressLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="progress-label"
      className={cn("text-xs font-semibold text-[#264653]", className)}
      {...props}
    />
  )
}

function ProgressValue({ className, value, ...props }: React.HTMLAttributes<HTMLSpanElement> & { value?: number }) {
  return (
    <span
      data-slot="progress-value"
      className={cn("ml-auto text-xs font-mono font-bold text-[#2c5f7c]", className)}
      {...props}
    >
      {props.children ?? `${value ?? 0}%`}
    </span>
  )
}

export {
  Progress,
  ProgressLabel,
  ProgressValue,
}
