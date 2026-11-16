import { Activity, BookCheck, CheckCircle2, Eye, Gauge, Layers, Repeat, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { RouteLink } from '../../../router/RouteLink';
import { adminPaths } from '../../admin-routes';
import { activityApi } from '../../api/endpoints';
import type { ActivityItem } from '../../api/types';
import { useResource } from '../../data/use-resource';
import { formatNumber, formatPercent, relativeTime } from '../../lib/format';
import { actionLabel, actionTone } from '../../lib/labels';
import { can } from '../../session/access';
import { useSessionStore } from '../../session/session-store';
import { ColumnChart } from '../../ui/charts';
import { PageHeader } from '../../ui/layout';
import { Badge, Card, EmptyState, ErrorState, Spinner } from '../../ui/primitives';

function StatCard({ icon: Icon, label, value, hint, to }: { icon: LucideIcon; label: string; value: string; hint?: string; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-adm-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-adm-accent-soft text-adm-accent">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-2 text-[26px] leading-none font-semibold text-adm-ink">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-adm-muted">{hint}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-adm-line bg-adm-surface p-4 shadow-adm';
  return to ? (
    <RouteLink to={to} className={`${cls} transition-colors hover:border-adm-accent/40`}>
      {body}
    </RouteLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** One feed line: "Nguyễn Văn A completed First Steps", "Admin unlocked Bridge Crossing for Lê Minh C". */
export function describeActivity(a: ActivityItem): string {
  const student = a.studentName ?? 'a student';
  const level = a.levelTitle ?? 'a level';
  switch (a.type) {
    case 'LEVEL_COMPLETED':
      return `${student} completed ${level}`;
    case 'UNLOCK_LEVEL':
      return `${a.actor ?? 'An admin'} unlocked ${level} for ${student}`;
    case 'LOCK_LEVEL':
      return `${a.actor ?? 'An admin'} locked ${level} for ${student}`;
    case 'CREATE_STUDENT':
      return `${a.actor ?? 'An admin'} created student ${student}`;
    case 'DISABLE_STUDENT':
      return `${a.actor ?? 'An admin'} disabled ${student}`;
    case 'RESET_PASSWORD':
      return `${a.actor ?? 'An admin'} reset the password of ${student}`;
    case 'PUBLISH_LEVEL':
      return `${a.actor ?? 'An admin'} published ${level}`;
    case 'UNPUBLISH_LEVEL':
      return `${a.actor ?? 'An admin'} unpublished ${level}`;
    case 'REVIEW_LEVEL':
      return `${a.actor ?? 'An admin'} sent ${level} for review`;
    case 'PUBLISH_WORLD':
      return `${a.actor ?? 'An admin'} published world ${a.entityName ?? ''}`.trim();
    default:
      return `${a.actor ?? 'Someone'}: ${actionLabel(a.type).toLowerCase()}`;
  }
}

export function DashboardPage() {
  const user = useSessionStore((s) => s.user);
  const allowed = can(user, 'statistics.view');
  const res = useResource(allowed ? 'dashboard' : null, () => activityApi.dashboard(), ['activity', 'students', 'levels', 'access']);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.displayName ?? ''}. Here is what is happening in OneRoboLab.`} />
      {!allowed ? (
        <Card>
          <EmptyState icon={Gauge} title="Statistics are not part of your role">
            Use the navigation to open the areas you manage.
          </EmptyState>
        </Card>
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-4 2xl:grid-cols-7">
            <StatCard icon={Users} label="Total students" value={formatNumber(res.data.totals.totalStudents)} to={adminPaths.students()} />
            <StatCard icon={UserCheck} label="Active students" value={formatNumber(res.data.totals.activeStudents)} hint="Signed in or played in the last 7 days" />
            <StatCard
              icon={Layers}
              label="Levels published"
              value={formatNumber(res.data.totals.levelsPublished)}
              hint={res.data.totals.levelsInReview ? `${res.data.totals.levelsInReview} waiting for review` : 'None waiting for review'}
              to={adminPaths.levels()}
            />
            <StatCard icon={BookCheck} label="Levels completed" value={formatNumber(res.data.totals.levelsCompleted)} hint="Student × level completions" />
            <StatCard icon={Activity} label="Attempts today" value={formatNumber(res.data.totals.attemptsToday)} to={adminPaths.attempts()} />
            <StatCard icon={CheckCircle2} label="Completion rate" value={formatPercent(res.data.totals.completionRate)} hint="Of levels students started" />
            <StatCard icon={Repeat} label="Avg. attempts / level" value={String(res.data.totals.avgAttemptsPerLevel)} hint="Per student and level" />
          </div>

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
            <Card title="Attempts, last 14 days" actions={<RouteLink to={adminPaths.analytics()} className="text-[13px] font-medium text-adm-accent hover:underline">Analytics</RouteLink>}>
              <ColumnChart
                label="Attempts and passed attempts per day, last 14 days"
                days={res.data.attemptsByDay.map((d) => d.day)}
                series={[
                  { label: 'Attempts', color: 'var(--color-adm-accent)', values: res.data.attemptsByDay.map((d) => d.attempts) },
                  { label: 'Passed', color: '#12b76a', values: res.data.attemptsByDay.map((d) => d.passed) },
                ]}
              />
            </Card>
            <Card title="Recent activity" padded={false} actions={can(user, 'audit.view') && <RouteLink to={adminPaths.audit()} className="text-[13px] font-medium text-adm-accent hover:underline">Audit log</RouteLink>}>
              {res.data.recentActivity.length === 0 ? (
                <EmptyState icon={Eye} title="No activity yet" />
              ) : (
                <ul className="divide-y divide-adm-line">
                  {res.data.recentActivity.map((a, i) => (
                    <li key={`${a.type}${a.at}${i}`} className="flex items-start gap-3 px-4 py-2.5">
                      <Badge tone={actionTone(a.type)} className="mt-0.5 w-28 justify-center">
                        {a.type === 'LEVEL_COMPLETED' ? 'Completed' : actionLabel(a.type).split(' ')[0]}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-adm-ink">
                          {a.studentId && can(user, 'students.view') ? (
                            <RouteLink to={adminPaths.student(a.studentId, 'progress')} className="hover:text-adm-accent hover:underline">
                              {describeActivity(a)}
                            </RouteLink>
                          ) : (
                            describeActivity(a)
                          )}
                        </p>
                        <p className="text-xs text-adm-muted">{relativeTime(a.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
