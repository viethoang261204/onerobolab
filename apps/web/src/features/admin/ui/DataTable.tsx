import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { formatNumber } from '../lib/format';
import { cx, IconButton } from './primitives';

export interface Column<T> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: T) => ReactNode;
  /** Server-side sort key; makes the header clickable. */
  readonly sortKey?: string;
  readonly align?: 'left' | 'right' | 'center';
  readonly width?: string;
  readonly className?: string;
}

export interface SortState {
  readonly key: string;
  readonly dir: 'asc' | 'desc';
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Dense data table. Rows are keyboard-reachable when `onRowClick` is set
 * (Enter opens). While reloading, the previous rows stay (dimmed).
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  loading = false,
  empty,
  sort,
  onSort,
  label,
  rowClassName,
}: {
  rows: readonly T[] | undefined;
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  sort?: SortState;
  onSort?: (s: SortState) => void;
  label: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  const header = (c: Column<T>) => {
    if (!c.sortKey || !onSort) return c.header;
    const active = sort?.key === c.sortKey;
    const Icon = !active ? ChevronsUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className={cx('inline-flex items-center gap-1 tracking-wide uppercase hover:text-adm-ink', active && 'text-adm-ink')}
        onClick={() => onSort({ key: c.sortKey!, dir: active && sort?.dir === 'desc' ? 'asc' : 'desc' })}
      >
        {c.header}
        <Icon className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>
    );
  };
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === 'Enter' && onRowClick) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={label} aria-busy={loading}>
        <thead>
          <tr className="border-b border-adm-line bg-adm-subtle">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={c.sortKey && sort?.key === c.sortKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cx('px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-adm-muted uppercase', ALIGN[c.align ?? 'left'])}
                style={c.width ? { width: c.width } : undefined}
              >
                {header(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cx(loading && rows && 'opacity-60 transition-opacity')}>
          {!rows &&
            loading &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={`sk${i}`} className="border-b border-adm-line/70">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3.5">
                    <span className="block h-3 w-3/4 animate-pulse rounded bg-adm-line" />
                  </td>
                ))}
              </tr>
            ))}
          {rows?.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
              className={cx('border-b border-adm-line/70 last:border-b-0', onRowClick && 'cursor-pointer hover:bg-adm-accent-soft/50 focus-visible:bg-adm-accent-soft/60', rowClassName?.(row))}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-2.5 align-middle text-adm-body', ALIGN[c.align ?? 'left'], c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows && rows.length === 0 && !loading && (empty ?? <p className="px-4 py-10 text-center text-sm text-adm-muted">Nothing here yet.</p>)}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-adm-line px-4 py-2.5 text-sm text-adm-muted">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        <span className="tabular px-2">
          Page {page} of {pages}
        </span>
        <IconButton icon={ChevronRight} label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}
