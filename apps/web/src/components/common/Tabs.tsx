import { cn } from '../../utils/cn';

export interface TabOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface TabsProps<T extends string> {
  label: string;
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
  /** `folder` = large file-tab look (Blocks/Python); `pill` = compact. */
  variant?: 'folder' | 'pill';
  className?: string;
}

export function Tabs<T extends string>({ label, value, options, onChange, variant = 'pill', className }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex items-end gap-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'font-medium transition-colors duration-150',
              variant === 'folder'
                ? cn(
                    'h-11 min-w-[150px] rounded-t-[12px] px-6 text-[16px]',
                    active
                      ? 'bg-primary-strong text-white'
                      : 'bg-panel-2 text-muted hover:bg-panel-3 hover:text-text',
                  )
                : cn(
                    'h-9 rounded-t-[10px] px-5 text-[14px]',
                    active ? 'bg-primary-strong text-white' : 'bg-panel-2/70 text-muted hover:text-text',
                  ),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
