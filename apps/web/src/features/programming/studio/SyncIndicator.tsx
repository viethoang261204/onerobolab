import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { Tooltip } from '../../../components/common/Tooltip';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';
import { useSyncStore } from '../state/program-sync';

/** Where the program is saved: "Saved" (online), "Saving…", or "Saved on this device" while offline. */
export function SyncIndicator() {
  const m = useMessages(programmingMessages);
  const status = useSyncStore((s) => s.status);
  const message = useSyncStore((s) => s.message);
  if (status === 'idle') return null;
  const view =
    status === 'saving'
      ? { icon: <Loader2 size={14} className="animate-spin" />, text: m.syncSaving, cls: 'text-muted' }
      : status === 'saved'
        ? { icon: <Check size={14} strokeWidth={3} />, text: m.syncSaved, cls: 'text-[#86efac]' }
        : status === 'offline'
          ? { icon: <CloudOff size={14} />, text: m.syncOffline, cls: 'text-[#fde68a]' }
          : { icon: <AlertTriangle size={14} />, text: m.syncError, cls: 'text-[#fca5a5]' };
  const body = (
    <span role="status" aria-live="polite" aria-label={view.text} title={message ?? view.text} className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${view.cls}`}>
      {view.icon}
      <span className="hidden lg:inline">{view.text}</span>
    </span>
  );
  return message ? <Tooltip label={message}>{body}</Tooltip> : body;
}
