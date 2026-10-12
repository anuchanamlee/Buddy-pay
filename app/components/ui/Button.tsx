import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';


const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-primary to-secondary text-white border-none shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
        secondary: 'bg-transparent text-foreground border border-border hover:bg-muted hover:border-muted-foreground',
        success: 'bg-gradient-to-r from-success-500 to-[#10B981] text-white border-none shadow-sm hover:-translate-y-0.5 hover:shadow-md',
        warning: 'bg-gradient-to-r from-warning-500 to-warning-400 text-white border-none shadow-sm hover:-translate-y-0.5 hover:shadow-md',
        danger: 'bg-gradient-to-r from-destructive to-danger-400 text-white border-none shadow-sm hover:-translate-y-0.5 hover:shadow-md',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-9 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-6',
        xl: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
      isLoading: {
        true: 'relative text-transparent transition-none hover:text-transparent',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, leftIcon, rightIcon, isLoading, loadingText, ...props }, ref) => {
    
    return (
      <button
        className={cn(buttonVariants({ variant, size, isLoading, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg 
              className="animate-spin h-5 w-5 text-current" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              ></circle>
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        )}
        
        {leftIcon && <span className={cn("mr-2", { "opacity-0": isLoading })}>{leftIcon}</span>}
        <span className={cn("inline-flex items-center justify-center gap-2", { "opacity-0": isLoading })}>
          {isLoading && loadingText ? loadingText : children}
        </span>
        {rightIcon && <span className={cn("ml-2", { "opacity-0": isLoading })}>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps }; 