import { useMemo } from 'react';
import { usePersonalRobot } from '../state/robot-store';
import { Accessories, Decals } from './attachments';
import { paintOf, usePartMaterials, type RobotPaint } from './part-materials';

/*
 * The student's robot in the simulator. Physics drives the rover, so the
 * simulator keeps the rover shape whatever model was chosen in the garage,
 * but it wears the student's paint, accessories and decals.
 */

/** Paint for `<Robot paint>`. */
export function usePersonalRoverPaint(): RobotPaint {
  const personal = usePersonalRobot();
  return useMemo(() => paintOf(personal), [personal]);
}

/** Accessories and decals, rendered inside `<Robot>` (design units). */
export function PersonalRoverExtras() {
  const personal = usePersonalRobot();
  const mats = usePartMaterials(useMemo(() => paintOf(personal), [personal]));
  return (
    <>
      <Accessories model="rover" ids={personal.accessories} mats={mats} />
      <Decals model="rover" decals={personal.decals} />
    </>
  );
}
