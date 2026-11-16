import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { activityApi } from '../../api/endpoints';
import type { AuditLog } from '../../api/types';
import { useResource } from '../../data/use-resource';
import { formatDateTime, formatNumber } from '../../lib/format';
import { actionLabel, actionTone, auditDetails, entityLabel } from '../../lib/labels';
import { DataTable, Pagination, type Column } from '../../ui/DataTable';
import { Select, TextInput } from '../../ui/form';
import { FilterBar, PageHeader } from '../../ui/layout';
import { Drawer } from '../../ui/overlay';
import { Badge, Card, DescriptionList, EmptyState, ErrorState } from '../../ui/primitives';

const PAGE_SIZE = 50;

/** Filterable actions (grouped for the select). */
const ACTION_FILTERS: readonly { group: string; actions: readonly string[] }[] = [
  { group: 'Students', actions: ['CREATE_STUDENT', 'UPDATE_STUDENT', 'DISABLE_STUDENT', 'ENABLE_STUDENT', 'RESET_PASSWORD'] },
  { group: 'Access', actions: ['UNLOCK_LEVEL', 'LOCK_LEVEL', 'CLEAR_LEVEL_ACCESS', 'SET_PREREQUISITES'] },
  { group: 'Publishing', actions: ['REVIEW_LEVEL', 'REJECT_LEVEL', 'PUBLISH_LEVEL', 'UNPUBLISH_LEVEL', 'ARCHIVE_LEVEL', 'RESTORE_LEVEL', 'PUBLISH_WORLD', 'PUBLISH_CURRICULUM', 'PUBLISH_LESSON'] },
  { group: 'Content', actions: ['CREATE_LEVEL', 'UPDATE_LEVEL', 'DELETE_LEVEL', 'CREATE_WORLD', 'UPDATE_WORLD', 'CREATE_CURRICULUM', 'CREATE_LESSON', 'CREATE_ACHIEVEMENT'] },
];

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-adm-muted">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-lg bg-adm-subtle p-3 font-mono text-[12px] leading-5 text-adm-body ring-1 ring-adm-line">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLog | null>(null);
  const query = { action: action || undefined, entityType: entityType || undefined, from: from || undefined, to: to || undefined, page, pageSize: PAGE_SIZE };
  const res = useResource(`audit:${JSON.stringify(query)}`, () => activityApi.auditLogs(query), ['activity', 'students', 'levels', 'access'], { keepPrevious: true });
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const columns: Column<AuditLog>[] = [
    { key: 'date', header: 'Date', width: '150px', cell: (l) => <span className="tabular whitespace-nowrap">{formatDateTime(l.createdAt)}</span> },
    { key: 'admin', header: 'Admin', cell: (l) => l.adminName ?? l.adminUsername ?? <span className="text-adm-faint">System</span> },
    { key: 'action', header: 'Action', cell: (l) => <Badge tone={actionTone(l.action)}>{actionLabel(l.action)}</Badge> },
    { key: 'entity', header: 'Entity', cell: (l) => <span className="text-adm-muted">{entityLabel(l.entityType)}</span> },
    {
      key: 'details',
      header: 'Details',
      cell: (l) => {
        const lines = auditDetails(l);
        return lines.length ? (
          <span className="flex flex-col text-[13px] leading-5 text-adm-body">
            {lines.slice(0, 3).map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        ) : (
          <span className="text-adm-faint">—</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change made by staff, newest first. Entries can’t be edited or deleted." />
      <Card padded={false}>
        <FilterBar trailing={res.data && <span className="text-sm text-adm-muted">{formatNumber(res.data.total)} entries</span>}>
          <Select aria-label="Action" className="w-60" value={action} onChange={(e) => reset(setAction)(e.target.value)}>
            <option value="">All actions</option>
            {ACTION_FILTERS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.actions.map((a) => (
                  <option key={a} value={a}>
                    {actionLabel(a)}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select aria-label="Entity" className="w-48" value={entityType} onChange={(e) => reset(setEntityType)(e.target.value)}>
            <option value="">All entities</option>
            {['user', 'student_level_access', 'level', 'world', 'curriculum', 'lesson', 'achievement', 'level_objective', 'level_hint', 'level_checkpoint'].map((t) => (
              <option key={t} value={t}>
                {entityLabel(t)}
              </option>
            ))}
          </Select>
          <span className="flex items-center gap-1.5 text-sm text-adm-muted">
            <TextInput type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="w-38" />–
            <TextInput type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="w-38" />
          </span>
        </FilterBar>
        {res.error ? (
          <div className="p-4">
            <ErrorState error={res.error} onRetry={res.reload} />
          </div>
        ) : (
          <DataTable
            label="Audit log"
            rows={res.data?.logs}
            loading={res.refreshing}
            columns={columns}
            rowKey={(l) => l.id}
            onRowClick={setOpen}
            empty={<EmptyState icon={ScrollText} title="No entries match these filters" />}
          />
        )}
        {res.data && res.data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={res.data.total} onPage={setPage} />}
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? actionLabel(open.action) : ''} subtitle={open && formatDateTime(open.createdAt)} width={620}>
        {open && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                ['Admin', open.adminName ?? open.adminUsername ?? 'System'],
                ['Entity', entityLabel(open.entityType)],
                ['IP address', open.ipAddress ?? '—'],
                ['Request id', <span className="font-mono text-xs">{open.requestId ?? '—'}</span>],
              ]}
            />
            {auditDetails(open).length > 0 && (
              <ul className="list-disc pl-5 text-sm text-adm-body">
                {auditDetails(open).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <JsonBlock label="Before" value={open.oldData} />
            <JsonBlock label="After" value={open.newData} />
          </div>
        )}
      </Drawer>
    </>
  );
}
