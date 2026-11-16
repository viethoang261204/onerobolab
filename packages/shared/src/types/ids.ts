/**
 * Branded identifier types. They are plain strings at runtime but cannot be
 * mixed up at compile time (e.g. passing a MapId where a MissionId is expected).
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type RobotId = Brand<string, 'RobotId'>;
export type MapId = Brand<string, 'MapId'>;
export type MissionId = Brand<string, 'MissionId'>;
export type EntityId = Brand<string, 'EntityId'>;
export type SensorId = Brand<string, 'SensorId'>;

export const robotId = (value: string): RobotId => value as RobotId;
export const mapId = (value: string): MapId => value as MapId;
export const missionId = (value: string): MissionId => value as MissionId;
export const entityId = (value: string): EntityId => value as EntityId;
export const sensorId = (value: string): SensorId => value as SensorId;
