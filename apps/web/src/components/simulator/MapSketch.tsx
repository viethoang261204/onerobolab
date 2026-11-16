import type { Area2D, MapQuery } from '@robolab/shared';

export interface SketchFrame {
  /** Metres → px. */
  readonly scale: number;
  readonly sx: (x: number) => number;
  readonly sy: (z: number) => number;
}

/** Fit a map's bounds into a square of `size` px with `pad` px margin. */
export function sketchFrame(map: MapQuery, size: number, pad: number): SketchFrame {
  const { bounds } = map;
  const w = bounds.max.x - bounds.min.x;
  const d = bounds.max.z - bounds.min.z;
  const scale = (size - pad * 2) / Math.max(w, d);
  // Centre the shorter side.
  const ox = pad + (size - pad * 2 - w * scale) / 2;
  const oy = pad + (size - pad * 2 - d * scale) / 2;
  return { scale, sx: (x) => ox + (x - bounds.min.x) * scale, sy: (z) => oy + (z - bounds.min.z) * scale };
}

/**
 * Static top-down drawing of a map (floor, zones, lines, walls, props,
 * checkpoints, goal, start) as SVG elements. Shared by the simulator minimap
 * and the mission previews on the world map.
 */
export function MapSketch({ map, frame, showStart = false }: { map: MapQuery; frame: SketchFrame; showStart?: boolean }) {
  const { definition, bounds } = map;
  const { scale, sx, sy } = frame;
  const w = bounds.max.x - bounds.min.x;
  const d = bounds.max.z - bounds.min.z;
  const finish = definition.finish;
  const start = definition.start;

  return (
    <g>
      <rect x={sx(bounds.min.x)} y={sy(bounds.min.z)} width={w * scale} height={d * scale} rx="6" fill="#dfe5f2" fillOpacity=".92" />

      {map.entitiesOfType('colorZone').map((z) =>
        z.area.shape === 'circle' ? (
          <circle key={z.id} cx={sx(z.area.center.x)} cy={sy(z.area.center.z)} r={z.area.radius * scale} fill={z.color} fillOpacity=".55" />
        ) : (
          <rect
            key={z.id}
            x={sx(z.area.center.x - z.area.size.x / 2)}
            y={sy(z.area.center.z - z.area.size.z / 2)}
            width={z.area.size.x * scale}
            height={z.area.size.z * scale}
            fill={z.color}
            fillOpacity=".55"
          />
        ),
      )}

      {map.entitiesOfType('zone').map((z) => (
        <AreaShape
          key={z.id}
          area={z.area}
          frame={frame}
          fill={z.kind === 'hazard' ? '#3b82f6' : (z.color ?? (z.kind === 'construction' ? '#f59e0b' : '#22c55e'))}
          stroke={z.kind === 'hazard' ? '#dc2626' : z.kind === 'construction' ? '#b45309' : '#15803d'}
          dashed={z.kind !== 'hazard'}
        />
      ))}
      {map.entitiesOfType('trafficLight').map((l) => (
        <g key={l.id}>
          <AreaShape area={l.crossing} frame={frame} fill="#ffffff" stroke="#334155" dashed />
          <circle cx={sx(l.position.x)} cy={sy(l.position.z)} r="3.5" fill="#ef4444" stroke="#1e293b" strokeWidth="1" />
        </g>
      ))}

      {map.entitiesOfType('line').map((l) => (
        <polyline key={l.id} points={l.points.map((p) => `${sx(p.x)},${sy(p.z)}`).join(' ')} fill="none" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" />
      ))}

      {map.entitiesOfType('wall').map((wl) => (
        <line key={wl.id} x1={sx(wl.from.x)} y1={sy(wl.from.z)} x2={sx(wl.to.x)} y2={sy(wl.to.z)} stroke="#64748b" strokeWidth={Math.max(2, wl.thickness * scale)} strokeLinecap="round" />
      ))}

      {map.entitiesOfType('box').map((b) => (
        <rect key={b.id} x={sx(b.position.x) - (b.size.x * scale) / 2} y={sy(b.position.z) - (b.size.z * scale) / 2} width={b.size.x * scale} height={b.size.z * scale} fill={b.dynamic ? '#f59e0b' : '#64748b'} rx="1" />
      ))}
      {map.entitiesOfType('gate').map((g) => (
        <line key={g.id} x1={sx(g.from.x)} y1={sy(g.from.z)} x2={sx(g.to.x)} y2={sy(g.to.z)} stroke="#eab308" strokeWidth={Math.max(2, g.thickness * scale)} strokeDasharray="4 3" />
      ))}
      {map.entitiesOfType('cargo').map((c) => (
        <rect key={c.id} x={sx(c.position.x) - 4} y={sy(c.position.z) - 4} width="8" height="8" fill="#a16207" stroke="#fff" strokeWidth="1" rx="1" />
      ))}
      {map.entitiesOfType('mover').map((m) => (
        <g key={m.id}>
          <line x1={sx(m.from.x)} y1={sy(m.from.z)} x2={sx(m.to.x)} y2={sy(m.to.z)} stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={sx(m.from.x)} cy={sy(m.from.z)} r={Math.max(2.5, m.radius * scale)} fill="#a855f7" />
        </g>
      ))}
      {map.entitiesOfType('obstacle').map((o) => (
        <circle key={o.id} cx={sx(o.position.x)} cy={sy(o.position.z)} r={Math.max(2.5, o.radius * scale)} fill="#ec4899" />
      ))}

      {map.entitiesOfType('checkpoint').map((c) => (
        <circle key={c.id} cx={sx(c.area.center.x)} cy={sy(c.area.center.z)} r={7} fill="#22d3ee" fillOpacity=".25" stroke="#22d3ee" strokeWidth="2" />
      ))}

      {finish.shape === 'rect' ? (
        <rect
          x={sx(finish.center.x - finish.size.x / 2)}
          y={sy(finish.center.z - finish.size.z / 2)}
          width={finish.size.x * scale}
          height={finish.size.z * scale}
          fill="#22c55e"
          fillOpacity=".35"
          stroke="#22c55e"
          strokeWidth="2"
          rx="2"
        />
      ) : (
        <circle cx={sx(finish.center.x)} cy={sy(finish.center.z)} r={finish.radius * scale} fill="#22c55e" fillOpacity=".35" stroke="#22c55e" strokeWidth="2" />
      )}
      <g transform={`translate(${sx(finish.center.x) + 2} ${sy(finish.center.z) - 14})`}>
        <path d="M0 0v12" stroke="#1e293b" strokeWidth="1.5" />
        <path d="M0 0h9l-2.5 3 2.5 3H0z" fill="#ef4444" />
      </g>

      {showStart && (
        // Heading is CCW from above; SVG rotation is clockwise, so negate.
        <g transform={`translate(${sx(start.x)} ${sy(start.z)}) rotate(${(-start.heading * 180) / Math.PI})`}>
          <circle r="7" fill="#8b5cf6" fillOpacity=".3" />
          <path d="M6 0-4 5-2 0-4-5z" fill="#7c3aed" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

/** A rect / circle floor area in sketch coordinates. */
function AreaShape({ area, frame, fill, stroke, dashed = false }: { area: Area2D; frame: SketchFrame; fill: string; stroke: string; dashed?: boolean }) {
  const { scale, sx, sy } = frame;
  const common = { fill, fillOpacity: 0.4, stroke, strokeWidth: 1.5, ...(dashed && { strokeDasharray: '3 2' }) };
  if (area.shape === 'circle') return <circle cx={sx(area.center.x)} cy={sy(area.center.z)} r={area.radius * scale} {...common} />;
  const deg = (-area.rotation * 180) / Math.PI;
  return (
    <rect
      x={-(area.size.x * scale) / 2}
      y={-(area.size.z * scale) / 2}
      width={area.size.x * scale}
      height={area.size.z * scale}
      transform={`translate(${sx(area.center.x)} ${sy(area.center.z)}) rotate(${deg})`}
      {...common}
    />
  );
}
