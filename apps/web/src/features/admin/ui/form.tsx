import { Search, X } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './primitives';

/*
 * Form controls. `Field` wires label, hint and error to its control via ids.
 */

const CONTROL =
  'rounded-lg border border-adm-line-strong bg-adm-surface px-3 text-sm text-adm-ink placeholder:text-adm-faint shadow-adm transition-colors focus:border-adm-accent focus:outline-none focus:ring-3 focus:ring-adm-accent/15 disabled:bg-adm-subtle disabled:text-adm-muted aria-[invalid=true]:border-adm-bad';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-adm-ink">
        {label}
        {required && <span className="text-adm-bad"> *</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-adm-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-adm-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Full width unless the caller sets a width (`w-60`, `w-auto`…). */
const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? undefined : 'w-full');

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cx(CONTROL, width(className), 'h-9', className)} {...rest} />;
}

export function NumberInput({
  value,
  onValue,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: number | null; onValue: (v: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cx(CONTROL, width(className), 'tabular h-9', className)}
      value={value ?? ''}
      onChange={(e) => onValue(e.target.value === '' ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

export function TextArea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cx(CONTROL, width(className), 'py-2 leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, width(className), 'h-9 pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, checked, onChange, disabled }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('flex items-start gap-2.5 text-sm', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-adm-line-strong accent-[var(--color-adm-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium text-adm-ink">{label}</span>
        {hint && <span className="block text-xs text-adm-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Search box with a clear button. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className, label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-adm-faint" aria-hidden />
      <input type="search" aria-label={label} className={cx(CONTROL, 'h-9 w-full pl-9')} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-adm-faint hover:text-adm-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Segmented choice (filters, modes). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-adm-line-strong bg-adm-subtle p-0.5 shadow-adm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 rounded-md px-3 text-[13px] font-medium transition-colors',
            o.value === value ? 'bg-adm-surface text-adm-ink shadow-adm' : 'text-adm-muted hover:text-adm-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
