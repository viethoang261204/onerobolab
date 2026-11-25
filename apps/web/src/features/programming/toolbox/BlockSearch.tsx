import { Search, X } from 'lucide-react';
import { useMessages } from '../../i18n/i18n';
import { programmingMessages } from '../programming.messages';

/** Instant local block search. */
export function BlockSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const m = useMessages(programmingMessages);
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-white/8 bg-[#0a1424] px-2.5 focus-within:border-cyan/50 focus-within:shadow-[0_0_0_3px_rgb(34_211_238/0.12)] lg:h-9">
      <Search size={15} className="shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('');
        }}
        placeholder={m.searchPlaceholder}
        aria-label={m.searchAria}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={m.clearSearch}
          onClick={() => onChange('')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-white/10 hover:text-text lg:h-6 lg:w-6"
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
