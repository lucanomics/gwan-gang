import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/40',
  secondary:
    'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 active:bg-ink-100 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700',
  ghost:
    'bg-transparent text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-600/40',
};

const SIZES = {
  sm: 'px-3 py-2 text-sm rounded-lg min-h-[40px]',
  md: 'px-4 py-3 text-[15px] rounded-xl min-h-[48px]',
  lg: 'px-5 py-4 text-lg rounded-2xl min-h-[60px]',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  full?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  full,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  to: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  full?: boolean;
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return <Tag className={clsx('card', className)}>{children}</Tag>;
}

export function Chip({
  children,
  tone = 'bg-ink-500/10 text-ink-600 ring-ink-500/20 dark:text-ink-300',
  className,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return <span className={clsx('chip', tone, className)}>{children}</span>;
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Meter({
  value,
  max,
  tone = 'bg-brand-500',
  label,
}: {
  value: number;
  max: number;
  tone?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
      role="img"
      aria-label={label ?? `${value} / ${max}`}
    >
      <div className={clsx('h-full rounded-full transition-[width]', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <p className="text-base font-bold">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex flex-col gap-2">{children}</div> : null}
    </Card>
  );
}
