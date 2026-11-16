import { useEffect, useRef, useState } from 'react';
import { ONBOARDING_TOURS } from '../../content/tutorials/onboarding';
import { useOnboardingStore } from './onboarding-store';
import { robotScreen } from './robot-screen';
import { buttonClass } from '../../components/common/Button';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  round: boolean;
}

const PAD = 8;
const CARD_W = 300;

/** Measure the current target: a [data-tour] element, or a circle around the robot. */
function measure(target: string): Box | null {
  if (target === 'robot') {
    const p = robotScreen.get();
    if (!p) return null;
    return { x: p.x - 85, y: p.y - 85, w: 170, h: 170, round: true };
  }
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, round: false };
}

/**
 * First-visit spotlight tour: dims everything except the current target and
 * explains it in one sentence. Skippable; never shown again once finished.
 */
export function OnboardingTour() {
  const step = useOnboardingStore((s) => s.step);
  const tour = useOnboardingStore((s) => s.tour);
  const STEPS = tour ? ONBOARDING_TOURS[tour] : [];
  const next = useOnboardingStore((s) => s.next);
  const skip = useOnboardingStore((s) => s.skip);
  const [box, setBox] = useState<Box | null>(null);
  const raf = useRef(0);

  // Follow the target (the robot can move; panels can resize).
  useEffect(() => {
    if (step === null || !tour) return;
    const s = ONBOARDING_TOURS[tour][step];
    if (!s) return;
    let last = '';
    const loop = () => {
      const b = measure(s.target);
      const key = b ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}` : '';
      if (key !== last) {
        last = key;
        setBox(b);
      }
      raf.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf.current);
  }, [step, tour]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      if (e.key === 'Enter' || e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, next, skip]);

  if (step === null) return null;
  const s = STEPS[step];
  if (!s) return null;
  const last = step === STEPS.length - 1;

  // Card beside the target: below if there is room, otherwise above / inside.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardX = box ? Math.min(Math.max(12, box.x + box.w / 2 - CARD_W / 2), vw - CARD_W - 12) : vw / 2 - CARD_W / 2;
  let cardY = box ? box.y + box.h + 14 : vh / 2 - 80;
  if (box && cardY + 170 > vh) cardY = Math.max(12, box.y - 184);
  if (box && box.h > vh * 0.6) {
    cardY = box.y + 24;
    cardX = Math.min(box.x + 24, vw - CARD_W - 12);
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Quick tour">
      {box ? (
        <div
          className="pointer-events-none absolute border-2 border-cyan/80 transition-[left,top,width,height] duration-[var(--dur-base)]"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.round ? '50%' : 18, boxShadow: '0 0 0 9999px rgb(3 7 18 / 0.66), 0 0 28px 2px rgb(34 211 238 / 0.45)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#030712]/66" />
      )}
      <div className="glass absolute w-[300px] rounded-[var(--radius-dialog)] p-4 animate-pop-in" key={step} style={{ left: cardX, top: cardY }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 className="mt-1 font-display text-[19px] font-black text-white">{s.title}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[#cbd5e1]">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={skip} className="rounded-[var(--radius-chip)] px-2 py-1 text-[12.5px] text-muted hover:text-white">
            Skip tour
          </button>
          <div className="flex items-center gap-3">
            <span className="flex gap-1">
              {STEPS.map((_, i) => (
                <span key={i} className={i === step ? 'h-1.5 w-4 rounded-full bg-cyan' : 'h-1.5 w-1.5 rounded-full bg-white/20'} />
              ))}
            </span>
            <button type="button" autoFocus onClick={next} className={buttonClass('primary', 'h-9 min-h-9 px-4 text-[14px]')}>
              {last ? 'Let’s go' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
