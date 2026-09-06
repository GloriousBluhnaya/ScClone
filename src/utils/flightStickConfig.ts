import {
  FlightStickConfig,
  InputDeviceMode,
  DetectedGamepadInfo,
  FlightStickAxisConfig,
  FlightStickButtonConfig,
} from '../types';

export const FLIGHT_STICK_STORAGE_KEY = 'star_citizen_flight_stick_config_v1';
export const INPUT_MODE_STORAGE_KEY = 'star_citizen_input_device_mode_v1';

export const DEFAULT_FLIGHT_STICK_CONFIG: FlightStickConfig = {
  enabled: true,
  primaryDeviceIndex: 0,
  secondaryDeviceIndex: -1,
  pedalsDeviceIndex: -1,
  axes: {
    pitch: {
      stickIndex: 0,
      axisIndex: 1,
      inverted: true,
      deadzone: 0.04,
      sensitivity: 1.0,
    },
    roll: {
      stickIndex: 0,
      axisIndex: 0,
      inverted: false,
      deadzone: 0.04,
      sensitivity: 1.0,
    },
    yaw: {
      stickIndex: 0,
      axisIndex: 2, // Z-Twist axis on standard joysticks
      inverted: false,
      deadzone: 0.06,
      sensitivity: 1.2,
    },
    surge: {
      stickIndex: 0,
      axisIndex: 3, // Throttle lever/slider
      inverted: true,
      deadzone: 0.03,
      sensitivity: 1.0,
      isThrottleSlider: false,
    },
    sway: {
      stickIndex: 0,
      axisIndex: -1, // Unassigned by default for single stick (use hat/keys or secondary stick)
      inverted: false,
      deadzone: 0.05,
      sensitivity: 1.0,
    },
    heave: {
      stickIndex: 0,
      axisIndex: -1, // Unassigned by default for single stick
      inverted: false,
      deadzone: 0.05,
      sensitivity: 1.0,
    },
  },
  buttons: {
    primaryFire: { stickIndex: 0, buttonIndex: 0 }, // Trigger (Button 1 in Windows / Index 0)
    boost: { stickIndex: 0, buttonIndex: 1 },       // Thumb Button / Secondary Trigger
    toggleDecoupled: { stickIndex: 0, buttonIndex: 2 }, // Top Left button
    cycleTarget: { stickIndex: 0, buttonIndex: 3 },     // Top Right button
    throttleForward: { stickIndex: 0, buttonIndex: -1 },
    throttleReverse: { stickIndex: 0, buttonIndex: -1 },
    strafeLeft: { stickIndex: 0, buttonIndex: -1 },
    strafeRight: { stickIndex: 0, buttonIndex: -1 },
    strafeUp: { stickIndex: 0, buttonIndex: -1 },
    strafeDown: { stickIndex: 0, buttonIndex: -1 },
    rollLeft: { stickIndex: 0, buttonIndex: -1 },
    rollRight: { stickIndex: 0, buttonIndex: -1 },
  },
};

export const PRESET_GENERIC_FLIGHT_STICK: FlightStickConfig = {
  ...DEFAULT_FLIGHT_STICK_CONFIG,
};

export const PRESET_HOTAS: FlightStickConfig = {
  enabled: true,
  primaryDeviceIndex: 0,
  secondaryDeviceIndex: 1, // Separate Throttle Quadrant on Gamepad index 1
  pedalsDeviceIndex: -1,
  axes: {
    pitch: { stickIndex: 0, axisIndex: 1, inverted: true, deadzone: 0.04, sensitivity: 1.0 },
    roll: { stickIndex: 0, axisIndex: 0, inverted: false, deadzone: 0.04, sensitivity: 1.0 },
    yaw: { stickIndex: 0, axisIndex: 2, inverted: false, deadzone: 0.05, sensitivity: 1.1 },
    surge: { stickIndex: 1, axisIndex: 2, inverted: true, deadzone: 0.02, sensitivity: 1.0, isThrottleSlider: true },
    sway: { stickIndex: 1, axisIndex: 0, inverted: false, deadzone: 0.06, sensitivity: 1.0 },
    heave: { stickIndex: 1, axisIndex: 1, inverted: true, deadzone: 0.06, sensitivity: 1.0 },
  },
  buttons: {
    primaryFire: { stickIndex: 0, buttonIndex: 0 },
    boost: { stickIndex: 1, buttonIndex: 0 },
    toggleDecoupled: { stickIndex: 1, buttonIndex: 1 },
    cycleTarget: { stickIndex: 0, buttonIndex: 1 },
    throttleForward: { stickIndex: 0, buttonIndex: -1 },
    throttleReverse: { stickIndex: 0, buttonIndex: -1 },
    strafeLeft: { stickIndex: 0, buttonIndex: -1 },
    strafeRight: { stickIndex: 0, buttonIndex: -1 },
    strafeUp: { stickIndex: 0, buttonIndex: -1 },
    strafeDown: { stickIndex: 0, buttonIndex: -1 },
    rollLeft: { stickIndex: 0, buttonIndex: -1 },
    rollRight: { stickIndex: 0, buttonIndex: -1 },
  },
};

