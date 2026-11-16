import type { Area2D, MapDefinition, MapEntity, MissionDefinition, Pose2D, Vec2 } from '@robolab/shared';
import type { BlockType } from '../../features/programming/blocks/block-types';
import type { CameraView } from '../../types/ui';

/** What earns stars beyond completing the level. */
export interface StarTargets {
  /** At most this many blocks (the start block doesn't count). */
  readonly parBlocks?: number;
  /** Finish within this many seconds of simulation time. */
  readonly parSeconds?: number;
}

/** A bridge deck at floor level (drivable) spanning water or a gorge. */
export interface SceneBridge {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly width: number;
  /** Look: planks, steel suspension, rope, or a log crossing. */
  readonly style: 'wood' | 'steel' | 'rope' | 'log';
}

/** A water channel (creek / river) along a polyline. */
export interface SceneWater {
  readonly points: readonly Vec2[];
  readonly width: number;
  /** Surface depth below the floor (m). */
  readonly depth: number;
}

/**
 * What the 3D environment needs to know about the level's layout, beyond
 * the physics map: where the road runs, where bridges and water are. The
 * environment builds terrain, roads and props around it, so visuals always
 * line up with the colliders.
 */
export interface LevelScene {
  /** Centre line of the drivable route (road / trail / canyon floor). */
  readonly path: readonly Vec2[];
  /** Road width (m). */
  readonly pathWidth: number;
  readonly bridges?: readonly SceneBridge[];
  readonly water?: readonly SceneWater[];
}

/**
 * A playable level — pure data. The engine never imports levels; the app
 * loads one by id and feeds its world (map) and mission to the runtime.
 *
 * success/fail conditions are the mission's objectives and rules
 * (`failOnCollision`, `timeLimit`); the world holds spawn, goal and checkpoints.
 */
export interface LevelDefinition {
  /** Stable id ("starter-01"), used for progress, saved programs and URLs. */
  readonly id: string;
  /** Owning world (`WorldDefinition.id`). */
  readonly world: string;
  /** Position within the world (1-based). */
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  /** Physics world: bounds, spawn, goal, checkpoints, walls, obstacles. */
  readonly map: MapDefinition;
  /** Which 3D environment renders this level (`EnvironmentRegistry`). Unique per level. */
  readonly environmentId: string;
  /** Layout hints for the environment (roads, bridges, water). */
  readonly scene: LevelScene;
  readonly mission: MissionDefinition;
  /** Blocks available in the toolbox ('all' = everything). */
  readonly allowedBlocks: readonly BlockType[] | 'all';
  /** Short "Program the robot to:" steps for the intro card. */
  readonly intro: readonly string[];
  /** Revealed one at a time when the student asks for help. */
  readonly hints: readonly string[];
  readonly stars: StarTargets;
  readonly rewards: { readonly xp: number };
  /** Camera preset when the level starts. */
  readonly camera?: CameraView;
  /**
   * The mission framework (Starter Island curriculum): story, briefing,
   * primary / secondary / optional objectives, concepts, APIs, a prediction
   * prompt, pseudocode, time and difficulty, plus the mechanics the level
   * switches on. Levels without it keep the older plain intro.
   */
  readonly briefing?: MissionBriefing;
  /** Numbers the program can read for this mission (`mission.target`); a variant can override them. */
  readonly data?: Readonly<Record<string, number>>;
  /**
   * Layouts the simulator picks from at random — on load and on every reset —
   * so a program has to use its sensors (or the mission data) instead of
   * memorised distances. Each is applied on top of `map`.
   */
  readonly variants?: readonly LevelVariant[];
  /** Which editor Code Studio opens: blocks, blocks ⇄ Python side by side, or Python first. */
  readonly editor?: EditorMode;
  /** Fog of war: the minimap shows only where the robot has been and the overview cameras are off. */
  readonly fog?: boolean;
  /** Present when the level was loaded from the OneRoboLab API (Student Phase 4). */
  readonly server?: ServerLevelInfo;
}

