import { HOME_ACTIONS, runHomeAction } from '../home-actions';

/** Four shortcuts into existing features. */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="mb-3 font-display text-[20px] font-black text-white">
        Quick actions
      </h2>
      <ul className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2">
        {HOME_ACTIONS.map(({ id, label, description, icon: Icon, color }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => runHomeAction(id)}
              style={{ ['--accent' as string]: color }}
              className="group flex w-full items-center gap-3 rounded-[18px] border border-white/8 bg-panel/90 p-3.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-panel-2"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]" style={{ background: `${color}22`, color }}>
                <Icon size={21} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-white">{label}</span>
                <span className="block truncate text-[12px] text-muted">{description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
