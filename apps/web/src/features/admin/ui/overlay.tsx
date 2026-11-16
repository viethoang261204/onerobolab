import { CheckCircle2, Info, MoreHorizontal, X, XCircle, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Button, cx, IconButton } from './primitives';

/*
 * Modal, drawer, confirm dialog, toasts and row menus. Overlays trap Tab
 * focus, close on Escape and return focus to where it was.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!items.length) return;
        const [a, z] = [items[0]!, items[items.length - 1]!];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useDialogFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="admin-root fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f172a]/45 p-6 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('w-full rounded-xl border border-adm-line bg-adm-surface shadow-adm-pop', size === 'sm' ? 'max-w-md' : size === 'md' ? 'max-w-xl' : 'max-w-3xl')}
      >
        <header className="flex items-start justify-between gap-4 border-b border-adm-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-adm-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-adm-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 rounded-b-xl border-t border-adm-line bg-adm-subtle px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Side panel for details and edit forms (keeps the list visible behind it). */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useDialogFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="admin-root fixed inset-0 z-40 flex justify-end bg-[#0f172a]/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Details'}
        className="animate-slide-in flex h-full max-w-[92vw] flex-col border-l border-adm-line bg-adm-surface shadow-adm-pop"
        style={{ width }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-adm-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-adm-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-adm-muted">{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Close panel" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-adm-line bg-adm-subtle px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// ── confirm ─────────────────────────────────────────────────────────────
interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}
const useConfirmStore = create<{ request: ConfirmRequest | null }>()(() => ({ request: null }));

/** `await confirmAction({...})` → true when the admin confirms. */
export function confirmAction(opts: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ request: { title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? 'Confirm', danger: opts.danger ?? false, resolve } });
  });
}

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const done = (ok: boolean) => {
    request?.resolve(ok);
    useConfirmStore.setState({ request: null });
  };
  return (
    <Modal
      open={!!request}
      title={request?.title ?? ''}
      onClose={() => done(false)}
      size="sm"
      footer={
        <>
          <Button onClick={() => done(false)}>Cancel</Button>
          <Button variant={request?.danger ? 'danger' : 'primary'} onClick={() => done(true)} data-autofocus>
            {request?.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-adm-body">{request?.message}</div>
    </Modal>
  );
}

// ── toasts ──────────────────────────────────────────────────────────────
type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}
const useToastStore = create<{ toasts: Toast[] }>()(() => ({ toasts: [] }));
let toastSeq = 0;

export function toast(message: string, tone: ToastTone = 'success'): void {
  const id = ++toastSeq;
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }));
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 7000 : 4000);
}

const TOAST_ICON: Record<ToastTone, LucideIcon> = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="admin-root pointer-events-none fixed right-5 bottom-5 z-[60] flex w-96 flex-col gap-2 bg-transparent" aria-live="polite">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="animate-slide-in pointer-events-auto flex items-start gap-3 rounded-lg border border-adm-line bg-adm-surface px-4 py-3 text-sm text-adm-ink shadow-adm-pop"
          >
            <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', t.tone === 'success' ? 'text-adm-ok' : t.tone === 'error' ? 'text-adm-bad' : 'text-adm-accent')} aria-hidden />
            <span className="flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

// ── row menu ────────────────────────────────────────────────────────────
export interface MenuItem {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
}

/** "⋯" button with a small action list (table rows). */
export function RowMenu({ items, label = 'Actions' }: { items: readonly MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={MoreHorizontal} label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-30 min-w-48 rounded-lg border border-adm-line bg-adm-surface py-1 shadow-adm-pop">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cx(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-40',
                  item.danger ? 'text-adm-bad hover:bg-adm-bad-soft' : 'text-adm-ink hover:bg-adm-subtle',
                )}
              >
                {Icon && <Icon className="h-4 w-4 opacity-70" aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

