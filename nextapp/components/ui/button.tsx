import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-contrast hover:bg-primary-hover',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-sunken',
        ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props }, ref,
) {
  return <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />
})

type ButtonLinkProps = ComponentProps<typeof Link> & VariantProps<typeof buttonStyles>

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />
}
