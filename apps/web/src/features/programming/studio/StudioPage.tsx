import { AlertTriangle, ArrowLeft, Check, CircleHelp, FlaskConical, Save, Settings } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, type TabOption } from '../../../components/common/Tabs';
import { Tooltip } from '../../../components/common/Tooltip';
import { ConsolePanel } from '../../../components/panels/ConsolePanel';
import { LevelRegistry } from '../../../content/levels/registry';
import { WorldRegistry } from '../../../content/worlds/registry';
import { useUiStore } from '../../../stores/ui-store';
import type { CodeTab } from '../../../types/ui';
import { cn } from '../../../utils/cn';
import { openSimulator } from '../../level-selection/start-mission';
import { currentLevel, useLevelStore } from '../../levels/level-store';
import { useLevelRoute } from '../../levels/use-level-route';
import { OnboardingTour } from '../../onboarding/OnboardingTour';
import { useOnboardingStore } from '../../onboarding/onboarding-store';
import { RouteLink } from '../../router/RouteLink';
import { navigate } from '../../router/router-store';
import { paths } from '../../router/routes';
import { SettingsPanel } from '../../settings/SettingsPanel';
import { useSettingsStore } from '../../settings/settings-store';
import { BlockEditor } from '../editor/BlockEditor';
import { ProgrammingOverlays } from '../editor/ProgrammingOverlays';
import { generatePython } from '../generators/python-generator';
import { PythonView } from '../generators/PythonView';
import { flushProgramSave, useProgramStore } from '../state/program-store';
import { PythonEditor } from '../python/PythonEditor';
import { PythonReference } from '../python/PythonReference';
import type { EditorMode } from '../../../content/levels/types';
import { BlockToolbox } from '../toolbox/BlockToolbox';
import { MissionBrief } from './MissionBrief';
import { checkProgram } from './program-check';
import { useStudentSession } from '../../account/session-store';
import { flushProgram } from '../state/program-sync';
import { SyncIndicator } from './SyncIndicator';
import { buttonClass } from '../../../components/common/Button';

/** Editor tabs per mission stage: blocks (Python preview), side by side, or Python first. */
const TABS: Readonly<Record<EditorMode, readonly TabOption<CodeTab>[]>> = {
  blocks: [
    { value: 'blocks', label: 'Blocks' },
    { value: 'python', label: 'Python' },
  ],
  split: [
    { value: 'blocks', label: 'Blocks' },
    { value: 'split', label: 'Blocks ⇄ Python' },
    { value: 'python', label: 'Python' },
  ],
  python: [
    { value: 'python', label: 'Python' },
    { value: 'blocks', label: 'Blocks' },
  ],
};
const DEFAULT_TAB: Readonly<Record<EditorMode, CodeTab>> = { blocks: 'blocks', split: 'split', python: 'python' };

const iconButton = 'flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] text-[#dbe4f3] transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.09] hover:text-white';

function PythonTab() {
  const program = useProgramStore((s) => s.program);
  const source = useMemo(() => generatePython(program), [program]);
  return <PythonView source={source} />;
}

/** Ready / N problems / empty, from the live validation in the program store. */
function ProgramStatus() {
  const program = useProgramStore((s) => s.program);
  const errors = useProgramStore((s) => s.errorCount);
  const warnings = useProgramStore((s) => s.warningCount);
  const check = checkProgram(program, errors);
  const [label, tone] = check.ok
    ? [warnings ? `Ready · ${warnings} warning${warnings > 1 ? 's' : ''}` : 'Ready to test', warnings ? 'bg-warning' : 'bg-success']
    : check.reason === 'empty'
      ? ['Empty program', 'bg-faint']
      : [`${errors} problem${errors > 1 ? 's' : ''}`, 'bg-danger'];
  return (
    <span className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#dbe4f3]" role="status" aria-live="polite">
      <span className={cn('h-2 w-2 rounded-full', tone)} /> {label}
    </span>
  );
}

/**
 * `/studio/:levelId` — Code Studio: the programming screen. Wide block
 * canvas, toolbox, mission brief and console; no 3D. "Test in Simulator"
 * saves, validates and opens the simulator on the same level and program.
 */
