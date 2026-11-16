import { useMemo, useState } from 'react';
import { contentApi, studentsApi } from '../api/endpoints';
import type { GraphLevel } from '../api/types';
import { useResource } from '../data/use-resource';
import { Select, SearchInput } from '../ui/form';
import { Avatar, cx } from '../ui/primitives';

/** All levels grouped by world (from the unlock graph endpoint, available to every staff role that needs it). */
export function useLevelOptions() {
  return useResource('levels:graph', () => contentApi.levelGraph(), ['levels']);
}

export function LevelSelect({
  value,
  onChange,
  exclude,
  placeholder = 'Choose a level…',
  levels,
  ...rest
}: {
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
  placeholder?: string;
  levels: readonly GraphLevel[] | undefined;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string | undefined;
  'aria-label'?: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, GraphLevel[]>();
    for (const l of levels ?? []) if (l.id !== exclude) map.set(l.worldName, [...(map.get(l.worldName) ?? []), l]);
    return [...map];
  }, [levels, exclude]);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{levels ? placeholder : 'Loading levels…'}</option>
      {groups.map(([world, list]) => (
        <optgroup key={world} label={world}>
          {list.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
              {l.status !== 'PUBLISHED' ? ` (${l.status.toLowerCase()})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/** Search-as-you-type student chooser. */
export function StudentPicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (s: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const res = useResource(term.length >= 1 ? `students:pick:${term}` : null, () => studentsApi.list({ search: term, pageSize: 8, status: 'ACTIVE' }));
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-adm-line-strong bg-adm-subtle px-3 py-2">
        <span className="flex items-center gap-2 text-sm text-adm-ink">
          <Avatar name={value.name} size={24} /> {value.name}
        </span>
        <button type="button" className="text-xs font-medium text-adm-accent hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <SearchInput value={q} onChange={setQ} placeholder="Search by name or username" label="Find a student" />
      {term && (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-adm-line" role="listbox" aria-label="Matching students">
          {res.loading && <li className="px-3 py-2 text-sm text-adm-muted">Searching…</li>}
          {res.data?.students.length === 0 && <li className="px-3 py-2 text-sm text-adm-muted">No active student matches.</li>}
          {res.data?.students.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onChange({ id: s.id, name: s.displayName })}
                className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-adm-accent-soft')}
              >
                <Avatar name={s.displayName} size={24} />
                <span className="flex-1 text-adm-ink">{s.displayName}</span>
                <span className="font-mono text-xs text-adm-muted">{s.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
