import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const baseStyles = cn(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
      "transition-all duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "active:scale-[0.98]"
    )

    const variants = {
      default: cn(
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "shadow-sm hover:shadow"
      ),
      secondary: cn(
        "bg-secondary text-secondary-foreground",
        "hover:bg-secondary/80",
        "border border-border/50"
      ),
      danger: cn(
        "bg-destructive text-destructive-foreground",
        "hover:bg-destructive/90",
        "shadow-sm"
      ),
      success: cn(
        "bg-success text-white",
        "hover:bg-success/90",
        "shadow-sm"
      ),
      ghost: cn(
        "text-foreground",
        "hover:bg-accent hover:text-accent-foreground"
      ),
      outline: cn(
        "border border-input bg-background text-foreground",
        "hover:bg-accent hover:text-accent-foreground"
      ),
    }

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10 p-0",
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }
