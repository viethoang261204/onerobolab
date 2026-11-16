import { robotId, sensorId, type RobotDefinition } from '@robolab/shared';

/**
 * Built-in four-wheel (skid-steer) educational robot "Rover". Dimensions in
 * metres — a classroom-sized line follower that fits the built-in courses
 * (5 cm lines, 0.6 m curve radius). The 3D model is derived from these values.
 *
 * `wheelBase` is the track width: distance between left and right wheel
 * centre planes, used by the differential-drive kinematics.
 */
export const ROVER: RobotDefinition = {
  id: robotId('rover'),
  name: 'Rover',
  wheelBase: 0.253,
  wheelRadius: 0.075,
  wheelWidth: 0.066,
  maxWheelSpeed: 0.5,
  bodySize: { x: 0.33, y: 0.24, z: 0.21 },
  mass: 1.4,
  sensors: [
    {
      id: sensorId('front-distance'),
      kind: 'distance',
      label: 'Front distance',
      offset: { x: 0.165, y: 0.12, z: 0 },
      yaw: 0,
      maxRange: 2,
    },
    { id: sensorId('line'), kind: 'line', label: 'Line', offset: { x: 0.117, y: 0.01, z: 0 } },
    { id: sensorId('color'), kind: 'color', label: 'Color', offset: { x: 0.075, y: 0.01, z: 0 } },
    {
      id: sensorId('bumper'),
      kind: 'touch',
      label: 'Bumper',
      offset: { x: 0.17, y: 0.12, z: 0 },
      size: { x: 0.02, y: 0.04, z: 0.21 },
    },
  ],
};
