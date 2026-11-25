import { AlertTriangle, ArrowLeft, Blocks, BookOpen, Check, ChevronDown, ChevronUp, CircleHelp, Code2, FlaskConical, Save, Settings, Smartphone, Terminal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buttonClass } from '../../../components/common/Button';
import { Tabs, type TabOption } from '../../../components/common/Tabs';
import { Tooltip } from '../../../components/common/Tooltip';
import { ConsolePanel } from '../../../components/panels/ConsolePanel';
import { LevelRegistry } from '../../../content/levels/registry';
import type { EditorMode } from '../../../content/levels/types';
import { WorldRegistry } from '../../../content/worlds/registry';
import { useViewportWidth } from '../../../hooks/useViewportWidth';
import { useSimulationStore } from '../../../stores/simulation-store';
import { useUiStore } from '../../../stores/ui-store';
import type { CodeTab } from '../../../types/ui';
import { cn } from '../../../utils/cn';
import { useStudentSession } from '../../account/session-store';
import { useMessages } from '../../i18n/i18n';
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
import { programmingMessages } from '../programming.messages';
import { PythonEditor } from '../python/PythonEditor';
import { PythonReference } from '../python/PythonReference';
import { flushProgramSave, useProgramStore } from '../state/program-store';
import { flushProgram } from '../state/program-sync';
import { BlockToolbox, type ToolboxLayoutMode } from '../toolbox/BlockToolbox';
import { MissionBrief } from './MissionBrief';
import { checkProgram } from './program-check';
import { SyncIndicator } from './SyncIndicator';

const DEFAULT_TAB: Readonly<Record<EditorMode, CodeTab>> = { blocks: 'blocks', split: 'split', python: 'python' };

const iconButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] text-[#dbe4f3] transition-colors duration-[var(--dur-fast)] hover:bg-white/[0.09] hover:text-white lg:h-10 lg:w-10';

function useIsPhonePortrait(width: number): boolean {
  const [portrait, setPortrait] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < 640 && window.innerHeight > window.innerWidth));
  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 640 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [width]);
  return portrait;
}

function PythonTab() {
  const program = useProgramStore((s) => s.program);
  const source = useMemo(() => generatePython(program), [program]);
  return <PythonView source={source} />;
}

