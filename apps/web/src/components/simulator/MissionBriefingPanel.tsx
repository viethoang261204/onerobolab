import { Blocks, Clock, Code2, Eye, Gem, Lightbulb, Target, Timer } from 'lucide-react';
import type { LevelDefinition, MissionTier } from '../../content/levels/types';
import { LevelRegistry } from '../../content/levels/registry';
import { openStudio } from '../../features/level-selection/start-mission';
import { useLevelStore } from '../../features/levels/level-store';
import { useSettingsStore, type CodingLanguage } from '../../features/settings/settings-store';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../utils/cn';
import { buttonClass } from '../common/Button';

const TIER: Record<MissionTier, { label: string; tone: string }> = {
  easy: { label: 'Easy', tone: 'bg-success/15 text-[#86efac]' },
  medium: { label: 'Medium', tone: 'bg-cyan/15 text-[#a5f3fc]' },
  hard: { label: 'Hard', tone: 'bg-warning/15 text-[#fcd34d]' },
  boss: { label: 'Boss', tone: 'bg-danger/15 text-[#fca5a5]' },
};

/**
 * MISSION BRIEFING → PREDICT: shown when a mission with a briefing opens.
 * Story, task, the three objectives, concepts, and a question to think
 * about before coding. "Write the program" goes to Code Studio; "Look
 * around" closes it so the student can explore the 3D course first.
 */
export function MissionBriefingPanel({ level, onStartCoding }: { level: LevelDefinition; onStartCoding?: () => void }) {
  const dismiss = useLevelStore((s) => s.dismissIntro);
  const codingLanguage = useSettingsStore((s) => s.codingLanguage);
  const setSettings = useSettingsStore((s) => s.set);
  const setCodeTab = useUiStore((s) => s.setCodeTab);
  const b = level.briefing;
  if (!b) return null;
  const pickLanguage = (lang: CodingLanguage) => {
    setSettings({ codingLanguage: lang });
    setCodeTab(lang);
  };
  const objectives = [
    { icon: Target, kind: 'Primary', text: b.objectives.primary, tone: 'text-cyan' },
    { icon: Timer, kind: 'Secondary', text: b.objectives.secondary, tone: 'text-[#fcd34d]' },
    { icon: Gem, kind: 'Optional challenge', text: b.objectives.optional, tone: 'text-[#c4b5fd]' },
  ];
  return (
    <section role="dialog" aria-modal="true" aria-labelledby="briefing-title" className="pointer-events-auto flex max-h-[min(640px,calc(100vh-48px))] w-[min(560px,100%)] flex-col overflow-hidden rounded-[var(--radius-dialog)] border border-white/10 bg-[#0d1828]/95 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.85)] animate-pop-in">
      <div className="min-h-0 overflow-y-auto px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-bold uppercase tracking-[0.14em] text-cyan">Mission {LevelRegistry.code(level)} · Briefing</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${TIER[b.tier].tone}`}>{TIER[b.tier].label}</span>
          <span className="flex items-center gap-1 text-muted">
            <Clock size={12} aria-hidden="true" /> ~{b.minutes} min
          </span>
        </div>
        <h2 id="briefing-title" className="mt-1.5 font-display text-[24px] font-extrabold leading-tight text-white">
          {level.title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#cbd5e1]">{b.story}</p>
        <p className="mt-3 rounded-[var(--radius-control)] bg-white/[0.05] px-3.5 py-2.5 text-[14px] font-semibold text-white">{b.task}</p>

        <ul className="mt-4 space-y-2" aria-label="Objectives">
          {objectives.map(({ icon: Icon, kind, text, tone }) => (
            <li key={kind} className="flex items-start gap-2.5 text-[13.5px]">
              <Icon size={16} className={`mt-0.5 shrink-0 ${tone}`} aria-hidden="true" />
              <span>
                <span className="font-semibold text-white">{kind}:</span> <span className="text-[#cbd5e1]">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="You will practise">
          {b.concepts.map((c) => (
            <span key={c} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] font-medium text-[#dbe4f3]">
              {c}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-[var(--radius-control)] border border-warning/25 bg-warning/[0.07] px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-[#fcd34d]">
            <Lightbulb size={13} aria-hidden="true" /> Predict
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#fde68a]">{b.predict}</p>
        </div>

        <div className="mt-4" role="radiogroup" aria-label="Choose coding mode">
          <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wider text-muted">Choose how to code</div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              role="radio"
              aria-checked={codingLanguage === 'blocks'}
              onClick={() => pickLanguage('blocks')}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                codingLanguage === 'blocks' ? 'border-cyan bg-cyan/15 text-white' : 'border-white/10 bg-white/[0.03] text-[#cbd5e1] hover:bg-white/[0.07]',
              )}
            >
              <Blocks size={18} className={codingLanguage === 'blocks' ? 'text-cyan' : 'text-muted'} aria-hidden="true" />
              <div>
                <div className="text-[13px] font-bold">Coding Blocks</div>
                <div className="text-[11px] text-muted">Drag &amp; drop visual blocks</div>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={codingLanguage === 'python'}
              onClick={() => pickLanguage('python')}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                codingLanguage === 'python' ? 'border-cyan bg-cyan/15 text-white' : 'border-white/10 bg-white/[0.03] text-[#cbd5e1] hover:bg-white/[0.07]',
              )}
            >
              <Code2 size={18} className={codingLanguage === 'python' ? 'text-cyan' : 'text-muted'} aria-hidden="true" />
              <div>
                <div className="text-[13px] font-bold">Python</div>
                <div className="text-[11px] text-muted">Write code + API Spellbook</div>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 border-t border-white/8 px-6 py-4">
        <button type="button" autoFocus onClick={() => {
            dismiss();
            if (onStartCoding) onStartCoding();
            else openStudio(level.id);
          }} className={buttonClass('go', 'flex-1')}>
          <Code2 size={17} className="shrink-0" aria-hidden="true" /> Write the program
        </button>
        <button type="button" onClick={dismiss} className={buttonClass('outline', 'flex-1')}>
          <Eye size={17} className="shrink-0" aria-hidden="true" /> Look around first
        </button>
      </div>
    </section>
  );
}
