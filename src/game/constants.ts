import type { Direction, LaneControl, VehiclePalette } from './types';

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
export const INTERSECTION_SIZE = 210;
export const ROAD_WIDTH = 214;
export const CENTER_X = WORLD_WIDTH / 2;
export const CENTER_Y = WORLD_HEIGHT / 2 + 18;
export const SAFE_DISTANCE = 126;
export const DESPAWN_MARGIN = 220;
export const MAX_CONGESTION = 100;

export const LANE_ACCELERATION: Record<Direction, number> = {
  northbound: 40,
  southbound: 38,
  eastbound: 42,
  westbound: 40,
};

export const VEHICLE_PALETTES: VehiclePalette[] = [
  { body: '#f58f62', roof: '#fff0c6', accent: '#c6533a' },
  { body: '#4fb5a4', roof: '#fdf7ea', accent: '#236d64' },
  { body: '#ffd166', roof: '#fff9e3', accent: '#c68b1f' },
  { body: '#7aa6ff', roof: '#eef5ff', accent: '#3e63bc' },
  { body: '#ee7aa8', roof: '#fff0f8', accent: '#b74d73' },
];

export const DEFAULT_CONTROL: LaneControl = {
  activeAxis: 'northSouth',
  emergencyStop: false,
  boost: 0,
  inputLabel: 'Awaiting your cue',
};
