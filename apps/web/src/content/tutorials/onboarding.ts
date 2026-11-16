/** Target for a tour step: a `data-tour` element, or the robot on screen. */
export type TourTarget = 'robot' | 'toolbox' | 'editor' | 'test' | 'brief' | 'run' | 'camera' | 'mission' | 'edit';

export interface TourStep {
  readonly target: TourTarget;
  readonly title: string;
  readonly body: string;
}

/** One tour per screen: Code Studio (write the program) and Simulator (test it). */
export type TourId = 'studio' | 'simulator';

/** First-visit tours (content, not code — edit freely). */
export const ONBOARDING_TOURS: Readonly<Record<TourId, readonly TourStep[]>> = {
  studio: [
    { target: 'brief', title: 'Read your mission', body: 'The objectives and hints for this mission live here.' },
    { target: 'toolbox', title: 'Pick blocks', body: 'Every block your robot understands. Drag one onto the canvas.' },
    { target: 'editor', title: 'Build your program', body: 'Snap blocks under “when program starts” — they run from top to bottom.' },
    { target: 'test', title: 'Test in the simulator', body: 'When you are ready, send your program to the 3D simulator.' },
  ],
  simulator: [
    { target: 'robot', title: 'This is your robot', body: 'Rover drives, turns and senses the world. Your program controls every move.' },
    { target: 'run', title: 'Press Run', body: 'Run executes your program. Stop pauses it, Reset puts the robot back.' },
    { target: 'mission', title: 'Complete the mission', body: 'Tick off every objective to finish the mission and earn stars.' },
    { target: 'camera', title: 'Look around', body: 'Drag to orbit, right-drag to pan, scroll to zoom — or pick a camera view.' },
    { target: 'edit', title: 'Change your program', body: 'Go back to Code Studio any time. Your program is kept.' },
  ],
};
