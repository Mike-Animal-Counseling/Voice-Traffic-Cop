export type Axis = 'northSouth' | 'eastWest';
export type Direction = 'northbound' | 'southbound' | 'eastbound' | 'westbound';
export type GamePhase = 'title' | 'running' | 'paused' | 'gameOver';
export type DifficultyTier = 'rookie' | 'cadet' | 'captain';
export type SignalPhase = 'green' | 'yellow' | 'allRed';

export interface VehiclePalette {
  body: string;
  roof: string;
  accent: string;
}

export interface Vehicle {
  id: number;
  direction: Direction;
  axis: Axis;
  laneOffset: number;
  position: number;
  speed: number;
  acceleration: number;
  waitingTime: number;
  length: number;
  width: number;
  color: VehiclePalette;
  kind: 'bubble' | 'beetle' | 'snail' | 'hopper';
  wobbleSeed: number;
}

export interface Pedestrian {
  id: number;
  side: 'top' | 'bottom';
  species: 'duck' | 'ferret' | 'tortoise' | 'otter' | 'gazelle' | 'pigeon';
  x: number;
  pace: number;
  bob: number;
}

export interface LaneControl {
  activeAxis: Axis;
  emergencyStop: boolean;
  boost: number;
  inputLabel: string;
}

export interface MicSnapshot {
  permission: 'idle' | 'granted' | 'denied';
  volume: number;
  pitch: number | null;
  smoothedPitch: number | null;
  command: 'low' | 'high' | 'stop' | 'boost' | 'listening' | 'none';
  transcript: string;
  stableMs: number;
}

export interface GameState {
  phase: GamePhase;
  difficultyTier: DifficultyTier;
  difficultyLevel: number;
  levelGoal: number;
  justLeveledUp: boolean;
  vehicles: Vehicle[];
  pedestrians: Pedestrian[];
  score: number;
  streak: number;
  bestStreak: number;
  carsCleared: number;
  congestion: number;
  conflictCooldown: number;
  graceTimer: number;
  dangerFlash: number;
  delightFlash: number;
  activeAxis: Axis;
  signalPhase: SignalPhase;
  pendingAxis: Axis | null;
  clearanceAxis: Axis | null;
  signalTimer: number;
  emergencyStop: boolean;
  boostTimer: number;
  elapsed: number;
  spawnTimerNS: number;
  spawnTimerEW: number;
  nextVehicleId: number;
  tutorialText: string;
  announcement: string;
}
