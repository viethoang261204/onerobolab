import { Search, X } from 'lucide-react';

/** Instant local block search. */
export function BlockSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-white/8 bg-[#0a1424] px-2.5 focus-within:border-cyan/50 focus-within:shadow-[0_0_0_3px_rgb(34_211_238/0.12)]">
      <Search size={15} className="shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('');
        }}
        placeholder="Search blocks…"
        aria-label="Search blocks"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="text-faint hover:text-text">
          <X size={14} />
        </button>
      )}
    </label>
  );
}
