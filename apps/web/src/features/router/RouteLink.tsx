import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './router-store';

interface RouteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}

/**
 * A real `<a href>` (open in new tab, copy link, screen readers) that
 * navigates in-app on a plain left click.
 */
export function RouteLink({ to, onClick, ...rest }: RouteLinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
