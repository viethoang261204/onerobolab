import { Ban, Check, Lock, Play } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { RobotGlyph } from '../../../components/robot/RobotGlyph';
import { cn } from '../../../utils/cn';
import { useLocale, useMessages } from '../../i18n/i18n';
import { garageMessages } from '../garage.messages';
import { ACCESSORIES, ANIMATIONS, COMBOS, DECALS, MODELS, PALETTE, PATTERNS, WHEEL_STYLES, modelInfo } from '../model/catalog';
import { accessoryLabel, animationLabel, comboLabel, decalLabel, modelName, paletteColorName, partLabel, patternLabel, placementLabel, wheelStyleLabel } from '../model/catalog.messages';
import type { AccessoryId, AnimationId, DecalId, DecalPlacement, PartId, PatternId, RobotConfiguration, RobotModelId, WheelStyleId } from '../model/robot-config';
import { isUnlocked, unlockHint, type UnlockContext } from '../model/unlocks';
import { decalPreview, patternPreview } from '../render/textures';

/*
 * Garage controls. Consistent tiles (same size per group), one selected
 * state (cyan border + check), locked items quiet with the unlock rule in
 * words. All state lives in the garage store; these only call back.
 */

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-white">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({
  selected,
  locked,
  label,
  hint,
  onClick,
  onEnter,
  onLeave,
  children,
  className,
}: {
  selected: boolean;
  locked?: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const m = useMessages(garageMessages);
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      aria-pressed={selected}
      aria-disabled={locked || undefined}
      aria-label={locked ? m.tileLockedAria({ label, hint: hint ?? '' }) : label}
      title={locked ? hint : label}
      className={cn(
        'relative flex min-h-11 flex-col items-center gap-1 rounded-[12px] border p-1.5 text-center transition-colors duration-[var(--dur-fast)]',
        selected ? 'border-cyan/70 bg-cyan/[0.08]' : 'border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
        locked && 'cursor-not-allowed opacity-55 hover:border-white/8 hover:bg-white/[0.03]',
        className,
      )}
    >
      {children}
      <span className={cn('w-full truncate text-[11.5px] font-semibold', selected ? 'text-white' : 'text-[#b6c3da]')}>{label}</span>
      {selected && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan text-[#04222b]" aria-hidden="true">
          <Check size={10} strokeWidth={3.6} />
        </span>
      )}
      {locked && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#1e293b] text-[#94a3b8]" aria-hidden="true">
          <Lock size={9} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function BipedGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="22" y="6" width="20" height="15" rx="5" fill="#e2e8f0" />
      <rect x="26" y="11" width="12" height="4" rx="2" fill="#22d3ee" />
      <rect x="20" y="23" width="24" height="20" rx="6" fill="#cbd5e1" />
      <circle cx="32" cy="32" r="3" fill="#22d3ee" />
      <rect x="12" y="24" width="6" height="16" rx="3" fill="#3b82f6" />
      <rect x="46" y="24" width="6" height="16" rx="3" fill="#3b82f6" />
      <rect x="24" y="44" width="6" height="14" rx="3" fill="#334155" />
      <rect x="34" y="44" width="6" height="14" rx="3" fill="#334155" />
    </svg>
  );
}

const MODEL_GLYPH = { rover: 'rover', scout: 'scout', tank: 'tank' } as const;

export function ModelGlyph({ model, className = '' }: { model: RobotModelId; className?: string }) {
  return model === 'biped' ? <BipedGlyph className={className} /> : <RobotGlyph kind={MODEL_GLYPH[model]} className={className} />;
}

export function RobotModelSelector({ value, ctx, onChange }: { value: RobotModelId; ctx: UnlockContext; onChange: (m: RobotModelId) => void }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {MODELS.map((m) => {
        const locked = !isUnlocked(m.unlock, ctx);
        return (
          <Tile key={m.id} selected={value === m.id} locked={locked} label={modelName(m.id, locale)} hint={unlockHint(m.unlock, ctx, locale)} onClick={() => onChange(m.id)}>
            <ModelGlyph model={m.id} className="h-12 w-full" />
          </Tile>
        );
      })}
    </div>
  );
}

export function WheelStyleSelector({ value, model, ctx, onChange }: { value: WheelStyleId; model: RobotModelId; ctx: UnlockContext; onChange: (w: WheelStyleId) => void }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-3 gap-2">
      {WHEEL_STYLES.map((w) => {
        const locked = !isUnlocked(w.unlock, ctx);
        return (
          <Tile key={w.id} selected={value === w.id} locked={locked} label={wheelStyleLabel(w.id, model, locale)} hint={unlockHint(w.unlock, ctx, locale)} onClick={() => onChange(w.id)} className="py-2.5">
            <span className={cn('h-7 w-7 rounded-full border-[5px]', w.id === 'snow' ? 'border-[#e2e8f0] bg-[#334155]' : w.id === 'all-terrain' ? 'border-[#78350f] bg-[#f97316]' : 'border-[#1a1d26] bg-[#475569]')} />
          </Tile>
        );
      })}
    </div>
  );
}

