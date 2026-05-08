import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
};

function getButtonClassName(variant: ButtonVariant, className?: string) {
  return ['button', `button-${variant}`, className].filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName(variant, className)}
      type={type}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = 'primary',
  className,
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={getButtonClassName(variant, className)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}
