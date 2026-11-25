import { Compass, House } from 'lucide-react';
import { useMessages } from '../../i18n/i18n';
import { homeMessages } from '../home.messages';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';

/** Unknown URL: friendly way back. */
export function NotFoundPage() {
  const m = useMessages(homeMessages);
  return (
    <main className="flex flex-1 items-center justify-center p-6 animate-page-in">
      <div className="glass max-w-[420px] rounded-[var(--radius-dialog)] p-8 text-center">
        <p className="font-display text-[44px] font-black text-white">404</p>
        <h1 className="mt-1 text-[18px] font-bold text-white">{m.notMappedTitle}</h1>
        <p className="mt-2 text-[14px] text-muted">{m.notMappedBody}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => navigate(paths.home())} className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-white/15 px-4 font-semibold text-white hover:bg-white/8">
            <House size={17} /> {m.goHome}
          </button>
          <button type="button" onClick={() => navigate(paths.worldMap())} className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 font-semibold text-white hover:brightness-110">
            <Compass size={17} /> {m.worldMap}
          </button>
        </div>
      </div>
    </main>
  );
}
