"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/* Calcite Design System Button Style */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-semibold text-sm transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /* Calcite Solid - Primary Action */
        default: 
          "bg-[hsl(210,100%,38%)] text-white shadow-sm hover:bg-[hsl(210,100%,33%)] active:bg-[hsl(210,100%,28%)]",
        /* Calcite Outline */
        outline: 
          "border border-[hsl(210,16%,78%)] bg-white text-[hsl(210,10%,24%)] hover:bg-[hsl(210,20%,96%)] hover:border-[hsl(210,16%,68%)] active:bg-[hsl(210,20%,92%)]",
        /* Calcite Clear - For secondary actions */
        ghost: 
          "bg-transparent text-[hsl(210,10%,30%)] hover:bg-[hsl(210,20%,96%)] hover:text-[hsl(0,0%,14%)] active:bg-[hsl(210,20%,92%)]",
        /* Calcite Danger */
        destructive: 
          "bg-[hsl(0,72%,51%)] text-white hover:bg-[hsl(0,72%,46%)] active:bg-[hsl(0,72%,41%)]",
        /* Calcite Secondary */
        secondary:
          "bg-[hsl(210,20%,96%)] text-[hsl(0,0%,14%)] hover:bg-[hsl(210,20%,92%)] active:bg-[hsl(210,20%,88%)]",
      },
      size: {
        default: "h-9 px-4 gap-1.5",
        sm: "h-8 px-3 text-xs gap-1",
        lg: "h-10 px-5 text-base gap-2",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
