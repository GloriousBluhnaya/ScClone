export type IFCSMode = 'coupled' | 'decoupled';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionD {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ShipPhysicsState {
  position: Vector3D;
  velocity: Vector3D;
  rotation: QuaternionD;
  angularVelocity: Vector3D;
  mass: number;
  momentOfInertia: Vector3D;
  throttle: number; // -1.0 to 1.0 (or 0 to 1.0 with reverse)
  targetThrottle: number;
  boostActive: boolean;
  ifcsMode: IFCSMode;
  speedLimit: number; // e.g. 350 m/s SCM speed, 950 m/s with boost
  currentSpeed: number;
  gForce: number;
}

export interface ThrusterInputs {
  pitch: number;    // -1 to 1 (Mouse Y / Up-Down)
  yaw: number;      // -1 to 1 (Mouse X / Left-Right)
  roll: number;     // -1 to 1 (Q / E)
  surge: number;    // -1 to 1 (W / S or throttle)
  sway: number;     // -1 to 1 (A / D strafe left/right)
  heave: number;    // -1 to 1 (Space / Ctrl strafe up/down)
  boost: boolean;   // Shift
  primaryFire: boolean;
}

export interface TargetInfo {
  id: string;
  callsign: string;
  isAI: boolean;
  position: Vector3D;
  velocity: Vector3D;
  distance: number;
  relativeVelocity: number;
  shieldPercent: number;
  hullPercent: number;
  leadPoint: Vector3D | null;
  screenPos?: { x: number; y: number; visible: boolean };
  leadScreenPos?: { x: number; y: number; visible: boolean };
  inGimbalCone: boolean;
  offScreen?: {
    isOnScreen: boolean;
    edgeX: number;
    edgeY: number;
    edgeAngle: number;
    offNoseDegrees: number;
  };
}

export interface TVIMarker {
  screenX: number;
  screenY: number;
  inFront: boolean;
  isOnScreen: boolean;
  edgeX: number;
  edgeY: number;
  edgeAngle: number; // Angle in radians on screen
  worldDir: Vector3D;
}

export interface TVIInfo {
  speed: number;
  tvi: TVIMarker | null;      // Total Vector Indicator (prograde travel vector)
  antiTvi: TVIMarker | null;  // Anti-TVI (retrograde / reverse vector)
  driftAngleDeg: number;      // Angle in degrees between ship nose (forward) and travel vector
}

export interface LaserBolt {
  id: string;
  shooterId: string;
  position: Vector3D;
  velocity: Vector3D;
  color: string;
  createdAt: number;
  lifeTime: number;
}

export interface ExplosionEffect {
  id: string;
  position: Vector3D;
  color: string;
  startTime: number;
  duration: number;
  scale: number;
}

export interface RemoteShip {
  id: string;
  callsign: string;
  isAI: boolean;
  position: Vector3D;
  velocity: Vector3D;
  rotation: QuaternionD;
  angularVelocity: Vector3D;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  lastHit: number;
  boost: boolean;
  decoupled: boolean;
  score: number;
  targetId: string | null;
  ready?: boolean;
}

export interface DuelRoomState {
  status: 'waiting' | 'ready' | 'dueling' | 'finished';
  targetScore: number;
  winnerId: string | null;
  winnerCallsign: string | null;
}

export interface VirtualJoystickState {
  centerX: number;
  centerY: number;
  mouseX: number;
  mouseY: number;
  pitchPercent: number;     // -100 to 100
  yawPercent: number;       // -100 to 100
  deflectionPercent: number;// 0 to 100
  pitchInput: number;       // -1.0 to 1.0
  yawInput: number;         // -1.0 to 1.0
  maxRadius: number;        // pixels from center (e.g. 180)
  deadzoneRadius: number;   // pixels deadzone (e.g. 18)
  circleOpacity: number;    // 0.0 to 1.0 (e.g. 0.4)
  isActive: boolean;
  isInverted: boolean;
}

export interface UnityScriptDoc {
  fileName: string;
  title: string;
  category: 'Physics' | 'Targeting & HUD' | 'Weapons' | 'Networking';
  description: string;
  code: string;
}

export type ControlActionId =
  | 'throttleForward'
  | 'throttleReverse'
  | 'strafeLeft'
  | 'strafeRight'
  | 'strafeUp'
  | 'strafeDown'
  | 'rollLeft'
  | 'rollRight'
  | 'toggleDecoupled'
  | 'boost'
  | 'cycleTarget'
  | 'recenterVJoy'
  | 'invertPitch'
  | 'primaryFire';

export type ControlCategory = 'translations' | 'rotations' | 'systems' | 'combat';

export interface KeyBindingItem {
  id: ControlActionId;
  label: string;
  category: ControlCategory;
  primary: string;
  secondary?: string;
  description: string;
}

export type KeyBindingsMap = Record<ControlActionId, KeyBindingItem>;

export type InputDeviceMode = 'keyboard_mouse' | 'flight_stick';

export interface FlightStickAxisConfig {
  stickIndex: number; // 0 for Primary Stick, 1 for Secondary Stick / Throttle, -1 for Auto/Any
  axisIndex: number;  // 0, 1, 2, 3, 4, 5, etc. (-1 = disabled)
  inverted: boolean;
  deadzone: number;   // 0.0 to 0.3 (default 0.05)
  sensitivity: number;// 1.0 (linear) to 2.5 (curved)
  isThrottleSlider?: boolean; // If true, remaps [-1..1] full physical travel to [0..1] forward or [-1..1] center-zero
}

export interface FlightStickButtonConfig {
  stickIndex: number; // 0 for Primary Stick, 1 for Secondary Stick, -1 for Any
  buttonIndex: number;// 0, 1, 2, ... (-1 = disabled)
}

export interface FlightStickConfig {
  enabled: boolean;
  primaryDeviceIndex: number;   // Gamepad API index (0, 1, 2...)
  secondaryDeviceIndex: number; // For HOSAS or separate throttle (-1 = none)
  axes: {
    pitch: FlightStickAxisConfig;
    yaw: FlightStickAxisConfig;
    roll: FlightStickAxisConfig;
    surge: FlightStickAxisConfig;
    sway: FlightStickAxisConfig;
    heave: FlightStickAxisConfig;
  };
  buttons: {
    primaryFire: FlightStickButtonConfig;
    boost: FlightStickButtonConfig;
    toggleDecoupled: FlightStickButtonConfig;
    cycleTarget: FlightStickButtonConfig;
    throttleForward: FlightStickButtonConfig;
    throttleReverse: FlightStickButtonConfig;
    strafeLeft: FlightStickButtonConfig;
    strafeRight: FlightStickButtonConfig;
    strafeUp: FlightStickButtonConfig;
    strafeDown: FlightStickButtonConfig;
    rollLeft: FlightStickButtonConfig;
    rollRight: FlightStickButtonConfig;
  };
}

export interface DetectedGamepadInfo {
  index: number;
  id: string;
  axesCount: number;
  buttonsCount: number;
  connected: boolean;
  timestamp: number;
  axesValues: number[];
  buttonsPressed: boolean[];
}
