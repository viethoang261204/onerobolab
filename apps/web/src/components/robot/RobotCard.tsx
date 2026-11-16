import type { RobotOption } from '../../types/ui';
import { cn } from '../../utils/cn';
import { RobotGlyph } from './RobotGlyph';

interface RobotCardProps {
  robot: RobotOption;
  selected: boolean;
  onSelect: () => void;
}

/** Character-select tile: glowing cyan frame + slight scale when selected. */
export function RobotCard({ robot, selected, onSelect }: RobotCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={robot.definitionId ? robot.name : `${robot.name} — model coming soon`}
      className={cn(
        'group relative flex h-[86px] w-[96px] shrink-0 flex-col items-center justify-center rounded-[14px] border transition-all duration-200',
        selected
          ? 'z-10 scale-[1.06] border-cyan bg-gradient-to-b from-[#12335a] to-[#0d1f3a] shadow-[var(--glow-cyan)]'
          : 'border-white/8 bg-gradient-to-b from-[#16243d] to-[#101b30] hover:border-white/20',
      )}
    >
      <RobotGlyph kind={robot.glyph} className={cn('h-[56px] w-[76px] transition-transform duration-200', !selected && 'group-hover:scale-105')} />
      <span className={cn('text-[11px] font-semibold leading-none', selected ? 'text-cyan' : 'text-muted')}>{robot.name}</span>
      {!robot.definitionId && (
        <span className="absolute right-1 top-1 rounded-full bg-black/40 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-faint">Soon</span>
      )}
    </button>
  );
}
