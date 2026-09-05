import { ControlActionId, KeyBindingItem, KeyBindingsMap } from '../types';

export const STORAGE_KEY = 'star_citizen_keybindings_v2';

export const DEFAULT_KEYBINDINGS: KeyBindingsMap = {
  throttleForward: {
    id: 'throttleForward',
    label: 'Throttle Forward (Surge)',
    category: 'translations',
    primary: 'KeyW',
    secondary: 'ArrowUp',
    description: 'Main forward propulsion thrusters (up to 8G)',
  },
  throttleReverse: {
    id: 'throttleReverse',
    label: 'Throttle Reverse (Retro)',
    category: 'translations',
    primary: 'KeyS',
    secondary: 'ArrowDown',
    description: 'Reverse retro-braking thrusters (up to 3G)',
  },
  strafeLeft: {
    id: 'strafeLeft',
    label: 'Strafe Port (Sway Left)',
    category: 'translations',
    primary: 'KeyA',
    secondary: 'ArrowLeft',
    description: 'Port lateral maneuvering thrusters (up to 5G)',
  },
  strafeRight: {
    id: 'strafeRight',
    label: 'Strafe Starboard (Sway Right)',
    category: 'translations',
    primary: 'KeyD',
    secondary: 'ArrowRight',
    description: 'Starboard lateral maneuvering thrusters (up to 5G)',
  },
  strafeUp: {
    id: 'strafeUp',
    label: 'Strafe Dorsal (Heave Up)',
    category: 'translations',
    primary: 'Space',
    secondary: 'KeyR',
    description: 'Dorsal vertical maneuvering thrusters (up to 5G)',
  },
  strafeDown: {
    id: 'strafeDown',
    label: 'Strafe Ventral (Heave Down)',
    category: 'translations',
    primary: 'ControlLeft',
    secondary: 'ControlRight',
    description: 'Ventral vertical maneuvering thrusters (up to 5G)',
  },
  rollLeft: {
    id: 'rollLeft',
    label: 'Roll Counter-Clockwise',
    category: 'rotations',
    primary: 'KeyQ',
    description: 'Roll ship counter-clockwise around longitudinal axis',
  },
  rollRight: {
    id: 'rollRight',
    label: 'Roll Clockwise',
    category: 'rotations',
    primary: 'KeyE',
    description: 'Roll ship clockwise around longitudinal axis',
  },
  recenterVJoy: {
    id: 'recenterVJoy',
    label: 'Recenter Virtual Stick',
    category: 'rotations',
    primary: 'KeyX',
    secondary: 'Mouse2',
    description: 'Instantly resets mouse pitch & yaw deflection to (0,0)',
  },
  invertPitch: {
    id: 'invertPitch',
    label: 'Toggle Pitch Inversion',
    category: 'rotations',
    primary: 'KeyI',
    description: 'Inverts vertical flight stick pitch axis direction',
  },
  toggleDecoupled: {
    id: 'toggleDecoupled',
    label: 'IFCS Coupled / Decoupled',
    category: 'systems',
    primary: 'KeyC',
    secondary: 'KeyV',
    description: 'Toggle Newtonian Decoupled drift vs IFCS computer stabilization',
  },
  boost: {
    id: 'boost',
    label: 'Afterburner / Boost',
    category: 'systems',
    primary: 'ShiftLeft',
    secondary: 'ShiftRight',
    description: 'Overcharge thrusters for 500 m/s surge speed and 2x acceleration',
  },
  cycleTarget: {
    id: 'cycleTarget',
    label: 'Cycle Radar Target',
    category: 'combat',
    primary: 'KeyT',
    description: 'Locks closest radar contact and calculates ballistics Lead PIP',
  },
  primaryFire: {
    id: 'primaryFire',
    label: 'Fire Laser Cannons',
    category: 'combat',
    primary: 'Mouse0',
    secondary: 'KeyF',
    description: 'Triggers dual forward plasma laser cannons (L-Click or F)',
  },
};

/**
 * Transforms standard KeyboardEvent.code and mouse buttons into clean, gamer-friendly key labels.
 */