export type EditorMode = 'blocks' | 'split' | 'python';

/** One layout of a level with variants: entities added / removed, start / goal moved, data changed. */
export interface LevelVariant {
  readonly id: string;
  readonly add?: readonly MapEntity[];
  /** Ids of base map entities this layout leaves out. */
  readonly remove?: readonly string[];
  readonly start?: Pose2D;
  readonly finish?: Area2D;
  readonly data?: Readonly<Record<string, number>>;
}

/** Difficulty tiers of the curriculum (Easy → Boss). */
export type MissionTier = 'easy' | 'medium' | 'hard' | 'boss';

/**
 * Gameplay mechanics a mission uses. Each one is a reusable system (a visual
 * + rules), so levels opt in by name (or by map entities) instead of
 * shipping code:
 *   cargo        — the robot carries a crate and sets it down on the delivery pad (visual)
 *   push         — pushable crates and a construction zone with a counter
 *   traffic      — timed traffic lights; a red light must not be crossed
 *   pickup       — pick up / drop crates (colour-coded in some missions)
 *   gate         — a smart gate that opens when the robot waits at its scanner
 *   hazard       — no-go zones (flood water)
 *   variants     — the layout changes on every reset
 *   data         — mission values the program reads (`mission.target`)
 *   coordinates  — the robot's position and “go to x, y”
 *   functions    — define and run your own blocks
 *   fog          — only explored parts of the map are known
 *   movers       — obstacles that move on a timetable
 */
export type MissionMechanic = 'cargo' | 'push' | 'traffic' | 'pickup' | 'gate' | 'hazard' | 'variants' | 'data' | 'coordinates' | 'functions' | 'fog' | 'movers';

export const MISSION_MECHANICS: readonly MissionMechanic[] = ['cargo', 'push', 'traffic', 'pickup', 'gate', 'hazard', 'variants', 'data', 'coordinates', 'functions', 'fog', 'movers'];

/** Everything the mission briefing, HUD and result screen say about a level. */
export interface MissionBriefing {
  /** Why this mission matters on the island (2–3 sentences). */
  readonly story: string;
  /** What to do, in one line. */
  readonly task: string;
  readonly objectives: {
    /** Must do to pass. */
    readonly primary: string;
    /** Earns the time star / bonus. */
    readonly secondary: string;
    /** Earns the efficiency star / bonus. */
    readonly optional: string;
  };
  /** Programming concepts taught ("sequence", "turning"…). */
  readonly concepts: readonly string[];
  /** Python API equivalents of the allowed blocks ("robot.move_forward(cm)"…). */
  readonly python: readonly string[];
  /** The PREDICT step: a question to think about before coding. */
  readonly predict: string;
  /** Example pseudocode shown after the second hint. */
  readonly pseudocode: readonly string[];
  /** Estimated completion time (minutes). */
  readonly minutes: number;
  readonly tier: MissionTier;
  readonly mechanics: readonly MissionMechanic[];
}

/** API-side facts about a level that the bundled content doesn't have. */
export interface ServerLevelInfo {
  /** Database id (the API also accepts the slug, which is `LevelDefinition.id`). */
  readonly id: string;
  readonly contentVersion: number;
  /** False for locked levels: the API sent only the card and a map preview. */
  readonly playable: boolean;
  /** Per hint (same order as `hints`): paid hints stay hidden until revealed through the API. */
  readonly hints: readonly { readonly id: string; readonly title: string; readonly cost: number; readonly revealed: boolean }[];
  /** Every objective as the teacher wrote it, including ones the simulator can't track (shown, judged by the server). */
  readonly objectives: readonly { readonly code: string; readonly title: string; readonly type: string; readonly required: boolean }[];
  readonly maxStars: number;
  readonly estimatedMinutes: number | null;
}
