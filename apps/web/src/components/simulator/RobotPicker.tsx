import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useMessages } from '../../features/i18n/i18n';
import { RobotCarousel } from '../robot/RobotCarousel';
import { simulatorMessages } from './simulator.messages';

/** Robot selection as a modal (the simulator keeps the screen for the world). */
export function RobotPicker({ onClose }: { onClose: () => void }) {
  const m = useMessages(simulatorMessages);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#040a18]/50 p-3 backdrop-blur-[2px] animate-fade-in sm:p-6" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={m.chooseRobotTitle} className="glass max-h-full w-[min(760px,100%)] overflow-y-auto rounded-[var(--radius-dialog)] p-4 animate-pop-in sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[20px] font-black text-white">{m.chooseRobotTitle}</h2>
            <p className="text-[12.5px] text-muted">{m.robotsSoon}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={m.close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <RobotCarousel />
      </section>
    </div>
  );
}