export function formatKeyLabel(code: string | undefined): string {
  if (!code) return 'NONE';

  // Standard Key letters
  if (code.startsWith('Key')) {
    return code.substring(3).toUpperCase();
  }

  // Digits
  if (code.startsWith('Digit')) {
    return code.substring(5);
  }

  // Numpad
  if (code.startsWith('Numpad')) {
    return `NUM ${code.substring(6)}`;
  }

  // Mouse Buttons & Wheel
  if (code === 'Mouse0') return 'L-CLICK (M1)';
  if (code === 'Mouse1') return 'M-CLICK (M3)';
  if (code === 'Mouse2') return 'R-CLICK (M2)';
  if (code === 'Mouse3') return 'MOUSE 4 (BACK)';
  if (code === 'Mouse4') return 'MOUSE 5 (FWD)';
  if (code === 'WheelUp') return 'WHEEL UP';
  if (code === 'WheelDown') return 'WHEEL DOWN';

  // Modifiers and Common Keys
  switch (code) {
    case 'Space':
      return 'SPACE';
    case 'ShiftLeft':
      return 'L-SHIFT';
    case 'ShiftRight':
      return 'R-SHIFT';
    case 'ControlLeft':
      return 'L-CTRL';
    case 'ControlRight':
      return 'R-CTRL';
    case 'AltLeft':
      return 'L-ALT';
    case 'AltRight':
      return 'R-ALT';
    case 'ArrowUp':
      return 'UP ARROW';
    case 'ArrowDown':
      return 'DOWN ARROW';
    case 'ArrowLeft':
      return 'LEFT ARROW';
    case 'ArrowRight':
      return 'RIGHT ARROW';
    case 'Tab':
      return 'TAB';
    case 'Enter':
      return 'ENTER';
    case 'Backspace':
      return 'BACKSPACE';
    case 'CapsLock':
      return 'CAPS';
    case 'Escape':
      return 'ESC';
    case 'Backquote':
      return '` (TILDE)';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Backslash':
      return '\\';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    default:
      return code.toUpperCase();
  }
}

/**
 * Loads stored keybindings from localStorage with fallback to default bindings.
 */
export function loadKeybindings(): KeyBindingsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYBINDINGS };
    const parsed = JSON.parse(raw);
    const merged: KeyBindingsMap = { ...DEFAULT_KEYBINDINGS };

    for (const key of Object.keys(DEFAULT_KEYBINDINGS) as ControlActionId[]) {
      if (parsed[key]) {
        merged[key] = {
          ...DEFAULT_KEYBINDINGS[key],
          primary: parsed[key].primary || DEFAULT_KEYBINDINGS[key].primary,
          secondary: parsed[key].secondary !== undefined ? parsed[key].secondary : DEFAULT_KEYBINDINGS[key].secondary,
        };
      }
    }
    return merged;
  } catch (err) {
    console.warn('Failed to load custom keybindings, falling back to defaults:', err);
    return { ...DEFAULT_KEYBINDINGS };
  }
}

/**
 * Saves current keybindings to localStorage.
 */
export function saveKeybindings(bindings: KeyBindingsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (err) {
    console.warn('Failed to save keybindings:', err);
  }
}

/**
 * Resets keybindings in localStorage to Star Citizen defaults.
 */
export function resetKeybindings(): KeyBindingsMap {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to reset keybindings:', err);
  }
  return { ...DEFAULT_KEYBINDINGS };
}

/**
 * Checks if a key code or mouse code matches a specific action's primary or secondary binding.
 */
export function doesCodeMatchAction(action: KeyBindingItem | undefined, code: string): boolean {
  if (!action || !code || code === 'NONE') return false;
  return (
    (!!action.primary && action.primary !== 'NONE' && action.primary === code) ||
    (!!action.secondary && action.secondary !== 'NONE' && action.secondary === code)
  );
}

/**
 * Finds if another action already has this key bound.
 */
export function findBindingConflict(
  bindings: KeyBindingsMap,
  targetActionId: ControlActionId,
  code: string,
  slot: 'primary' | 'secondary'
): KeyBindingItem | null {
  for (const item of Object.values(bindings)) {
    if (item.id === targetActionId) continue;
    if (item.primary === code || item.secondary === code) {
      return item;
    }
  }
  return null;
}