export const PRESET_HOSAS_DUAL_STICK: FlightStickConfig = {
  enabled: true,
  primaryDeviceIndex: 0,   // Right Stick: Rotations (Pitch, Yaw, Roll)
  secondaryDeviceIndex: 1, // Left Stick: Translations (Surge, Sway, Heave)
  pedalsDeviceIndex: -1,
  axes: {
    pitch: { stickIndex: 0, axisIndex: 1, inverted: true, deadzone: 0.04, sensitivity: 1.0 },
    yaw: { stickIndex: 0, axisIndex: 2, inverted: false, deadzone: 0.05, sensitivity: 1.1 },
    roll: { stickIndex: 0, axisIndex: 0, inverted: false, deadzone: 0.04, sensitivity: 1.0 },
    surge: { stickIndex: 1, axisIndex: 1, inverted: true, deadzone: 0.04, sensitivity: 1.0 },
    sway: { stickIndex: 1, axisIndex: 0, inverted: false, deadzone: 0.04, sensitivity: 1.0 },
    heave: { stickIndex: 1, axisIndex: 2, inverted: false, deadzone: 0.05, sensitivity: 1.0 },
  },
  buttons: {
    primaryFire: { stickIndex: 0, buttonIndex: 0 }, // Right trigger
    boost: { stickIndex: 1, buttonIndex: 0 },       // Left trigger
    toggleDecoupled: { stickIndex: 1, buttonIndex: 1 },
    cycleTarget: { stickIndex: 0, buttonIndex: 1 },
    throttleForward: { stickIndex: 0, buttonIndex: -1 },
    throttleReverse: { stickIndex: 0, buttonIndex: -1 },
    strafeLeft: { stickIndex: 0, buttonIndex: -1 },
    strafeRight: { stickIndex: 0, buttonIndex: -1 },
    strafeUp: { stickIndex: 0, buttonIndex: -1 },
    strafeDown: { stickIndex: 0, buttonIndex: -1 },
    rollLeft: { stickIndex: 0, buttonIndex: -1 },
    rollRight: { stickIndex: 0, buttonIndex: -1 },
  },
};

export const PRESET_GAMEPAD: FlightStickConfig = {
  enabled: true,
  primaryDeviceIndex: 0,
  secondaryDeviceIndex: -1,
  pedalsDeviceIndex: -1,
  axes: {
    pitch: { stickIndex: 0, axisIndex: 1, inverted: true, deadzone: 0.08, sensitivity: 1.2 }, // Left Stick Y
    yaw: { stickIndex: 0, axisIndex: 0, inverted: false, deadzone: 0.08, sensitivity: 1.2 },  // Left Stick X
    roll: { stickIndex: 0, axisIndex: 2, inverted: false, deadzone: 0.08, sensitivity: 1.2 }, // Right Stick X
    surge: { stickIndex: 0, axisIndex: 3, inverted: true, deadzone: 0.08, sensitivity: 1.0 }, // Right Stick Y
    sway: { stickIndex: 0, axisIndex: -1, inverted: false, deadzone: 0.08, sensitivity: 1.0 },
    heave: { stickIndex: 0, axisIndex: -1, inverted: false, deadzone: 0.08, sensitivity: 1.0 },
  },
  buttons: {
    primaryFire: { stickIndex: 0, buttonIndex: 7 }, // Right Trigger
    boost: { stickIndex: 0, buttonIndex: 10 },      // Left Stick Click (L3)
    toggleDecoupled: { stickIndex: 0, buttonIndex: 3 }, // Y / Triangle
    cycleTarget: { stickIndex: 0, buttonIndex: 2 },     // X / Square
    throttleForward: { stickIndex: 0, buttonIndex: 12 },// D-Pad Up
    throttleReverse: { stickIndex: 0, buttonIndex: 13 },// D-Pad Down
    strafeLeft: { stickIndex: 0, buttonIndex: 14 },     // D-Pad Left
    strafeRight: { stickIndex: 0, buttonIndex: 15 },    // D-Pad Right
    strafeUp: { stickIndex: 0, buttonIndex: 5 },        // Right Bumper
    strafeDown: { stickIndex: 0, buttonIndex: 4 },      // Left Bumper
    rollLeft: { stickIndex: 0, buttonIndex: -1 },
    rollRight: { stickIndex: 0, buttonIndex: -1 },
  },
};

