import type { MapQuery, Pose2D } from '@robolab/shared';
import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { useRuntimeStore } from '../../features/simulator/runtime/runtime-store';
import { MapSketch, sketchFrame } from './MapSketch';

/** Fog: how far around the robot the map is revealed (m), and the reveal grid (m). */
const FOG_RADIUS = 0.55;
const FOG_CELL = 0.2;
const SVG_NS = 'http://www.w3.org/2000/svg';

const SIZE = 168;
const PAD = 10;

interface MiniMapProps {
  map: MapQuery;
  getRobotPose: () => Pose2D;
  /** Fog of war: only the parts the robot has been near are shown (cleared on reset). */
  fog?: boolean;
}

/**
 * Top-down map (static `MapSketch`) plus the live robot marker.
 * Static geometry renders once; the robot marker is moved by a rAF loop that
 * pulls the pose (no React re-render per frame).
 */
export const MiniMap = memo(function MiniMap({ map, getRobotPose, fog = false }: MiniMapProps) {
  const frame = useMemo(() => sketchFrame(map, SIZE, PAD), [map]);
  const { sx, sy } = frame;
  const maskId = `fog-${useId().replace(/:/g, '')}`;

  const robot = useRef<SVGGElement>(null);
  const reveal = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    const seen = new Set<string>();
    const clear = () => {
      seen.clear();
      reveal.current?.replaceChildren();
    };
    // A reset (robot back at the start) hides the map again.
    const off = useRuntimeStore.subscribe((s, prev) => {
      if (s.runState === 'idle' && prev.runState !== 'idle') clear();
    });
    const scale = Math.abs(sx(1) - sx(0));
    const tick = () => {
      const p = getRobotPose();
      // Heading is CCW from above; SVG rotation is clockwise, so negate.
      robot.current?.setAttribute('transform', `translate(${sx(p.x)} ${sy(p.z)}) rotate(${(-p.heading * 180) / Math.PI})`);
      if (fog && reveal.current) {
        const key = `${Math.round(p.x / FOG_CELL)},${Math.round(p.z / FOG_CELL)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const c = document.createElementNS(SVG_NS, 'circle');
          c.setAttribute('cx', String(sx(Math.round(p.x / FOG_CELL) * FOG_CELL)));
          c.setAttribute('cy', String(sy(Math.round(p.z / FOG_CELL) * FOG_CELL)));
          c.setAttribute('r', String(FOG_RADIUS * scale));
          c.setAttribute('fill', 'white');
          reveal.current.appendChild(c);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [sx, sy, getRobotPose, fog]);

  return (
    <div className="glass rounded-[16px] p-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Mini map">
        {fog && (
          <defs>
            <mask id={maskId}>
              <g ref={reveal} />
            </mask>
          </defs>
        )}
        {fog && <rect width={SIZE} height={SIZE} rx="10" fill="#0b1426" />}
        <g {...(fog && { mask: `url(#${maskId})` })}>
          <MapSketch map={map} frame={frame} />
        </g>
        {fog && (
          <text x={SIZE / 2} y={SIZE - 8} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="sans-serif">
            unexplored
          </text>
        )}

        {/* Robot: arrow pointing along +X in local space */}
        <g ref={robot}>
          <circle r="7" fill="#3b82f6" fillOpacity=".25" />
          <path d="M6 0-4 5-2 0-4-5z" fill="#2563eb" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
});