/** Ready / N problems / empty, from the live validation in the program store. */
function ProgramStatus() {
  const m = useMessages(programmingMessages);
  const program = useProgramStore((s) => s.program);
  const errors = useProgramStore((s) => s.errorCount);
  const warnings = useProgramStore((s) => s.warningCount);
  const check = checkProgram(program, errors);
  const [label, tone] = check.ok
    ? [warnings ? m.statusReadyWarnings({ n: warnings }) : m.statusReady, warnings ? 'bg-warning' : 'bg-success']
    : check.reason === 'empty'
      ? [m.statusEmpty, 'bg-faint']
      : [m.statusProblems({ n: errors }), 'bg-danger'];
  return (
    <span className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[12.5px] font-semibold text-[#dbe4f3] lg:flex" role="status" aria-live="polite">
      <span className={cn('h-2 w-2 rounded-full', tone)} /> {label}
    </span>
  );
}

type SheetTab = 'brief' | 'console';

/**
 * `/studio/:levelId` — Code Studio: the programming screen. Wide block
 * canvas, toolbox, mission brief and console; no 3D. "Test in Simulator"
 * saves, validates and opens the simulator on the same level and program.
 *
 * Responsive:
 *   - Desktop (≥ 1024px): side-by-side toolbox, editor + console, mission brief.
 *   - Tablet (640–1023px): collapsible left icon rail + overlay toolbox drawer,
 *     and tabbed bottom sheet for Mission brief / Console.
 *   - Phone (< 640px): full-width editor, slide-over toolbox drawer, tabbed
 *     bottom sheet, and a dismissible portrait rotation hint.
 */
export default function StudioPage({ levelId }: { levelId: string | null }) {
  useLevelRoute(levelId, paths.studio);
  const m = useMessages(programmingMessages);
  const width = useViewportWidth();
  const isPhonePortrait = useIsPhonePortrait(width);
  const layoutMode: ToolboxLayoutMode = width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
  const isCompact = layoutMode !== 'desktop';

  const id = useLevelStore((s) => s.levelId);
  const level = useMemo(() => LevelRegistry.get(id) ?? currentLevel(), [id]);
  const world = WorldRegistry.get(level.world);
  const mode: EditorMode = level.editor ?? 'blocks';
  const tabsByMode: Readonly<Record<EditorMode, readonly TabOption<CodeTab>[]>> = {
    blocks: [
      { value: 'blocks', label: m.tabBlocks },
      { value: 'python', label: m.tabPython },
    ],
    split: [
      { value: 'blocks', label: m.tabBlocks },
      { value: 'split', label: m.tabSplit },
      { value: 'python', label: m.tabPython },
    ],
    python: [
      { value: 'python', label: m.tabPython },
      { value: 'blocks', label: m.tabBlocks },
    ],
  };

  const storedTab = useUiStore((s) => s.codeTab);
  const tab: CodeTab = tabsByMode[mode].some((t) => t.value === storedTab) ? storedTab : DEFAULT_TAB[mode];
  const setTab = useUiStore((s) => s.setCodeTab);
  // Respect the student's chosen coding mode (Blocks or Python) unless the mission requires split view.
  useEffect(() => {
    const preferred = useSettingsStore.getState().codingLanguage;
    useUiStore.getState().setCodeTab(level.editor === 'split' ? 'split' : preferred);
  }, [level.id, level.editor]);

  const editablePython = mode !== 'blocks';
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolboxDrawerOpen, setToolboxDrawerOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab | null>(null);
  const [portraitHintDismissed, setPortraitHintDismissed] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const startTour = useOnboardingStore((s) => s.start);
  const simStatus = useSimulationStore((s) => s.status);

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
    if (!useStudentSession.getState().user) return setNotice({ tone: 'ok', text: m.programSaved });
    // Signed in: also keep a version on the server (autosave keeps the latest anyway).
    void flushProgram({ createVersion: true }).then((ok) => setNotice(ok ? { tone: 'ok', text: m.programSaved } : { tone: 'ok', text: m.savedOfflineNotice }));
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

  const toggleSheet = (next: SheetTab) => setSheetTab((cur) => (cur === next ? null : next));
  const showPythonRail = tab === 'python' && editablePython;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-bg animate-page-in">
      <header className="relative z-30 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] bg-[#0a1424] px-2.5 py-1.5 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-0 lg:gap-4">
        <RouteLink to="/" aria-label={m.homeAria} className="flex h-11 w-11 shrink-0 items-center justify-center sm:h-auto sm:w-auto">
          <svg width="32" height="32" viewBox="0 0 44 44" aria-hidden="true" className="lg:h-[34px] lg:w-[34px]">
            <path d="M22 2.5 39 12.2v19.6L22 41.5 5 31.8V12.2z" fill="#6d5cf5" />
            <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round">
              <path d="M22 12.5l9 5.2v10.6l-9 5.2-9-5.2V17.7z" />
              <path d="M13 17.7l9 5.2 9-5.2M22 22.9v10.6" />
            </g>
          </svg>
        </RouteLink>
        <button
          type="button"
          onClick={() => navigate(paths.level(level.world, level.id))}
          aria-label={m.backMission}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-[13.5px] font-semibold text-[#cbd5e1] hover:bg-white/8 hover:text-white lg:h-10 lg:px-3"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">{m.backMission}</span>
        </button>
        <div className="min-w-0 flex-1 border-l border-white/10 pl-2.5 sm:flex-initial sm:pl-3 lg:pl-4">
          <div className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] lg:text-[11px] lg:tracking-[0.14em]" style={{ color: world?.color }}>
            {m.studioMissionHeader({ code: LevelRegistry.code(level) })}
          </div>
          <h1 className="truncate font-display text-[15px] font-black leading-tight text-white sm:text-[17px] lg:text-[19px]">{level.title}</h1>
        </div>
        <Tabs variant="pill" label={m.editorModeAria} value={tab} options={tabsByMode[mode]} onChange={setTab} className="hidden sm:ml-2 sm:flex lg:ml-4" />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-2.5">
          <SyncIndicator />
          <ProgramStatus />
          <Tooltip label={m.saveTooltip}>
            <button type="button" onClick={save} aria-label={m.save} className={cn(iconButton, 'sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[13px] sm:font-semibold')}>
              <Save size={16} /> <span className="hidden sm:inline">{m.save}</span>
            </button>
          </Tooltip>
          <Tooltip label={m.tourTooltip}>
            <button type="button" aria-label={m.helpAria} className={cn(iconButton, 'hidden sm:flex')} onClick={() => startTour('studio')}>
              <CircleHelp size={18} />
            </button>
          </Tooltip>
          <div ref={settingsRef} className="relative">
            <button type="button" aria-label={m.settingsAria} aria-expanded={settingsOpen} className={iconButton} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings size={18} />
            </button>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
          <button
            type="button"
            data-tour="test"
            aria-label={m.testInSimulator}
            title={m.testInSimulator}
            onClick={test}
            className={buttonClass('go', 'min-h-[44px] px-3 text-[13px] sm:px-4 lg:min-h-[40px] lg:px-5 lg:text-[14px]')}
          >
            <FlaskConical size={17} />
            <span className="hidden sm:inline">{m.testInSimulator}</span>
          </button>
        </div>

        {/* Mobile editor mode tabs row when screen is narrower than sm */}
        <div className="flex w-full items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5 sm:hidden">
          <Tabs variant="pill" label={m.editorModeAria} value={tab} options={tabsByMode[mode]} onChange={setTab} />
        </div>
      </header>

      {isPhonePortrait && !portraitHintDismissed && (
        <div role="note" className="flex shrink-0 items-center gap-2.5 border-b border-cyan/20 bg-cyan/10 px-3 py-2 text-[12.5px] leading-snug text-[#cffafe]">
          <Smartphone size={18} className="shrink-0 rotate-90 text-cyan" aria-hidden="true" />
          <span className="min-w-0 flex-1">{m.portraitHint}</span>
          <button
            type="button"
            onClick={() => setPortraitHintDismissed(true)}
            aria-label={m.dismissHint}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cyan/80 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1">
        {showPythonRail ? (
          <PythonReference layoutMode={layoutMode} drawerOpen={toolboxDrawerOpen} onDrawerOpenChange={setToolboxDrawerOpen} />
        ) : (
          <BlockToolbox layoutMode={layoutMode} drawerOpen={toolboxDrawerOpen} onDrawerOpenChange={setToolboxDrawerOpen} />
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
          <div className="flex min-h-0 min-w-0 flex-1 gap-3">
            <section data-tour="editor" aria-label={m.programEditorAria} className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-[16px] border border-white/6 bg-panel-2 p-1.5 sm:p-2">
              {tab === 'blocks' ? (
                <BlockEditor />
              ) : tab === 'split' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <BlockEditor />
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <PythonEditor />
                  </div>
                </div>
              ) : editablePython ? (
                <PythonEditor />
              ) : (
                <PythonTab />
              )}
              {notice && (
                <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-2.5 rounded-[var(--radius-control)] border border-white/10 bg-[#0f1b2e]/95 py-2.5 pl-3.5 pr-4 text-[13.5px] text-[#e2e8f0] shadow-[0_12px_32px_-12px_rgb(0_0_0/0.8)] animate-pop-in">
                  {notice.tone === 'ok' ? <Check size={17} className="shrink-0 text-[#4ade80]" aria-hidden="true" /> : <AlertTriangle size={17} className="shrink-0 text-[#f87171]" aria-hidden="true" />}{' '}
                  <span>{notice.text}</span>
                </div>
              )}
            </section>

            {/* Desktop: side-by-side Mission Brief */}
            {!isCompact && <MissionBrief level={level} />}
          </div>

          {/* Desktop: bottom Console panel */}
          {!isCompact && (
            <div className="h-[196px] shrink-0">
              <ConsolePanel />
            </div>
          )}
        </main>
      </div>

      {/* Tablet & Phone: collapsible bottom sheet for Mission Brief + Console (+ Blocks drawer trigger on phone) */}
      {isCompact && (
        <div className="relative z-30 shrink-0 border-t border-white/[0.08] bg-[#0a1424]">
          {sheetTab && (
            <div className="h-[46vh] max-h-[420px] min-h-[220px] border-b border-white/[0.08] bg-panel-2 p-2">
              {sheetTab === 'brief' ? <MissionBrief level={level} embedded /> : <ConsolePanel />}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {layoutMode === 'phone' && (
              <button
                type="button"
                onClick={() => {
                  setSheetTab(null);
                  setToolboxDrawerOpen(true);
                }}
                className="flex h-11 items-center gap-1.5 rounded-[10px] border border-cyan/30 bg-cyan/12 px-3 text-[13px] font-semibold text-cyan active:bg-cyan/20"
              >
                {showPythonRail ? <Code2 size={16} aria-hidden="true" /> : <Blocks size={16} aria-hidden="true" />}
                {showPythonRail ? m.drawerCommands : m.drawerBlocks}
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleSheet('brief')}
              aria-expanded={sheetTab === 'brief'}
              className={cn(
                'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors',
                sheetTab === 'brief' ? 'border-primary/50 bg-primary/20 text-white' : 'border-white/8 bg-white/[0.03] text-[#cbd5e1] hover:bg-white/[0.07]',
              )}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span className="truncate">{m.drawerBrief}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSheet('console')}
              aria-expanded={sheetTab === 'console'}
              className={cn(
                'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors',
                sheetTab === 'console' ? 'border-primary/50 bg-primary/20 text-white' : 'border-white/8 bg-white/[0.03] text-[#cbd5e1] hover:bg-white/[0.07]',
              )}
            >
              <Terminal size={16} aria-hidden="true" />
              <span className="truncate">{m.drawerConsole}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  simStatus === 'running' ? 'bg-success' : simStatus === 'error' ? 'bg-danger' : simStatus === 'finished' ? 'bg-cyan' : 'bg-faint',
                )}
              />
            </button>
            {sheetTab && (
              <button
                type="button"
                onClick={() => setSheetTab(null)}
                aria-label={m.collapsePanel}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.03] text-muted hover:text-white"
              >
                <ChevronDown size={18} />
              </button>
            )}
            {!sheetTab && (
              <button
                type="button"
                onClick={() => setSheetTab('brief')}
                aria-label={m.expandPanel}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.03] text-muted hover:text-white"
              >
                <ChevronUp size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      <ProgrammingOverlays />
      <OnboardingTour />
    </div>
  );
}
