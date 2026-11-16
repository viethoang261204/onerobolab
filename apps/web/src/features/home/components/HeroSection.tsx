import { ArrowRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { buttonClass } from '../../../components/common/Button';

const HeroShowcase = lazy(() => import('./HeroShowcase'));

/** Greeting, headline, the two main CTAs and the 3D robot showcase. `name` = the signed-in student. */
export function HeroSection({ name }: { name?: string | null }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative grid min-h-[400px] grid-cols-[1.05fr_1fr] overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(ellipse_at_78%_60%,#2a4a8f_0%,#132a5c_35%,#0b1733_70%)] shadow-[var(--shadow-panel)] max-[1100px]:grid-cols-[1.2fr_1fr]"
    >
      {/* faint blueprint grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative flex flex-col justify-center gap-5 py-10 pl-12 pr-4 max-[1100px]:pl-8">
        <p className="text-[15px] font-semibold text-cyan">{name ? `Welcome back, ${name}` : 'Robotics academy'}</p>
        <h1 id="hero-title" className="font-display text-[54px] font-extrabold leading-[1.04] tracking-tight text-white max-[1100px]:text-[46px]">
          Build. Code.{' '}
          <span className="text-cyan">Control.</span>
        </h1>
        <p className="max-w-[460px] text-[17px] leading-relaxed text-[#c7d3e8]">
          {name ? 'Continue your robotics journey — program real robot behaviors in an interactive 3D world.' : 'Learn robotics by programming real robot behaviors in an interactive 3D world.'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(paths.worldMap())}
            className={buttonClass('primary', 'group min-h-12 px-6 text-[16px]')}
          >
            Explore World <ArrowRight size={18} className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[360px]">
        <ErrorBoundary title="The 3D preview could not be shown">
          <Suspense fallback={<div className="h-full w-full" />}>
            <HeroShowcase />
          </Suspense>
        </ErrorBoundary>
      </div>
    </section>
  );
}
