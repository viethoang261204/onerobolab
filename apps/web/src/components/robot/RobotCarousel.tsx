import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { ROBOT_OPTIONS } from '../../data/robots';
import { logToConsole } from '../../stores/console-store';
import { useUiStore } from '../../stores/ui-store';
import { RobotCard } from './RobotCard';

const arrow =
  'flex h-12 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#c7d2fe] transition-colors hover:bg-white/8 hover:text-white';

/** Bottom robot selector (game character-select bar). */
export function RobotCarousel() {
  const selectedId = useUiStore((s) => s.selectedRobotId);
  const select = useUiStore((s) => s.selectRobot);
  const track = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => track.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });

  const choose = (id: string) => {
    if (id === selectedId) return;
    const robot = ROBOT_OPTIONS.find((r) => r.id === id);
    select(id);
    if (robot) logToConsole('info', robot.definitionId ? `Selected robot: ${robot.name}.` : `Selected robot: ${robot.name} (3D model coming soon).`);
  };

  return (
    <div className="glass flex h-[116px] items-center gap-1 rounded-[18px] px-2">
      <button type="button" className={arrow} onClick={() => scroll(-1)} aria-label="Previous robots">
        <ChevronLeft size={30} strokeWidth={2.4} />
      </button>
      <div ref={track} className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto px-2 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ROBOT_OPTIONS.map((r) => (
          <RobotCard key={r.id} robot={r} selected={r.id === selectedId} onSelect={() => choose(r.id)} />
        ))}
      </div>
      <button type="button" className={arrow} onClick={() => scroll(1)} aria-label="Next robots">
        <ChevronRight size={30} strokeWidth={2.4} />
      </button>
    </div>
  );
}
