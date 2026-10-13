'use client';

import { cn } from "@/lib/utils"
import React, { forwardRef, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"

const inputVariants = cva(
  "flex w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        error: "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
      },
      inputSize: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-10 px-3",
        lg: "h-12 px-4 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md"
    }
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
  error?: string
  label?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, error, label, helperText, leftElement, rightElement, ...props }, ref) => {
    
    // Determine if we should show the password toggle icon
    const [showPassword, setShowPassword] = useState(false)
    const isPasswordField = props.type === "password"
    
    // Set variant to error if error prop is provided
    if (error) {
      variant = "error"
    }
    
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label 
            htmlFor={props.id} 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftElement && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
              {leftElement}
            </div>
          )}
          
          <input
            type={isPasswordField ? (showPassword ? "text" : "password") : props.type}
            className={cn(
              inputVariants({ variant, inputSize, className }),
              leftElement && "pl-9",
              (rightElement || isPasswordField) && "pr-9"
            )}
            ref={ref}
            {...props}
          />
          
          {rightElement && !isPasswordField && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
              {rightElement}
            </div>
          )}
          
          {isPasswordField && (
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-700"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        
        {(error || helperText) && (
          <p className={cn(
            "text-xs", 
            error ? "text-red-600" : "text-gray-500"
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }

// Eye icons for password visibility toggle
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
) 