/**
 * Loads the active input device mode (KBM vs Flight Stick) from LocalStorage
 */
export function loadInputDeviceMode(): InputDeviceMode {
  try {
    const saved = localStorage.getItem(INPUT_MODE_STORAGE_KEY);
    if (saved === 'flight_stick' || saved === 'keyboard_mouse' || saved === 'hosam') {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to load input device mode from localStorage', e);
  }
  return 'keyboard_mouse';
}

/**
 * Persists the input device mode to LocalStorage
 */
export function saveInputDeviceMode(mode: InputDeviceMode): void {
  try {
    localStorage.setItem(INPUT_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Failed to save input device mode to localStorage', e);
  }
}

/**
 * Loads the Flight Stick configuration from LocalStorage
 */
export function loadFlightStickConfig(): FlightStickConfig {
  try {
    const saved = localStorage.getItem(FLIGHT_STICK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_FLIGHT_STICK_CONFIG,
        ...parsed,
        axes: { ...DEFAULT_FLIGHT_STICK_CONFIG.axes, ...(parsed.axes || {}) },
        buttons: { ...DEFAULT_FLIGHT_STICK_CONFIG.buttons, ...(parsed.buttons || {}) },
      };
    }
  } catch (e) {
    console.warn('Failed to load flight stick config from localStorage', e);
  }
  return { ...DEFAULT_FLIGHT_STICK_CONFIG };
}

/**
 * Persists the Flight Stick configuration to LocalStorage
 */
export function saveFlightStickConfig(config: FlightStickConfig): void {
  try {
    localStorage.setItem(FLIGHT_STICK_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save flight stick config to localStorage', e);
  }
}

/**
 * Polls currently connected Gamepads from the Web Gamepad API
 */
export function pollGamepads(): DetectedGamepadInfo[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return [];
  }

  const rawGamepads = navigator.getGamepads();
  const list: DetectedGamepadInfo[] = [];

  for (let i = 0; i < rawGamepads.length; i++) {
    const gp = rawGamepads[i];
    if (gp && gp.connected) {
      list.push({
        index: gp.index,
        id: gp.id || `Joystick / Gamepad ${gp.index + 1}`,
        axesCount: gp.axes ? gp.axes.length : 0,
        buttonsCount: gp.buttons ? gp.buttons.length : 0,
        connected: gp.connected,
        timestamp: gp.timestamp,
        axesValues: gp.axes ? Array.from(gp.axes) : [],
        buttonsPressed: gp.buttons ? gp.buttons.map((b) => b.pressed || b.value > 0.5) : [],
      });
    }
  }

  return list;
}

/**
 * Normalizes an analog axis value with deadzone and power curve response:
 * f(x) = sign(x) * ((|x| - deadzone) / (1 - deadzone))^sensitivity
 */
export function processAxisValue(rawValue: number, config: FlightStickAxisConfig): number {
  if (isNaN(rawValue)) return 0;

  // Invert if configured
  let val = config.inverted ? -rawValue : rawValue;

  const deadzone = Math.max(0.01, Math.min(0.5, config.deadzone || 0.05));
  const absVal = Math.abs(val);

  if (absVal <= deadzone) {
    return 0;
  }

  // Rescale smoothly from deadzone edge (0.0) to full stick edge (1.0)
  const normalized = (absVal - deadzone) / (1.0 - deadzone);
  const clamped = Math.max(0, Math.min(1.0, normalized));

  // Apply sensitivity exponent / power curve
  const sensitivity = Math.max(0.5, Math.min(3.0, config.sensitivity || 1.0));
  const curved = Math.pow(clamped, sensitivity);

  return Math.sign(val) * curved;
}

/**
 * Helper to get Gamepad by stick index (0 = primary, 1 = secondary, etc.)
 */
function getTargetGamepad(
  config: FlightStickConfig,
  stickSlot: number,
  gamepads: (Gamepad | null)[]
): Gamepad | null {
  let activeDeviceIndex = 0;
  if (stickSlot === 2) {
    activeDeviceIndex = config.pedalsDeviceIndex >= 0 ? config.pedalsDeviceIndex : 2;
  } else if (stickSlot === 1) {
    activeDeviceIndex = config.secondaryDeviceIndex >= 0 ? config.secondaryDeviceIndex : 1;
  } else {
    activeDeviceIndex = config.primaryDeviceIndex >= 0 ? config.primaryDeviceIndex : 0;
  }

  // Try direct index
  if (gamepads[activeDeviceIndex] && gamepads[activeDeviceIndex]?.connected) {
    return gamepads[activeDeviceIndex];
  }

  // Fallback: first available connected gamepad
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i]?.connected) {
      return gamepads[i];
    }
  }

  return null;
}

