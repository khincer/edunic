import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  tone?: 'default' | 'soft' | 'dark';
  children: ReactNode;
};

export function Card({
  tone = 'default',
  className,
  children,
  ...props
}: CardProps) {
  const toneClass = tone === 'default' ? '' : `card-${tone}`;

  return (
    <section className={['card', toneClass, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  );
}
