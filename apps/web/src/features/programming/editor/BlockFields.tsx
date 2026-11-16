import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type PointerEvent } from 'react';
import type { DropdownOption, FieldValue } from '../blocks/block-types';

/** Field widgets must not start block drags. */
const stop = (e: PointerEvent) => e.stopPropagation();

const pill = 'flex h-[26px] items-center rounded-full bg-white px-2 font-display text-[13.5px] font-extrabold text-[#1e293b] shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]';

interface NumberFieldProps {
  value: FieldValue;
  onChange?: (value: FieldValue) => void;
  /** Visual state from validation. */
  invalid?: boolean;
  label: string;
}

/**
 * Inline number input. Keeps a text draft so partial input ("-", "1.")
 * is allowed while typing; commits every parsable value (history coalesces
 * the keystrokes). Empty input is kept as '' and flagged by validation.
 */
export function NumberField({ value, onChange, invalid, label }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  if (!onChange) return <span className={pill}>{String(value)}</span>;

  const commit = (text: string) => {
    setDraft(text);
    if (text.trim() === '') return onChange('');
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) onChange(n);
  };

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={draft}
      onPointerDown={stop}
      onChange={(e) => commit(e.target.value)}
      onBlur={() => setDraft(String(value))}
      onKeyDown={(e) => {
        e.stopPropagation(); // editor shortcuts must not fire while typing
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
      // Digits in the display font are wider than `ch`; pad for the pill's padding too.
      style={{ width: `calc(${Math.max(2, draft.length) * 1.15}ch + 18px)` }}
      className={`${pill} text-center outline-none transition-shadow focus:ring-2 focus:ring-cyan ${invalid ? 'ring-2 ring-danger' : ''}`}
    />
  );
}

interface DropdownFieldProps {
  value: string;
  options: readonly DropdownOption[];
  onChange?: (value: string) => void;
  label: string;
  /** Extra option appended at the end (e.g. "New variable…"). */
  extra?: { value: string; label: string };
  invalid?: boolean;
}

export function DropdownField({ value, options, onChange, label, extra, invalid }: DropdownFieldProps) {
  const text = options.find((o) => o.value === value)?.label ?? (value || '—');
  const box = `relative flex h-[26px] items-center gap-1 rounded-[8px] bg-black/20 pl-2 pr-1.5 text-[13.5px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)] ${invalid ? 'ring-2 ring-danger' : ''}`;
  if (!onChange) {
    return (
      <span className={box}>
        {text}
        <ChevronDown size={13} strokeWidth={3} />
      </span>
    );
  }
  return (
    <label className={`${box} cursor-pointer hover:bg-black/30`} onPointerDown={stop}>
      <span>{text}</span>
      <ChevronDown size={13} strokeWidth={3} />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {!options.some((o) => o.value === value) && <option value={value}>{value || 'choose…'}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {extra && <option value={extra.value}>{extra.label}</option>}
      </select>
    </label>
  );
}

const NEW_VARIABLE = '__new_variable__';

interface VariableFieldProps {
  value: string;
  variables: readonly string[];
  onChange?: (value: string) => void;
  onCreate?: (name: string) => void;
  invalid?: boolean;
}

/** Variable picker with a "New variable…" entry. */
export function VariableField({ value, variables, onChange, onCreate, invalid = false }: VariableFieldProps) {
  return (
    <DropdownField
      label="Variable"
      value={value}
      options={variables.map((v) => ({ value: v, label: v }))}
      {...(onCreate && { extra: { value: NEW_VARIABLE, label: 'New variable…' } })}
      invalid={invalid}
      {...(onChange && {
        onChange: (v: string) => {
          if (v !== NEW_VARIABLE) return onChange(v);
          const name = window.prompt('Name for the new variable:')?.trim();
          if (name) {
            onCreate?.(name);
            onChange(name);
          }
        },
      })}
    />
  );
}

interface TextFieldProps {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  invalid?: boolean;
}

/** Inline name input (function names): letters, digits and _ only. */
export function TextField({ value, onChange, label, invalid = false }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!onChange) return <span className={pill}>{value || '—'}</span>;
  return (
    <input
      aria-label={label}
      value={draft}
      spellCheck={false}
      onPointerDown={stop}
      onChange={(e) => {
        const text = e.target.value.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
        setDraft(text);
        onChange(text);
      }}
      onBlur={() => setDraft(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
      style={{ width: `calc(${Math.max(4, draft.length) * 1.05}ch + 18px)` }}
      className={`${pill} text-center outline-none transition-shadow focus:ring-2 focus:ring-cyan ${invalid ? 'ring-2 ring-danger' : ''}`}
    />
  );
}
