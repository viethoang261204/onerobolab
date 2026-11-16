import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { RouteLink } from '../../router/RouteLink';
import { cx } from './primitives';

/*
 * Page scaffolding: breadcrumbs + title + actions, tabs, filter bar.
 */

export interface Crumb {
  readonly label: string;
  readonly to?: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-adm-muted">
        {items.map((c, i) => (
          <li key={`${c.label}${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-adm-faint" aria-hidden />}
            {c.to && i < items.length - 1 ? (
              <RouteLink to={c.to} className="hover:text-adm-accent hover:underline">
                {c.label}
              </RouteLink>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'text-adm-body' : undefined}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ crumbs, title, subtitle, actions, meta }: { crumbs?: readonly Crumb[]; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 pb-5">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] leading-tight font-semibold text-adm-ink">{title}</h1>
            {meta}
          </div>
          {subtitle && <p className="mt-1 text-sm text-adm-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly count?: number;
  readonly href?: string;
}

/** Underline tabs; with `href` they are links (deep-linkable), otherwise buttons. */
export function Tabs<T extends string>({ tabs, active, onChange, label }: { tabs: readonly TabItem<T>[]; active: T; onChange?: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-adm-line">
      {tabs.map((t) => {
        const cls = cx(
          '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
          t.id === active ? 'border-adm-accent text-adm-accent-strong' : 'border-transparent text-adm-muted hover:border-adm-line-strong hover:text-adm-ink',
        );
        const content = (
          <>
            {t.label}
            {t.count !== undefined && <span className="tabular rounded-full bg-adm-line/80 px-1.5 text-xs text-adm-body">{t.count}</span>}
          </>
        );
        return t.href ? (
          <RouteLink key={t.id} to={t.href} role="tab" aria-selected={t.id === active} className={cls}>
            {content}
          </RouteLink>
        ) : (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === active} className={cls} onClick={() => onChange?.(t.id)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

/** Row of filters above a table (inside a Card header area). */
export function FilterBar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-adm-line px-4 py-3">
      {children}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
