import { AlertTriangle, ArrowRight, Award, Check, Circle, CloudOff, Code2, Flag, Loader2, Map, RotateCcw, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { buttonClass } from '../../../components/common/Button';
import { cn } from '../../../utils/cn';
import { AudioManager } from '../../audio/audio-manager';
import { startMission } from '../../level-selection/start-mission';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { useLevelStore } from '../level-store';
import { StarRow } from './StarRow';
import { rankOf, scoreRun } from '@robolab/scoring-engine';
import { RANK_STYLE, rankLabel } from '../../../components/simulator/rank';
import { useMessages } from '../../i18n/i18n';
import { levelsMessages } from '../levels.messages';
import { formatNumber } from '../../i18n/i18n';
import { LevelRegistry } from '../../../content/levels/registry';
import { useRuntimeStore } from '../../simulator/runtime/runtime-store';


/** Level complete / robot stopped / not-there-yet panel over the simulator. */
export function LevelResultPanel({ onEditCode }: { onEditCode?: () => void }) {
  const m = useMessages(levelsMessages);
  const result = useLevelStore((s) => s.result);
  const retry = useLevelStore((s) => s.retry);
  const levelId = useLevelStore((s) => s.levelId);

  useEffect(() => {
    if (result?.kind === 'success') AudioManager.play('levelComplete');
  }, [result]);

  if (!result) return null;

  if (result.kind === 'success') {
    const met = result.criteria.filter((c) => c.met).length;
    // Server-judged objectives when saved; otherwise the star goals measured in the browser.
    const checklist = result.objectives ? result.objectives.map((o) => ({ id: o.code, label: o.title, met: o.completed })) : result.criteria;
    return (
      <section role="dialog" aria-label={m.missionComplete} className="pointer-events-auto glass max-h-full w-[min(380px,100%)] overflow-y-auto rounded-[var(--radius-dialog)] p-4 text-center animate-pop-in sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Trophy size={24} />
        </div>
        <h2 className="mt-3 font-display text-[22px] font-extrabold text-white">{m.missionComplete}</h2>
        <StarRow stars={result.stars} size={34} animate className="mt-2 justify-center" />
        <div className="mt-2 flex min-h-7 items-center justify-center gap-2">
          {result.sync === 'saving' && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-muted" role="status">
              <Loader2 size={13} className="animate-spin" /> {m.saving}
            </span>
          )}
          {result.xpEarned !== null && result.xpEarned > 0 && (
            <span className="rounded-full bg-[#facc15]/15 px-3 py-1 font-display text-[15px] font-extrabold text-[#fde047]">{m.xpEarned({ xp: formatNumber(result.xpEarned) })}</span>
          )}
          {result.xpEarned === 0 && <span className="text-[12px] text-muted">{m.xpAlready}</span>}
          {result.newBest && result.sync !== 'saving' && <span className="text-[12px] font-semibold text-[#fbbf24]">{m.newBest}</span>}
        </div>
        <ul className="mx-auto mt-3 w-fit space-y-1 text-left" aria-label={m.objectives}>
          {checklist.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-2 text-[13px]', c.met ? 'text-[#dcfce7]' : 'text-faint')}>
              {c.met ? <Check size={14} strokeWidth={3} className="text-success" /> : <Circle size={12} />}
              {c.label}
            </li>
          ))}
        </ul>
        <ScoreSummary time={result.time} blockCount={result.blockCount} />
        <p className="mt-3 text-[12px] text-muted">
          {m.starGoalsLine({ met, total: result.criteria.length, time: result.time.toFixed(1), blocks: result.blockCount })}
        </p>
        {result.achievements.length > 0 && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#c4b5fd]">
            <Award size={14} /> {m.newAchievements({ n: result.achievements.length, names: result.achievements.map((a) => a.replace(/-/g, ' ')).join(', ') })}
          </p>
        )}
        {result.note && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/35 bg-warning/10 px-3 py-2 text-left text-[12.5px] text-[#fde68a]">
            <CloudOff size={14} className="mt-0.5 shrink-0" /> {result.note}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {result.nextLevelId ? (
            <button type="button" autoFocus onClick={() => result.nextLevelId && startMission(result.nextLevelId, 'result')} className={buttonClass('go', 'col-span-2 min-h-12')}>
              {m.nextMission} <ArrowRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={() => navigate(paths.worldMap())} className={buttonClass('primary', 'col-span-2 min-h-12')}>
              <Map size={15} /> {m.worldMap}
            </button>
          )}
          <button type="button" onClick={retry} className={buttonClass('outline', 'min-h-11')}>
            <RotateCcw size={15} /> {m.replay}
          </button>
          <button type="button" onClick={() => {
              retry();
              onEditCode?.();
            }} className={buttonClass('outline', 'min-h-11')}>
            <Code2 size={15} /> {m.editProgram}
          </button>
        </div>
      </section>
    );
  }

  const failure = result.kind === 'failure';
  const title = failure ? result.title : m.notThereYet;
  return (
    <section
      role="alertdialog"
      aria-label={title}
      className={cn(
        'pointer-events-auto glass max-h-full w-[min(400px,100%)] overflow-y-auto rounded-[var(--radius-dialog)] animate-pop-in',
        failure ? 'border-danger/30' : 'border-warning/25',
      )}
    >
      <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex items-start gap-3.5">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', failure ? 'bg-danger/15 text-[#fca5a5]' : 'bg-warning/15 text-[#fcd34d]')}>
            {failure ? <AlertTriangle size={22} /> : <Flag size={22} />}
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="font-display text-[20px] font-black leading-tight text-white">{title}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#cbd5e1]">{result.message}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button type="button" autoFocus onClick={retry} className={buttonClass('primary', 'min-h-11 flex-1')}>
            <RotateCcw size={16} className="shrink-0" /> {m.tryAgain}
          </button>
          <button type="button" onClick={() => {
              retry();
              onEditCode?.();
            }} className={buttonClass('outline', 'min-h-11 flex-1')}>
            <Code2 size={16} className="shrink-0" /> {m.editProgram}
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] leading-snug text-faint">{m.programKept}</p>
      </div>
    </section>
  );
}

