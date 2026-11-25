import { Canvas } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import { NeutralToneMapping } from 'three';
import { QUALITY_DPR } from '../../settings/quality';
import { useSettingsStore } from '../../settings/settings-store';
import { useMessages } from '../../i18n/i18n';
import { BatchMesh } from '../../simulator/environments/props/BatchMesh';
import { FrameStats } from '../../simulator/render/FrameStats';
import { AnchorProjector } from '../../world-map/components/AnchorProjector';
import { adventureMapMessages } from '../adventure-map.messages';
import type { AdventureLayout, AdventureView } from '../adventure.types';
import { FOV } from '../camera';
import type { IslandLandmarks } from '../island/island-landmarks';
import { sceneryBatch, skyBatch, stateBatch } from '../island/island-props';
import type { IslandGround } from '../island/island-terrain';
import { ISLAND_THEMES } from '../island/island-theme';
import { CameraRig, type CameraHandle } from './CameraRig';
import { IslandSky } from './IslandSky';
import { IslandTerrain } from './IslandTerrain';
import { LiveProps } from './LiveProps';
import { RoadMesh } from './RoadMesh';

export interface AdventureCanvasProps {
  layout: AdventureLayout;
  ground: IslandGround;
  marks: IslandLandmarks;
  view: AdventureView;
  surface: RefObject<HTMLDivElement | null>;
  camera: CameraHandle;
  /** HUD width on the left (px). */
  inset: number;
}

/**
 * The world's adventure island in 3D (lazy chunk): sky, sea, terraced
 * terrain, the road, scenery and landmarks (instanced batches), animated
 * gates / arena / current-mission ring, the camera rig and the projector
 * that pins the HTML mission markers to their 3D points.
 */
export default function AdventureCanvas({ layout, ground, marks, view, surface, camera, inset }: AdventureCanvasProps) {
  const m = useMessages(adventureMapMessages);
  const quality = useSettingsStore((s) => s.quality);
  const theme = ISLAND_THEMES[layout.theme];
  const scenery = useMemo(() => sceneryBatch(layout, ground, marks), [layout, ground, marks]);
  const sky = useMemo(() => skyBatch(layout), [layout]);
  const state = useMemo(() => stateBatch(layout, view, marks), [layout, view, marks]);

  return (
    <Canvas
      dpr={QUALITY_DPR[quality]}
      shadows={quality !== 'low'}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: NeutralToneMapping }}
      camera={{ fov: FOV, near: 0.5, far: 400, position: [0, 20, 30] }}
      aria-label={m.canvasAria}
    >
      <IslandSky theme={theme} quality={quality} />
      <IslandTerrain layout={layout} ground={ground} quality={quality} />
      <RoadMesh layout={layout} />
      <BatchMesh batch={scenery} shadows={quality !== 'low'} />
      <BatchMesh batch={sky} shadows={false} />
      <BatchMesh batch={state} shadows={false} />
      <LiveProps layout={layout} view={view} marks={marks} />
      <CameraRig layout={layout} start={view.focus} surface={surface} api={camera} inset={inset} heightAt={ground.height} />
      <AnchorProjector />
      <FrameStats />
    </Canvas>
  );
}
