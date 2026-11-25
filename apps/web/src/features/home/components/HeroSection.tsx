import { ArrowRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { useMessages } from '../../i18n/i18n';
import { homeMessages } from '../home.messages';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { buttonClass } from '../../../components/common/Button';

const HeroShowcase = lazy(() => import('./HeroShowcase'));

/** Greeting, headline, the two main CTAs and the 3D robot showcase. `name` = the signed-in student. */
export function HeroSection({ name }: { name?: string | null }) {
  const m = useMessages(homeMessages);
  return (
    <section
      aria-labelledby="hero-title"
      className="relative grid min-h-[400px] grid-cols-1 overflow-hidden rounded-[20px] sm:rounded-[28px] border border-white/8 bg-[radial-gradient(ellipse_at_78%_60%,#2a4a8f_0%,#132a5c_35%,#0b1733_70%)] shadow-[var(--shadow-panel)] lg:grid-cols-[1.05fr_1fr]"
    >
      {/* faint blueprint grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative flex flex-col justify-center gap-4 px-5 py-8 sm:gap-5 sm:px-8 lg:py-10 lg:pl-12 lg:pr-4">
        <p className="text-[15px] font-semibold text-cyan">{name ? m.welcomeBack({ name }) : m.academy}</p>
        <h1 id="hero-title" className="font-display text-[36px] font-extrabold leading-[1.06] tracking-tight text-white sm:text-[46px] lg:text-[54px]">
          {m.buildCode} <span className="text-cyan">{m.control}</span>
        </h1>
        <p className="max-w-[460px] text-[16px] leading-relaxed sm:text-[17px] text-[#c7d3e8]">
          {name ? m.introSignedIn : m.introGuest}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(paths.worldMap())}
            className={buttonClass('primary', 'group min-h-12 w-full px-6 text-[16px] sm:w-auto')}
          >
            {m.exploreWorld} <ArrowRight size={18} className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[220px] sm:min-h-[320px] lg:min-h-[360px]">
        <ErrorBoundary title={m.previewFailed}>
          <Suspense fallback={<div className="h-full w-full" />}>
            <HeroShowcase />
          </Suspense>
        </ErrorBoundary>
      </div>
    </section>
  );
}