/** Which part is being customised (highlighted on the robot). */
export function RobotPartSelector({ model, value, onChange, exclude = [] }: { model: RobotModelId; value: PartId; onChange: (p: PartId) => void; exclude?: readonly PartId[] }) {
  const m = useMessages(garageMessages);
  const locale = useLocale();
  return (
    <div role="tablist" aria-label={m.robotPartAria} className="flex flex-wrap gap-1.5">
      {modelInfo(model)
        .parts.filter((p) => !exclude.includes(p.id))
        .map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={value === p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              'min-h-11 rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors lg:min-h-8',
              value === p.id ? 'bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_rgb(34_211_238/0.5)]' : 'bg-white/[0.04] text-[#b6c3da] hover:bg-white/[0.08] hover:text-white',
            )}
          >
            {partLabel(model, p.id, locale)}
          </button>
        ))}
    </div>
  );
}

/** Palette with hover preview, a custom colour and two-tone combos. */
export function ColorPicker({
  value,
  onPreview,
  onPick,
  onCombo,
}: {
  value: string;
  onPreview: (hex: string | null) => void;
  onPick: (hex: string) => void;
  onCombo?: (colors: RobotConfiguration['colors'] | Partial<RobotConfiguration['colors']>) => void;
}) {
  const m = useMessages(garageMessages);
  const locale = useLocale();
  const [custom, setCustom] = useState(value);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={m.colourAria}>
        {PALETTE.map((c) => {
          const on = c.hex.toLowerCase() === value.toLowerCase();
          const name = paletteColorName(c.hex, c.name, locale);
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={name}
              title={name}
              onPointerEnter={() => onPreview(c.hex)}
              onPointerLeave={() => onPreview(null)}
              onFocus={() => onPreview(c.hex)}
              onBlur={() => onPreview(null)}
              onClick={() => onPick(c.hex)}
              className={cn('relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform lg:h-9 lg:w-9', on ? 'border-white' : 'border-white/15')}
              style={{ background: c.hex }}
            >
              {on && <Check size={15} strokeWidth={3.4} className={c.hex === '#f3f5fa' || c.hex === '#facc15' ? 'text-[#0b1426]' : 'text-white'} />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12.5px] text-[#b6c3da] lg:min-h-9">
          <input
            type="color"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              onPreview(e.target.value);
            }}
            className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label={m.customColourAria}
          />
          {m.customLabel} <span className="tabular uppercase text-white">{custom}</span>
        </label>
        <button type="button" onClick={() => onPick(custom)} className="min-h-11 rounded-[10px] bg-white/[0.08] px-3.5 text-[12.5px] font-semibold text-white hover:bg-white/[0.14] lg:min-h-9 lg:px-3">
          {m.apply}
        </button>
      </div>
      {onCombo && (
        <div className="grid grid-cols-2 gap-1.5">
          {COMBOS.map((c) => (
            <button key={c.name} type="button" onClick={() => onCombo(c.colors)} className="flex min-h-11 items-center gap-2 rounded-[10px] bg-white/[0.04] px-2.5 py-1.5 text-left text-[12px] font-semibold text-[#cbd5e1] hover:bg-white/[0.08] hover:text-white lg:min-h-9">
              <span className="flex shrink-0 -space-x-1">
                {[c.colors.body, c.colors.accent].map((hex, i) => (
                  <span key={i} className="h-4 w-4 rounded-full border border-[#0a1428]" style={{ background: hex }} />
                ))}
              </span>
              <span className="truncate">{comboLabel(c.name, locale)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PatternSelector({ value, onChange }: { value: PatternId; onChange: (p: PatternId) => void }) {
  const locale = useLocale();
  const previews = useMemo(() => Object.fromEntries(PATTERNS.map((p) => [p.id, patternPreview(p.id)])), []);
  return (
    <div className="grid grid-cols-3 gap-2">
      {PATTERNS.map((p) => (
        <Tile key={p.id} selected={value === p.id} label={patternLabel(p.id, locale)} onClick={() => onChange(p.id)}>
          <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded-[8px] bg-[#1e293b]">
            {previews[p.id] ? <img src={previews[p.id]!} alt="" className="h-full w-full object-cover" draggable={false} /> : <Ban size={20} className="text-[#64748b]" />}
          </span>
        </Tile>
      ))}
    </div>
  );
}

export function DecalSelector({
  model,
  placement,
  onPlacement,
  decals,
  onChange,
}: {
  model: RobotModelId;
  placement: DecalPlacement;
  onPlacement: (p: DecalPlacement) => void;
  decals: RobotConfiguration['decals'];
  onChange: (placement: DecalPlacement, decal: { id: DecalId; color: string; text?: string } | null) => void;
}) {
  const m = useMessages(garageMessages);
  const locale = useLocale();
  const current = decals.find((d) => d.placement === placement) ?? null;
  const previews = useMemo(() => Object.fromEntries(DECALS.map((d) => [d.id, decalPreview(d.id)])), []);
  const color = current?.color ?? '#ffffff';
  const textual = current && (current.id === 'number' || current.id === 'initials');
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={m.decalPositionAria} className="flex flex-wrap gap-1.5">
        {modelInfo(model).decalPlacements.map((p) => {
          const used = decals.some((d) => d.placement === p);
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={placement === p}
              onClick={() => onPlacement(p)}
              className={cn(
                'flex min-h-11 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-semibold lg:min-h-8',
                placement === p ? 'bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_rgb(34_211_238/0.5)]' : 'bg-white/[0.04] text-[#b6c3da] hover:bg-white/[0.08]',
              )}
            >
              {placementLabel(p, locale)}
              {used && <span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-label={m.hasDecalAria} />}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile selected={!current} label={m.none} onClick={() => onChange(placement, null)}>
          <span className="flex h-11 w-full items-center justify-center rounded-[8px] bg-[#1e293b]">
            <Ban size={20} className="text-[#64748b]" />
          </span>
        </Tile>
        {DECALS.map((d) => (
          <Tile key={d.id} selected={current?.id === d.id} label={decalLabel(d.id, locale)} onClick={() => onChange(placement, { id: d.id, color, ...(current?.text ? { text: current.text } : {}) })}>
            <span className="flex h-11 w-full items-center justify-center rounded-[8px] bg-[#1e293b]">{previews[d.id] && <img src={previews[d.id]!} alt="" className="h-9 w-9" draggable={false} />}</span>
          </Tile>
        ))}
      </div>
      {current && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 lg:gap-1.5" aria-label={m.decalColourGroupAria}>
            {PALETTE.map((c) => {
              const name = paletteColorName(c.hex, c.name, locale);
              return (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={m.decalColourItemAria({ name })}
                  aria-pressed={c.hex === current.color}
                  onClick={() => onChange(placement, { id: current.id, color: c.hex, ...(current.text ? { text: current.text } : {}) })}
                  className={cn('h-9 w-9 rounded-full border-2 lg:h-6 lg:w-6', c.hex === current.color ? 'border-white' : 'border-white/15')}
                  style={{ background: c.hex }}
                />
              );
            })}
          </div>
          {textual && (
            <label className="flex items-center gap-2 text-[12.5px] text-[#b6c3da]">
              {current.id === 'number' ? m.numberLabel : m.initialsLabel}
              <input
                value={current.text ?? ''}
                maxLength={3}
                onChange={(e) => onChange(placement, { id: current.id, color: current.color, text: e.target.value })}
                placeholder={current.id === 'number' ? '01' : 'RV'}
                className="h-10 w-20 rounded-[8px] border border-white/10 bg-white/[0.04] px-2 text-center font-display font-black uppercase text-white outline-none focus:border-cyan/60 lg:h-8"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function AccessorySelector({ value, ctx, onToggle }: { value: readonly AccessoryId[]; ctx: UnlockContext; onToggle: (a: AccessoryId) => void }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACCESSORIES.map((a) => {
        const locked = !isUnlocked(a.unlock, ctx);
        const hint = unlockHint(a.unlock, ctx, locale);
        return (
          <Tile key={a.id} selected={value.includes(a.id)} locked={locked} label={accessoryLabel(a.id, locale)} hint={hint} onClick={() => onToggle(a.id)} className="py-2">
            <span className="flex h-9 w-full items-center justify-center text-[10.5px] leading-tight text-[#8fa0bd]">{locked ? hint : ''}</span>
          </Tile>
        );
      })}
    </div>
  );
}

export function AnimationSelector({ value, onChange }: { value: AnimationId; onChange: (a: AnimationId) => void }) {
  const locale = useLocale();
  return (
    <ul className="space-y-1.5">
      {ANIMATIONS.map((a) => {
        const l = animationLabel(a.id, locale);
        return (
          <li key={a.id}>
            <button
              type="button"
              aria-pressed={value === a.id}
              title={l.name}
              onClick={() => onChange(a.id)}
              className={cn('flex min-h-12 w-full items-center gap-3 rounded-[11px] border px-3 py-2 text-left', value === a.id ? 'border-cyan/60 bg-cyan/[0.08]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]')}
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', value === a.id ? 'bg-cyan text-[#04222b]' : 'bg-white/[0.08] text-[#cbd5e1]')}>
                <Play size={14} className="fill-current" />
              </span>
              <span>
                <span className="block text-[13px] font-bold text-white">{l.name}</span>
                <span className="block text-[11.5px] text-[#8fa0bd]">{l.hint}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
