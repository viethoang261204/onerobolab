import { useMessages } from '../../features/i18n/i18n';
import { RouteLink } from '../../features/router/RouteLink';
import { navigationMessages } from './navigation.messages';

/** Onespace rocket mark (`public/brand`) + wordmark (links home). */
export function BrandLogo() {
  const m = useMessages(navigationMessages);
  return (
    <RouteLink to="/" className="flex items-center gap-2.5 pr-2" aria-label={m.homeLink}>
      <img src="/brand/onespace-mark.svg" width={38} height={38} alt="" aria-hidden="true" className="h-[38px] w-[38px] shrink-0" draggable={false} />
      <span className="font-display text-[22px] font-extrabold tracking-tight text-white">OneRoboLab</span>
    </RouteLink>
  );
}
