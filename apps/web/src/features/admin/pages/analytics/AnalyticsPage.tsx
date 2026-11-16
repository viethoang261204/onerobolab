import { useState } from 'react';
import { RouteLink } from '../../../router/RouteLink';
import { adminPaths } from '../../admin-routes';
import { activityApi } from '../../api/endpoints';
import type { Statistics } from '../../api/types';
import { StatusBadge } from '../../components/WorkflowControl';
import { useResource } from '../../data/use-resource';
import { formatDuration, formatNumber, formatPercent, percentOf } from '../../lib/format';
import { BarList, ColumnChart } from '../../ui/charts';
import { DataTable, type Column } from '../../ui/DataTable';
import { Segmented } from '../../ui/form';
import { PageHeader } from '../../ui/layout';
import { Card, ErrorState, Spinner } from '../../ui/primitives';

type LevelStat = Statistics['levels'][number];

export function AnalyticsPage() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const res = useResource(`statistics:${days}`, () => activityApi.statistics(Number(days)), ['activity', 'levels', 'students'], { keepPrevious: true });

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  const s = res.data;

  const columns: Column<LevelStat>[] = [
    {
      key: 'level',
      header: 'Level',
      cell: (l) => (
        <RouteLink to={adminPaths.level(l.levelId)} className="block min-w-0 hover:text-adm-accent">
          <span className="block truncate font-medium text-adm-ink">{l.title}</span>
          <span className="block text-xs text-adm-muted">{l.worldName}</span>
        </RouteLink>
      ),
    },
    { key: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
    { key: 'students', header: 'Students tried', align: 'right', cell: (l) => <span className="tabular">{formatNumber(l.studentsAttempted)}</span> },
    { key: 'completed', header: 'Completed', align: 'right', cell: (l) => <span className="tabular">{formatNumber(l.studentsCompleted)}</span> },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (l) => <span className="tabular">{formatNumber(l.attempts)}</span> },
    { key: 'avg', header: 'Avg. attempts', align: 'right', cell: (l) => <span className="tabular">{l.avgAttempts ?? '—'}</span> },
    { key: 'pass', header: 'Pass rate', align: 'right', cell: (l) => <span className="tabular">{formatPercent(l.passRatePercent)}</span> },
    { key: 'stars', header: 'Avg. stars', align: 'right', cell: (l) => <span className="tabular">{l.avgBestStars ?? '—'}</span> },
    { key: 'time', header: 'Avg. best time', align: 'right', cell: (l) => <span className="tabular">{formatDuration(l.avgBestTime)}</span> },
  ];

  const hardest = s ? [...s.levels].filter((l) => l.attempts > 0).sort((a, b) => (a.passRatePercent ?? 0) - (b.passRatePercent ?? 0)).slice(0, 6) : [];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="How students progress through the curriculum."
        actions={
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />
      {!s ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-6 gap-4">
            {(
              [
                ['Students', s.totals.students],
                ['Active accounts', s.totals.activeStudents],
                ['Signed in (7 days)', s.totals.activeLast7Days],
                ['Published levels', s.totals.publishedLevels],
                ['Attempts (all time)', s.totals.attempts],
                ['Passed submissions', s.totals.passedSubmissions],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-adm-line bg-adm-surface p-4 shadow-adm">
                <p className="text-[13px] text-adm-muted">{label}</p>
                <p className="tabular mt-1 text-2xl font-semibold text-adm-ink">{formatNumber(value)}</p>
              </div>
            ))}
          </div>
          <Card title={`Activity, last ${days} days`}>
            <ColumnChart
              width={1200}
              height={220}
              label={`Attempts, passed attempts and active students per day for the last ${days} days`}
              days={s.daily.map((d) => d.day)}
              series={[
                { label: 'Attempts', color: 'var(--color-adm-accent)', values: s.daily.map((d) => d.attempts) },
                { label: 'Passed', color: '#12b76a', values: s.daily.map((d) => d.passed) },
                { label: 'Active students', color: '#f79009', values: s.daily.map((d) => d.activeStudents) },
              ]}
            />
          </Card>
          <div className="grid grid-cols-3 gap-5">
            <Card title="Completion by world">
              <BarList
                items={s.worlds.map((w) => ({ key: w.worldId, label: w.name, sublabel: `${w.publishedLevels} levels`, value: w.completions }))}
                format={(v) => `${formatNumber(v)}`}
                color="#12b76a"
              />
              <p className="mt-3 text-xs text-adm-muted">Level completions (students × levels) in each world.</p>
            </Card>
            <Card title="Hardest levels (lowest pass rate)">
              {hardest.length ? (
                <BarList items={hardest.map((l) => ({ key: l.levelId, label: l.title, sublabel: l.worldName, value: l.passRatePercent ?? 0 }))} max={100} format={(v) => formatPercent(v)} color="#f04438" />
              ) : (
                <p className="text-sm text-adm-muted">No attempts yet.</p>
              )}
            </Card>
            <Card title="Best stars on completed levels">
              <BarList
                items={s.starDistribution.filter((d) => d.stars <= 3).map((d) => ({ key: String(d.stars), label: d.stars === 0 ? 'No stars' : `${'★'.repeat(d.stars)}`, value: d.levels }))}
                format={(v) => `${formatNumber(v)} · ${formatPercent(percentOf(v, s.starDistribution.reduce((n, d) => n + d.levels, 0)))}`}
                color="#f5a524"
              />
            </Card>
          </div>
          <Card title="Levels" padded={false}>
            <DataTable label="Level statistics" rows={s.levels} columns={columns} rowKey={(l) => l.levelId} loading={res.refreshing} />
          </Card>
        </div>
      )}
    </>
  );
}
