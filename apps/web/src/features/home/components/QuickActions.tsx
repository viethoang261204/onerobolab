import { useMessages } from '../../i18n/i18n';
import { homeMessages } from '../home.messages';
import { HOME_ACTIONS, runHomeAction } from '../home-actions';

/** Four shortcuts into existing features. */
export function QuickActions() {
  const m = useMessages(homeMessages);
  const text = {
    explore: [m.actionExplore, m.actionExploreDesc],
    simulator: [m.actionSimulator, m.actionSimulatorDesc],
    practice: [m.actionPractice, m.actionPracticeDesc],
    learn: [m.actionLearn, m.actionLearnDesc],
  } as const;
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="mb-3 font-display text-[20px] font-black text-white">
        {m.quickActions}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HOME_ACTIONS.map(({ id, icon: Icon, color }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => runHomeAction(id)}
              style={{ ['--accent' as string]: color }}
              className="group flex w-full items-center min-h-14 gap-3 rounded-[18px] border border-white/8 bg-panel/90 p-3.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-2"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${color}22`, color }}>
                <Icon size={21} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-white">{text[id][0]}</span>
                <span className="block truncate text-[12px] text-muted">{text[id][1]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