export default function StudioPage({ levelId }: { levelId: string | null }) {
  useLevelRoute(levelId, paths.studio);
  const id = useLevelStore((s) => s.levelId);
  const level = useMemo(() => LevelRegistry.get(id) ?? currentLevel(), [id]);
  const world = WorldRegistry.get(level.world);
  const mode: EditorMode = level.editor ?? 'blocks';
  const storedTab = useUiStore((s) => s.codeTab);
  const tab: CodeTab = TABS[mode].some((t) => t.value === storedTab) ? storedTab : DEFAULT_TAB[mode];
  const setTab = useUiStore((s) => s.setCodeTab);
  // Respect the student's chosen coding mode (Blocks or Python) unless the mission requires split view.
  useEffect(() => {
    const preferred = useSettingsStore.getState().codingLanguage;
    useUiStore.getState().setCodeTab(level.editor === 'split' ? 'split' : preferred);
  }, [level.id, level.editor]);
  const editablePython = mode !== 'blocks';
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const startTour = useOnboardingStore((s) => s.start);

  useEffect(() => {
    const t = setTimeout(() => useOnboardingStore.getState().onScreenReady('studio'), 700);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => flushProgramSave(), []);
  // Coding means the briefing has been read: don't show it again on Test in Simulator.
  useEffect(() => useLevelStore.getState().dismissIntro(), [id]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.tone === 'ok' ? 1800 : 4200);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => !settingsRef.current?.contains(e.target as Node) && setSettingsOpen(false);
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [settingsOpen]);

  const save = () => {
    flushProgramSave();
    if (!useStudentSession.getState().user) return setNotice({ tone: 'ok', text: 'Program saved' });
    // Signed in: also keep a version on the server (autosave keeps the latest anyway).
    void flushProgram({ createVersion: true }).then((ok) => setNotice(ok ? { tone: 'ok', text: 'Program saved' } : { tone: 'ok', text: 'Saved on this device — it will upload when you’re back online' }));
  };
  const test = () => {
    const { program, errorCount } = useProgramStore.getState();
    const check = checkProgram(program, errorCount);
    // An empty program is fine (Run then does nothing); only real problems stop the test.
    if (!check.ok && check.reason === 'errors') {
      setNotice({ tone: 'error', text: check.message });
      return;
    }
    flushProgramSave();
    // The version the student tests is kept on the server (runs snapshot it too).
    if (useStudentSession.getState().user) void flushProgram({ createVersion: true });
    openSimulator(level.id);
  };

  return (
    <div className="flex h-full min-h-[640px] min-w-[1024px] flex-col bg-bg animate-page-in">
      <header className="relative z-30 flex h-16 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-[#0a1424] px-4">
        <RouteLink to="/" aria-label="OneRoboLab home" className="flex items-center">
          <svg width="34" height="34" viewBox="0 0 44 44" aria-hidden="true">
            <path d="M22 2.5 39 12.2v19.6L22 41.5 5 31.8V12.2z" fill="#6d5cf5" />
            <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round">
              <path d="M22 12.5l9 5.2v10.6l-9 5.2-9-5.2V17.7z" />
              <path d="M13 17.7l9 5.2 9-5.2M22 22.9v10.6" />
            </g>
          </svg>
        </RouteLink>
        <button type="button" onClick={() => navigate(paths.level(level.world, level.id))} className="flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[13.5px] font-semibold text-[#cbd5e1] hover:bg-white/8 hover:text-white">
          <ArrowLeft size={16} /> Mission
        </button>
        <div className="min-w-0 border-l border-white/10 pl-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: world?.color }}>
            Code Studio · Mission {LevelRegistry.code(level)}
          </div>
          <h1 className="truncate font-display text-[19px] font-black leading-tight text-white">{level.title}</h1>
        </div>
        <Tabs variant="pill" label="Editor mode" value={tab} options={TABS[mode]} onChange={setTab} className="ml-4" />

        <div className="ml-auto flex items-center gap-2.5">
          <SyncIndicator />
          <ProgramStatus />
          <Tooltip label="Save now (programs also save automatically)">
            <button type="button" onClick={save} className={cn(iconButton, 'w-auto gap-1.5 px-3 text-[13px] font-semibold')}>
              <Save size={16} /> Save
            </button>
          </Tooltip>
          <Tooltip label="Show the Code Studio tour">
            <button type="button" aria-label="Help" className={iconButton} onClick={() => startTour('studio')}>
              <CircleHelp size={18} />
            </button>
          </Tooltip>
          <div ref={settingsRef} className="relative">
            <button type="button" aria-label="Settings" aria-expanded={settingsOpen} className={iconButton} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings size={18} />
            </button>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
          <button
            type="button"
            data-tour="test"
            onClick={test}
            className={buttonClass('go', 'px-5')}
          >
            <FlaskConical size={18} /> Test in Simulator
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {tab === 'python' && editablePython ? <PythonReference /> : <BlockToolbox />}
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          <div className="flex min-h-0 flex-1 gap-3">
            <section data-tour="editor" aria-label="Program editor" className="relative flex min-w-0 flex-1 flex-col rounded-[16px] border border-white/6 bg-panel-2 p-2">
              {tab === 'blocks' ? (
                <BlockEditor />
              ) : tab === 'split' ? (
                <div className="flex min-h-0 flex-1 gap-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <BlockEditor />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <PythonEditor />
                  </div>
                </div>
              ) : editablePython ? (
                <PythonEditor />
              ) : (
                <PythonTab />
              )}
              {notice && (
                <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-[var(--radius-control)] border border-white/10 bg-[#0f1b2e]/95 py-2.5 pl-3.5 pr-4 text-[13.5px] text-[#e2e8f0] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] animate-pop-in">
                  {notice.tone === 'ok' ? <Check size={17} className="shrink-0 text-[#4ade80]" aria-hidden="true" /> : <AlertTriangle size={17} className="shrink-0 text-[#f87171]" aria-hidden="true" />} {notice.text}
                </div>
              )}
            </section>
            <MissionBrief level={level} />
          </div>
          <div className="h-[196px] shrink-0 max-[800px]:h-[150px]">
            <ConsolePanel />
          </div>
        </main>
      </div>
      <ProgrammingOverlays />
      <OnboardingTour />
    </div>
  );
}
