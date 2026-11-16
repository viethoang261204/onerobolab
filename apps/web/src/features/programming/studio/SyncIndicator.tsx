import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';
import { Tooltip } from '../../../components/common/Tooltip';
import { useSyncStore } from '../state/program-sync';

/** Where the program is saved: "Saved" (online), "Saving…", or "Saved on this device" while offline. */
export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const message = useSyncStore((s) => s.message);
  if (status === 'idle') return null;
  const view =
    status === 'saving'
      ? { icon: <Loader2 size={14} className="animate-spin" />, text: 'Saving…', cls: 'text-muted' }
      : status === 'saved'
        ? { icon: <Check size={14} strokeWidth={3} />, text: 'Saved', cls: 'text-[#86efac]' }
        : status === 'offline'
          ? { icon: <CloudOff size={14} />, text: 'Saved on this device', cls: 'text-[#fde68a]' }
          : { icon: <AlertTriangle size={14} />, text: 'Not saved online', cls: 'text-[#fca5a5]' };
  const body = (
    <span role="status" aria-live="polite" className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${view.cls}`}>
      {view.icon}
      {view.text}
    </span>
  );
  return message ? <Tooltip label={message}>{body}</Tooltip> : body;
}
