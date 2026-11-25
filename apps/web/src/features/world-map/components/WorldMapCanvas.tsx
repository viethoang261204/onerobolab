import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { NeutralToneMapping, type PointLight, Vector3 } from 'three';
import { QUALITY_DPR } from '../../settings/quality';
import { useSettingsStore } from '../../settings/settings-store';
import { FrameStats } from '../../simulator/render/FrameStats';
import { useMessages } from '../../i18n/i18n';
import { worldMapMessages } from '../world-map.messages';
import type { IslandView, MapInsets } from '../world-map.types';
import { AnchorProjector } from './AnchorProjector';
import { RobotTraveller } from './RobotTraveller';
import { WorldIsland } from './WorldIsland';
import { WorldMapBackground } from './WorldMapBackground';
import { WorldMapCamera, type CameraFocus } from './WorldMapCamera';
import { WorldPaths, type PathSegment } from './WorldPath';
import { journeyCenter } from '../scene/journey-layout';

export interface WorldMapCanvasProps {
  islands: readonly IslandView[];
  segments: readonly PathSegment[];
  insets: MapInsets;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  /** Click on empty sky/space. */
  onBackgroundClick: () => void;
}

/**
 * Soft key light that follows the selected island: the chosen world reads
 * brighter through lighting, not outlines.
 */
const aim = new Vector3();

function SelectionLight({ target }: { target: { x: number; y: number; z: number } | null }) {
  const light = useRef<PointLight>(null);
  useFrame((_, dt) => {
    const l = light.current;
    if (!l) return;
    const k = useSettingsStore.getState().reduceMotion ? 1 : 1 - Math.exp(-4 * Math.min(dt, 0.1));
    if (target) l.position.lerp(aim.set(target.x + 0.8, target.y + 4.2, target.z + 2.4), k);
    l.intensity += ((target ? 26 : 0) - l.intensity) * k;
  });
  return <pointLight ref={light} color="#fff1dc" intensity={0} distance={9} decay={1.6} />;
}

/**
 * The World Map scene: six themed floating islands on a navigation network,
 * the real robot on the current world and a constrained
 * camera. Name tags are DOM (`MapLabels`), placed by `AnchorProjector`. Loaded lazily (three.js chunk).
 */
export default function WorldMapCanvas({ islands, segments, insets, onSelect, onHover, onBackgroundClick }: WorldMapCanvasProps) {
  const m = useMessages(worldMapMessages);
  const quality = useSettingsStore((s) => s.quality);
  const center = useMemo(() => journeyCenter(islands.length), [islands.length]);

  const selected = islands.find((i) => i.selected);
  // The robot stands on the world you pick (else the one you're progressing through).
  const robotAt = selected ?? islands.find((i) => i.current) ?? null;
  const focus: CameraFocus = selected ? { mode: 'selected', point: selected.placement } : { mode: 'overview', point: null };

  return (
    <Canvas
      dpr={QUALITY_DPR[quality]}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
      camera={{ fov: 40, near: 0.1, far: 300, position: [center.x, 14, 18] }}
      onPointerMissed={(e) => e.button === 0 && onBackgroundClick()}
      style={{ touchAction: 'none' }}
      aria-label={m.canvasAria}
    >
      <WorldMapBackground />
      <hemisphereLight args={['#c4d8ff', '#2a3560', 1.0]} />
      <directionalLight position={[7, 12, 9]} intensity={1.75} color="#ffeedd" />
      {/* Cool rim from behind: separates the islands from the sky. */}
      <directionalLight position={[-6, 5, -12]} intensity={0.7} color="#9fb8ff" />
      <SelectionLight target={selected ? selected.placement : null} />
      <RobotTraveller target={robotAt ? { id: robotAt.summary.world.id, order: robotAt.summary.world.order, placement: robotAt.placement, selected: robotAt.selected } : null} />

      <WorldPaths segments={segments} />
      {islands.map((island) => {
        const { world, status } = island.summary;
        return (
          <WorldIsland
            key={world.id}
            world={world}
            locked={status === 'locked' || status === 'coming_soon'}
            selected={island.selected}
            placement={island.placement}
            hovered={island.hovered}
            onSelect={onSelect}
            onHover={onHover}
          >
          </WorldIsland>
        );
      })}
      <AnchorProjector />
      <WorldMapCamera focus={focus} center={center} insets={insets} />
      <FrameStats />
    </Canvas>
  );
}
