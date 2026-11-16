import { memo, useEffect, useMemo } from 'react';
import { AdditiveBlending, CylinderGeometry, EdgesGeometry, LineBasicMaterial, MeshBasicMaterial } from 'three';
import { RG } from './RobotGeometry';
import type { RobotMaterials } from './RobotMaterials';
import { DESIGN, type RobotRig } from './RobotTypes';

interface RobotHeadProps {
  mats: RobotMaterials;
  rig: RobotRig;
  /** Show the camera field-of-view indicator. */
  showFov: boolean;
}

/** Camera field-of-view pyramid (design units), apex at the lens, pointing +X. */
function CameraFov() {
  const { geo, edges, fill, line } = useMemo(() => {
    const length = 0.9;
    const geo = new CylinderGeometry(0.34, 0.01, length, 4, 1, true)
      .rotateY(Math.PI / 4)
      .rotateZ(-Math.PI / 2)
      .translate(length / 2, 0, 0);
    return {
      geo,
      edges: new EdgesGeometry(geo),
      fill: new MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.07, blending: AdditiveBlending, depthWrite: false }),
      line: new LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.45 }),
    };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      edges.dispose();
      fill.dispose();
      line.dispose();
    },
    [geo, edges, fill, line],
  );
  return (
    <group position={[0.14, 0.085, 0]}>
      <mesh geometry={geo} material={fill} renderOrder={3} />
      <lineSegments geometry={edges} material={line} />
    </group>
  );
}

/**
 * HeadAssembly: Neck (yaw) → arm → joint → Head (pitch) with camera housing,
 * large cyan CameraLens, dark surround, and a side SensorDetail.
 * `rig.headYaw` / `rig.headPitch` are rotated by `Robot`.
 */
export const RobotHead = memo(function RobotHead({ mats, rig, showFov }: RobotHeadProps) {
  return (
    <group position={[-0.1, DESIGN.deckTopY, 0]}>
      <mesh geometry={RG.neckBase} material={mats.dark} position-y={0.015} castShadow />
      <group ref={rig.headYaw} position-y={0.03}>
        <mesh geometry={RG.arm} material={mats.head} position-y={0.065} castShadow />
        <mesh geometry={RG.joint} material={mats.dark} position-y={0.14} castShadow />
        <mesh geometry={RG.jointCap} material={mats.blue} position-y={0.14} />

        <group ref={rig.headPitch} position-y={0.14} scale={1.15}>
          <mesh geometry={RG.housing} material={mats.head} position={[0.02, 0.085, 0]} castShadow />
          <mesh geometry={RG.headCap} material={mats.dark} position={[0.0, 0.158, 0]} castShadow />
          <mesh geometry={RG.dot} material={mats.purple} position={[-0.035, 0.175, 0]} scale={1.2} />

          {/* CameraLens: dark surround, glass, glowing iris, pupil, glint */}
          <mesh geometry={RG.lensSurround} material={mats.dark} position={[0.108, 0.085, 0]} castShadow />
          <mesh geometry={RG.lensGlass} material={mats.lensGlass} position={[0.128, 0.085, 0]} />
          <mesh geometry={RG.lensGlow} material={mats.lens} position={[0.1345, 0.085, 0]} />
          <mesh geometry={RG.pupil} material={mats.screen} position={[0.1355, 0.085, 0]} />
          <mesh geometry={RG.glint} material={mats.white} position={[0.136, 0.098, -0.012]} />

          {/* SensorDetails: side depth sensor */}
          <mesh geometry={RG.sideSensor} material={mats.dark} position={[0.01, 0.09, 0.098]} />
          <mesh geometry={RG.dot} material={mats.accentLed} position={[0.03, 0.09, 0.114]} />

          {showFov && <CameraFov />}
        </group>
      </group>
    </group>
  );
});
