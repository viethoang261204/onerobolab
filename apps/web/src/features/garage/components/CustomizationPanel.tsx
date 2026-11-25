import { useState } from 'react';
import { useLocale, useMessages } from '../../i18n/i18n';
import { garageMessages } from '../garage.messages';
import { modelInfo } from '../model/catalog';
import { modelRole, partLabel, wheelSectionLabel } from '../model/catalog.messages';
import type { DecalPlacement } from '../model/robot-config';
import type { UnlockContext } from '../model/unlocks';
import { useGarageStore, type GarageCategory } from '../state/garage-store';
import { AccessorySelector, AnimationSelector, ColorPicker, DecalSelector, PatternSelector, RobotModelSelector, RobotPartSelector, Section, WheelStyleSelector } from './selectors';

/** Right panel (desktop) or bottom sheet body (phone/tablet): controls for the selected category. */
export function CustomizationPanel({ ctx, category }: { ctx: UnlockContext; category: GarageCategory }) {
  const m = useMessages(garageMessages);
  const locale = useLocale();
  const s = useGarageStore();
  const { draft, part } = s;
  const info = modelInfo(draft.model);
  const [placement, setPlacement] = useState<DecalPlacement>(info.decalPlacements[0] ?? 'side-left');
  const place = info.decalPlacements.includes(placement) ? placement : (info.decalPlacements[0] ?? 'side-left');

  switch (category) {
    case 'robot':
      return (
        <div className="space-y-5">
          <Section title={m.sectionModel}>
            <RobotModelSelector value={draft.model} ctx={ctx} onChange={s.setModel} />
            <p className="text-[12px] text-[#8fa0bd]">{modelRole(draft.model, locale)}</p>
          </Section>
          <Section title={wheelSectionLabel(draft.model, locale)}>
            <WheelStyleSelector value={draft.wheelStyle} model={draft.model} ctx={ctx} onChange={s.setWheelStyle} />
          </Section>
          <Section title={m.sectionName}>
            <input
              value={draft.name}
              maxLength={24}
              onChange={(e) => s.rename(e.target.value)}
              aria-label={m.robotNameAria}
              className="h-11 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 font-display text-[15px] font-bold text-white outline-none focus:border-cyan/60 lg:h-10"
            />
          </Section>
        </div>
      );
    case 'paint':
      return (
        <div className="space-y-5">
          <Section title={m.sectionPart}>
            <RobotPartSelector model={draft.model} value={part} onChange={s.selectPart} />
          </Section>
          <Section title={m.sectionPaintPart({ part: partLabel(draft.model, part, locale) })}>
            <ColorPicker key={part} value={draft.colors[part]} onPreview={s.previewColor} onPick={(hex) => s.paint(hex)} onCombo={s.paintMany} />
          </Section>
        </div>
      );
    case 'patterns': {
      const p = part === 'led' ? 'body' : part;
      return (
        <div className="space-y-5">
          <Section title={m.sectionPart}>
            <RobotPartSelector model={draft.model} value={p} onChange={s.selectPart} exclude={['led']} />
          </Section>
          <Section title={m.sectionPatternPart({ part: partLabel(draft.model, p, locale) })}>
            <PatternSelector value={draft.patterns[p] ?? 'none'} onChange={(id) => s.setPattern(id, p)} />
          </Section>
        </div>
      );
    }
    case 'decals':
      return (
        <Section title={m.sectionDecals} aside={<span className="text-[11.5px] text-[#8fa0bd]">{m.upTo3}</span>}>
          <DecalSelector model={draft.model} placement={place} onPlacement={setPlacement} decals={draft.decals} onChange={s.setDecal} />
        </Section>
      );
    case 'accessories':
      return (
        <Section title={m.sectionAccessories} aside={<span className="text-[11.5px] text-[#8fa0bd]">{m.fittedCount({ n: draft.accessories.length })}</span>}>
          <AccessorySelector value={draft.accessories} ctx={ctx} onToggle={s.toggleAccessory} />
          <p className="text-[12px] text-[#8fa0bd]">{m.accessoriesUnlockNote}</p>
        </Section>
      );
    case 'animations':
      return (
        <Section title={m.sectionAnimation}>
          <AnimationSelector value={draft.animation} onChange={s.setAnimation} />
        </Section>
      );
  }
}