/** Points breakdown and rank of the run (scoring engine preview of the same formula the server uses). */
function ScoreSummary({ time, blockCount }: { time: number; blockCount: number }) {
  const m = useMessages(levelsMessages);
  const levelId = useLevelStore((s) => s.levelId);
  const mission = useRuntimeStore((s) => s.mission);
  const level = LevelRegistry.get(levelId);
  const scoreItemLabel = (key: string, fallback: string) => ({ completion: m.scoreCompletion, checkpoints: m.scoreCheckpoints, bonus: m.scoreBonus, time: m.scoreTime, efficiency: m.scoreEfficiency, collisions: m.scoreCollisions })[key as 'time'] ?? fallback;
  if (!level || !mission || mission.missionId !== level.mission.id) return null;
  const score = scoreRun({ rules: level.mission.scoring, mission, stats: { elapsed: time, collisions: mission.collisionCount, blockCount, distanceTravelled: 0 } });
  const rank = rankOf(score.total, score.max, mission.status === 'success');
  return (
    <div className="mx-auto mt-3 w-full max-w-[280px] rounded-[var(--radius-control)] bg-white/[0.04] px-3 py-2 text-left">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white">
          <span className="tabular">{score.total}</span> <span className="text-muted">{m.scoreMax({ max: score.max })}</span>
        </span>
        {rank !== 'none' && <span className={cn('rounded-full px-2 py-px text-[11.5px] font-bold', RANK_STYLE[rank].chip)}>{rankLabel(rank)}</span>}
      </div>
      <ul className="mt-1 space-y-0.5">
        {score.items.map((i) => (
          <li key={i.key} className="flex justify-between text-[12px] text-[#cbd5e1]">
            <span>{scoreItemLabel(i.key, i.label)}</span>
            <span className={cn('tabular', i.points < 0 && 'text-[#fca5a5]')}>{i.points > 0 ? `+${i.points}` : i.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
