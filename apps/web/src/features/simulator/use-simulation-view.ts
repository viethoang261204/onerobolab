import { createMapEngine } from '@robolab/map-engine';
import { robotId, type MapQuery, type Pose2D, type RobotDefinition } from '@robolab/shared';
import { useCallback, useMemo } from 'react';
import { LevelRegistry } from '../../content/levels/registry';
import { applyVariant } from '../../content/levels/variants';
import { DEFAULT_ROBOT_ID, getMap, getRobot } from '../../data/content-registry';
import { useVariantStore } from '../levels/variant-store';
import { ROBOT_OPTIONS } from '../../data/robots';
import { useUiStore } from '../../stores/ui-store';
import { RobotRuntime } from './robot/RobotMovement';

const mapEngine = createMapEngine();

export interface SimulationView {
  map: MapQuery;
  robot: RobotDefinition;
  /** Live robot state (mutable; read in frame loops, never via React state). */
  runtime: RobotRuntime;
  /** Stable callback, safe to call every frame. */
  getRobotPose: () => Pose2D;
}

/**
 * Bridge between the UI and the simulation. Owns the `RobotRuntime` for the
 * selected map + robot; the renderer, minimap and camera read its pose.
 * Later the Simulation Controller replaces the runtime behind this hook.
 */
export function useSimulationView(): SimulationView {
  const mapId = useUiStore((s) => s.mapId);
  const selectedRobotId = useUiStore((s) => s.selectedRobotId);

  const variant = useVariantStore((s) => s.index);
  const variantLevel = useVariantStore((s) => s.levelId);
  // Levels with layouts: the map of the layout currently picked (same map id).
  const map = useMemo(() => {
    const level = LevelRegistry.byMap(mapId);
    return mapEngine.load(level && level.id === variantLevel ? applyVariant(level, variant).map : getMap(mapId));
  }, [mapId, variant, variantLevel]);
  const robot = useMemo(() => {
    // Robots without a model yet fall back to the main robot.
    const definitionId = ROBOT_OPTIONS.find((r) => r.id === selectedRobotId)?.definitionId;
    return getRobot(definitionId ? robotId(definitionId) : DEFAULT_ROBOT_ID);
  }, [selectedRobotId]);
  const runtime = useMemo(() => new RobotRuntime(robot, map.definition.start), [robot, map]);
  const getRobotPose = useCallback(() => runtime.state.pose, [runtime]);

  return { map, robot, runtime, getRobotPose };
}
