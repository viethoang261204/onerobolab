import { useState } from 'react';
import { modelInfo } from '../model/catalog';
import type { DecalPlacement } from '../model/robot-config';
import type { UnlockContext } from '../model/unlocks';
import { useGarageStore, type GarageCategory } from '../state/garage-store';
import { AccessorySelector, AnimationSelector, ColorPicker, DecalSelector, PatternSelector, RobotModelSelector, RobotPartSelector, Section, WheelStyleSelector } from './selectors';

/** Right panel: the controls of the selected category (only one category at a time). */
export function CustomizationPanel({ ctx, category }: { ctx: UnlockContext; category: GarageCategory }) {
  const s = useGarageStore();
  const { draft, part } = s;
  const info = modelInfo(draft.model);
  const [placement, setPlacement] = useState<DecalPlacement>(info.decalPlacements[0] ?? 'side-left');
  const place = info.decalPlacements.includes(placement) ? placement : (info.decalPlacements[0] ?? 'side-left');
  const partLabel = info.parts.find((p) => p.id === part)?.label ?? 'Body';

  switch (category) {
    case 'robot':
      return (
        <div className="space-y-5">
          <Section title="Robot model">
            <RobotModelSelector value={draft.model} ctx={ctx} onChange={s.setModel} />
            <p className="text-[12px] text-[#8fa0bd]">{info.role}</p>
          </Section>
          <Section title={draft.model === 'tank' ? 'Tracks' : draft.model === 'biped' ? 'Boots' : 'Wheels'}>
            <WheelStyleSelector value={draft.wheelStyle} model={draft.model} ctx={ctx} onChange={s.setWheelStyle} />
          </Section>
          <Section title="Name">
            <input
              value={draft.name}
              maxLength={24}
              onChange={(e) => s.rename(e.target.value)}
              aria-label="Robot name"
              className="h-10 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 font-display text-[15px] font-bold text-white outline-none focus:border-cyan/60"
            />
          </Section>
        </div>
      );
    case 'paint':
      return (
        <div className="space-y-5">
          <Section title="Part">
            <RobotPartSelector model={draft.model} value={part} onChange={s.selectPart} />
          </Section>
          <Section title={`Paint · ${partLabel}`}>
            <ColorPicker key={part} value={draft.colors[part]} onPreview={s.previewColor} onPick={(hex) => s.paint(hex)} onCombo={s.paintMany} />
          </Section>
        </div>
      );
    case 'patterns': {
      const p = part === 'led' ? 'body' : part;
      return (
        <div className="space-y-5">
          <Section title="Part">
            <RobotPartSelector model={draft.model} value={p} onChange={s.selectPart} exclude={['led']} />
          </Section>
          <Section title={`Pattern · ${info.parts.find((x) => x.id === p)?.label ?? 'Body'}`}>
            <PatternSelector value={draft.patterns[p] ?? 'none'} onChange={(id) => s.setPattern(id, p)} />
          </Section>
        </div>
      );
    }
    case 'decals':
      return (
        <Section title="Decals" aside={<span className="text-[11.5px] text-[#8fa0bd]">Up to 3</span>}>
          <DecalSelector model={draft.model} placement={place} onPlacement={setPlacement} decals={draft.decals} onChange={s.setDecal} />
        </Section>
      );
    case 'accessories':
      return (
        <Section title="Accessories" aside={<span className="text-[11.5px] text-[#8fa0bd]">{draft.accessories.length} fitted</span>}>
          <AccessorySelector value={draft.accessories} ctx={ctx} onToggle={s.toggleAccessory} />
          <p className="text-[12px] text-[#8fa0bd]">Some parts unlock as you travel through the worlds.</p>
        </Section>
      );
    case 'animations':
      return (
        <Section title="Animation">
          <AnimationSelector value={draft.animation} onChange={s.setAnimation} />
        </Section>
      );
  }
}
