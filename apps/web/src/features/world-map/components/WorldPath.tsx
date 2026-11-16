import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, QuadraticBezierCurve3, ShaderMaterial, TubeGeometry, Vector3 } from 'three';
import type { WorldDefinition } from '../../../content/worlds/types';
import { useSettingsStore } from '../../settings/settings-store';
import { ISLAND_RADIUS } from '../scene/island-decor';
import type { Placement } from '../scene/journey-layout';

/** 0 = locked (dim, static), 1 = open (pulsing), 2 = travelled (bright). */
export type PathState = 0 | 1 | 2;

export interface PathSegment {
  readonly from: WorldDefinition;
  readonly to: WorldDefinition;
  /** Where the two islands sit (Explore journey). */
  readonly fromAt: Placement;
  readonly toAt: Placement;
  readonly state: PathState;
  /** Touches the selected world: faster, brighter pulses. */
  readonly active: boolean;
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Energy cable: soft core + packets travelling from the earlier world to the later one.
const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uState;
  uniform float uActive;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float speed = mix(0.25, 0.6, uActive);
    float packet = smoothstep(0.82, 1.0, fract(vUv.x * 5.0 - uTime * speed));
    float dash = step(0.5, fract(vUv.x * 28.0));
    vec3 locked = vec3(0.45, 0.52, 0.66);
    vec3 open = uColor * (0.35 + 0.25 * core) + vec3(1.0) * packet * (0.6 + 0.4 * uActive);
    vec3 col = uState < 0.5 ? locked : open;
    float alpha = uState < 0.5 ? 0.14 * dash : (uState > 1.5 ? 0.32 : 0.22) + 0.5 * packet;
    gl_FragColor = vec4(col, alpha);
  }
`;

const up = new Vector3(0, 1, 0);

/** Flight route between two island rims, arcing well above the gap. */
function pathCurve(a: Placement, b: Placement) {
  const pa = new Vector3(a.x, a.y + 0.1, a.z);
  const pb = new Vector3(b.x, b.y + 0.1, b.z);
  const dir = pb.clone().sub(pa).setY(0).normalize();
  const start = pa.clone().addScaledVector(dir, ISLAND_RADIUS * 0.9 * a.scale);
  const end = pb.clone().addScaledVector(dir, -ISLAND_RADIUS * 0.9 * b.scale);
  const mid = start.clone().add(end).multiplyScalar(0.5).addScaledVector(up, 1.6);
  return new QuadraticBezierCurve3(start, mid, end);
}

const Segment = memo(function Segment({ segment }: { segment: PathSegment }) {
  const { to, fromAt, toAt, state, active } = segment;
  const geometry = useMemo(() => new TubeGeometry(pathCurve(fromAt, toAt), 64, 0.028, 5, false), [fromAt, toAt]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uTime: { value: 0 }, uState: { value: state }, uActive: { value: active ? 1 : 0 }, uColor: { value: new Color(to.color) } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    // state/active are pushed as uniforms below; recreate only when the colour changes.
    [to.color],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.uniforms.uState!.value = state;
    material.uniforms.uActive!.value = active ? 1 : 0;
  }, [material, state, active]);

  useFrame((_, delta) => {
    if (state === 0 || useSettingsStore.getState().reduceMotion) return;
    material.uniforms.uTime!.value += Math.min(delta, 0.1);
  });

  return <mesh geometry={geometry} material={material} renderOrder={2} />;
});

/**
 * Flight routes between consecutive worlds: thin arcs, quiet when locked,
 * with slow travelling light where the route is open. No extra decoration.
 */
export const WorldPaths = memo(function WorldPaths({ segments }: { segments: readonly PathSegment[] }) {
  return (
    <group>
      {segments.map((s) => (
        <Segment key={`${s.from.id}->${s.to.id}`} segment={s} />
      ))}
    </group>
  );
});