/**
 * Reads 6-DoF continuous analog thruster deflections and button states from connected flight stick(s)
 */
export function readFlightStickInputs(
  config: FlightStickConfig,
  gamepads: (Gamepad | null)[]
): {
  pitch: number;
  yaw: number;
  roll: number;
  surge: number;
  sway: number;
  heave: number;
  primaryFire: boolean;
  boost: boolean;
  toggleDecoupled: boolean;
  cycleTarget: boolean;
} {
  const result = {
    pitch: 0,
    yaw: 0,
    roll: 0,
    surge: 0,
    sway: 0,
    heave: 0,
    primaryFire: false,
    boost: false,
    toggleDecoupled: false,
    cycleTarget: false,
  };

  if (!config.enabled || !gamepads || gamepads.length === 0) {
    return result;
  }

  // Helper to read an axis
  const readAxis = (axisCfg: FlightStickAxisConfig): number => {
    if (axisCfg.axisIndex < 0) return 0;
    const gp = getTargetGamepad(config, axisCfg.stickIndex, gamepads);
    if (!gp || !gp.axes || axisCfg.axisIndex >= gp.axes.length) return 0;
    const raw = gp.axes[axisCfg.axisIndex];
    return processAxisValue(raw, axisCfg);
  };

  // Helper to read a button
  const readButton = (btnCfg: FlightStickButtonConfig): boolean => {
    if (btnCfg.buttonIndex < 0) return false;
    const gp = getTargetGamepad(config, btnCfg.stickIndex, gamepads);
    if (!gp || !gp.buttons || btnCfg.buttonIndex >= gp.buttons.length) return false;
    const btn = gp.buttons[btnCfg.buttonIndex];
    return !!btn && (btn.pressed || btn.value > 0.5);
  };

  // 1. Read Analog Axes
  result.pitch = readAxis(config.axes.pitch);
  result.yaw = readAxis(config.axes.yaw);
  result.roll = readAxis(config.axes.roll);
  result.surge = readAxis(config.axes.surge);
  result.sway = readAxis(config.axes.sway);
  result.heave = readAxis(config.axes.heave);

  // 2. Read Buttons (analog or hat discrete overrides)
  result.primaryFire = readButton(config.buttons.primaryFire);
  result.boost = readButton(config.buttons.boost);
  result.toggleDecoupled = readButton(config.buttons.toggleDecoupled);
  result.cycleTarget = readButton(config.buttons.cycleTarget);

  // Discrete directional button overlays (e.g. hat switch strafe)
  if (readButton(config.buttons.throttleForward)) result.surge = Math.max(result.surge, 1.0);
  if (readButton(config.buttons.throttleReverse)) result.surge = Math.min(result.surge, -1.0);
  if (readButton(config.buttons.strafeRight)) result.sway = Math.max(result.sway, 1.0);
  if (readButton(config.buttons.strafeLeft)) result.sway = Math.min(result.sway, -1.0);
  if (readButton(config.buttons.strafeUp)) result.heave = Math.max(result.heave, 1.0);
  if (readButton(config.buttons.strafeDown)) result.heave = Math.min(result.heave, -1.0);
  if (readButton(config.buttons.rollRight)) result.roll = Math.max(result.roll, 1.0);
  if (readButton(config.buttons.rollLeft)) result.roll = Math.min(result.roll, -1.0);

  return result;
}
