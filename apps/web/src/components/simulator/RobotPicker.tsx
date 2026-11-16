import { X } from 'lucide-react';
import { useEffect } from 'react';
import { RobotCarousel } from '../robot/RobotCarousel';

/** Robot selection as a modal (the simulator keeps the screen for the world). */
export function RobotPicker({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#040a18]/50 p-6 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Choose a robot" className="glass w-[min(760px,100%)] rounded-[var(--radius-dialog)] p-5 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[20px] font-black text-white">Choose a robot</h2>
            <p className="text-[12.5px] text-muted">Rover is ready. More robots are being built.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <RobotCarousel />
      </section>
    </div>
  );
}
