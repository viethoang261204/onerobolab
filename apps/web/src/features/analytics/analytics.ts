export type AnalyticsEvent =
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'program_run'
  | 'program_error'
  | 'collision'
  | 'hint_used'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'settings_changed'
  | 'world_entered'
  | 'mission_opened';

export type AnalyticsProps = Readonly<Record<string, string | number | boolean | null>>;

/** Where events go. Swap for a backend sink later; nothing external is called today. */
export interface AnalyticsSink {
  track(event: AnalyticsEvent, props: AnalyticsProps): void;
}

const noop: AnalyticsSink = { track: () => undefined };
const devConsole: AnalyticsSink = { track: (event, props) => console.debug('[analytics]', event, props) };

let sink: AnalyticsSink = import.meta.env?.DEV ? devConsole : noop;

/** Product analytics abstraction (no third-party services). */
export const Analytics = {
  track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
    try {
      sink.track(event, props);
    } catch {
      // analytics must never break the app
    }
  },
  /** Replace the sink (tests, future backend). Returns the previous one. */
  use(next: AnalyticsSink): AnalyticsSink {
    const prev = sink;
    sink = next;
    return prev;
  },
};
