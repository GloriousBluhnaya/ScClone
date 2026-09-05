import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Gamepad as GamepadIcon,
  RotateCcw,
  Sliders,
  Check,
  AlertCircle,
  Sparkles,
  Crosshair,
  Zap,
  Activity,
  ChevronRight,
  Shield,
  Compass,
} from 'lucide-react';
import {
  FlightStickConfig,
  DetectedGamepadInfo,
  FlightStickAxisConfig,
} from '../types';
import {
  pollGamepads,
  processAxisValue,
  PRESET_GENERIC_FLIGHT_STICK,
  PRESET_HOTAS,
  PRESET_HOSAS_DUAL_STICK,
  PRESET_GAMEPAD,
} from '../utils/flightStickConfig';

interface FlightStickSetupProps {
  config: FlightStickConfig;
  onUpdateConfig: (newConfig: FlightStickConfig) => void;
  onResetDefaults: () => void;
}

export const FlightStickSetup: React.FC<FlightStickSetupProps> = ({
  config,
  onUpdateConfig,
  onResetDefaults,
}) => {
  const [detectedGamepads, setDetectedGamepads] = useState<DetectedGamepadInfo[]>([]);
  const [detectingAxisFor, setDetectingAxisFor] = useState<keyof FlightStickConfig['axes'] | null>(null);
  const [listeningButtonFor, setListeningButtonFor] = useState<keyof FlightStickConfig['buttons'] | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ text: string; type: 'success' | 'info' | 'warn' } | null>(null);

  // Keep ref for detecting axis changes
  const initialAxesSnapRef = useRef<{ [gpIdx: number]: number[] }>({});

  // Poll connected gamepads at 60fps for silky smooth live calibration visualizers
  useEffect(() => {
    let animId: number;
    const pollLoop = () => {
      const gps = pollGamepads();
      setDetectedGamepads(gps);

      // Auto-detect axis movement if in axis detect mode
      if (detectingAxisFor && gps.length > 0) {
        for (const gp of gps) {
          const initial = initialAxesSnapRef.current[gp.index] || [];
          for (let a = 0; a < gp.axesValues.length; a++) {
            const currentVal = gp.axesValues[a];
            const initVal = initial[a] || 0;
            const delta = Math.abs(currentVal - initVal);
            if (delta > 0.45 && Math.abs(currentVal) > 0.4) {
              // Detected significant movement on this axis!
              const stickSlot = gp.index === config.secondaryDeviceIndex ? 1 : 0;
              const updated = {
                ...config,
                axes: {
                  ...config.axes,
                  [detectingAxisFor]: {
                    ...config.axes[detectingAxisFor],
                    stickIndex: stickSlot,
                    axisIndex: a,
                  },
                },
              };
              onUpdateConfig(updated);
              setDetectingAxisFor(null);
              showFeedback(`Mapped ${detectingAxisFor.toUpperCase()} to Axis ${a} (${gp.id.slice(0, 24)})`, 'success');
              break;
            }
          }
        }
      }

      // Auto-detect button press if in button detect mode
      if (listeningButtonFor && gps.length > 0) {
        for (const gp of gps) {
          for (let b = 0; b < gp.buttonsPressed.length; b++) {
            if (gp.buttonsPressed[b]) {
              const stickSlot = gp.index === config.secondaryDeviceIndex ? 1 : 0;
              const updated = {
                ...config,
                buttons: {
                  ...config.buttons,
                  [listeningButtonFor]: {
                    stickIndex: stickSlot,
                    buttonIndex: b,
                  },
                },
              };
              onUpdateConfig(updated);
              setListeningButtonFor(null);
              showFeedback(`Mapped ${listeningButtonFor} to Button ${b} (${gp.id.slice(0, 24)})`, 'success');
              break;
            }
          }
        }
      }

      animId = requestAnimationFrame(pollLoop);
    };

    animId = requestAnimationFrame(pollLoop);
    return () => cancelAnimationFrame(animId);
  }, [detectingAxisFor, listeningButtonFor, config, onUpdateConfig]);

  const showFeedback = (text: string, type: 'success' | 'info' | 'warn' = 'info') => {
    setStatusFeedback({ text, type });
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const startAxisDetection = (axisKey: keyof FlightStickConfig['axes']) => {
    // Snapshot current axes to compare against
    const snap: { [gpIdx: number]: number[] } = {};
    detectedGamepads.forEach((gp) => {
      snap[gp.index] = [...gp.axesValues];
    });
    initialAxesSnapRef.current = snap;
    setDetectingAxisFor(axisKey);
    setListeningButtonFor(null);
    showFeedback(`Move stick/axis firmly for ${axisKey.toUpperCase()} to auto-detect...`, 'info');
  };

  const startButtonDetection = (buttonKey: keyof FlightStickConfig['buttons']) => {
    setListeningButtonFor(buttonKey);
    setDetectingAxisFor(null);
    showFeedback(`Press any physical button on your flight stick for ${buttonKey}...`, 'info');
  };

  const handleUpdateAxis = (
    axisKey: keyof FlightStickConfig['axes'],
    updates: Partial<FlightStickAxisConfig>
  ) => {
    onUpdateConfig({
      ...config,
      axes: {
        ...config.axes,
        [axisKey]: {
          ...config.axes[axisKey],
          ...updates,
        },
      },
    });
  };

  const handleApplyPreset = (presetName: string, preset: FlightStickConfig) => {
    onUpdateConfig({
      ...preset,
      primaryDeviceIndex: config.primaryDeviceIndex,
      secondaryDeviceIndex: config.secondaryDeviceIndex,
    });
    showFeedback(`Applied "${presetName}" preset successfully`, 'success');
  };

  // Helper to get live processed value for an axis
  const getLiveAxisValue = (axisCfg: FlightStickAxisConfig): { raw: number; processed: number } => {
    const gp =
      axisCfg.stickIndex === 1
        ? detectedGamepads.find((g) => g.index === config.secondaryDeviceIndex) || detectedGamepads[1]
        : detectedGamepads.find((g) => g.index === config.primaryDeviceIndex) || detectedGamepads[0];

    if (!gp || axisCfg.axisIndex < 0 || axisCfg.axisIndex >= gp.axesValues.length) {
      return { raw: 0, processed: 0 };
    }

    const raw = gp.axesValues[axisCfg.axisIndex] || 0;
    const processed = processAxisValue(raw, axisCfg);
    return { raw, processed };
  };

  const primaryGamepad = detectedGamepads.find((g) => g.index === config.primaryDeviceIndex) || detectedGamepads[0];

  return (
    <div className="flex flex-col gap-5 text-slate-200 select-text">
      {/* DEVICE DETECTION BANNER */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                detectedGamepads.length > 0 ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Web Gamepad API Hardware Status
              </span>
              <span className="text-[11px] text-slate-400 ml-2">
                ({detectedGamepads.length} device{detectedGamepads.length !== 1 ? 's' : ''} active)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Primary Stick:</span>
            <select
              value={config.primaryDeviceIndex}
              onChange={(e) => onUpdateConfig({ ...config, primaryDeviceIndex: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500"
            >
              {detectedGamepads.length === 0 ? (
                <option value="0">Auto (Device #1)</option>
              ) : (
                detectedGamepads.map((gp) => (
                  <option key={gp.index} value={gp.index}>
                    [{gp.index}] {gp.id.slice(0, 32)}
                  </option>
                ))
              )}
            </select>

            <span className="text-[11px] text-slate-400 ml-2">Secondary/Throttle:</span>
            <select
              value={config.secondaryDeviceIndex}
              onChange={(e) => onUpdateConfig({ ...config, secondaryDeviceIndex: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="-1">None (Single Stick)</option>
              {detectedGamepads.map((gp) => (
                <option key={gp.index} value={gp.index}>
                  [{gp.index}] {gp.id.slice(0, 32)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {detectedGamepads.length === 0 ? (
          <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-300">No active joystick detected yet</p>
              <p className="text-[11px] text-amber-200/80">
                Web browsers require user interaction before activating the Gamepad API. 
                <span className="text-white font-medium ml-1">Move your joystick or press any flight stick button</span> to wake the device.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {detectedGamepads.map((gp) => (
              <div
                key={gp.index}
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  gp.index === config.primaryDeviceIndex
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                    : gp.index === config.secondaryDeviceIndex
                    ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="truncate pr-2">
                  <span className="font-mono font-bold mr-1.5 text-cyan-400">#{gp.index}</span>
                  <span className="font-medium text-white">{gp.id}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 shrink-0">
                  {gp.axesCount} Axes • {gp.buttonsCount} Buttons
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATUS FEEDBACK BAR */}
      {statusFeedback && (
        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium animate-fadeIn ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
              : statusFeedback.type === 'warn'
              ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
              : 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* QUICK PRESET SELECTORS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Quick Hardware Presets:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleApplyPreset('Generic Flight Stick', PRESET_GENERIC_FLIGHT_STICK)}
            className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all"
          >
            Generic 3/4-Axis Stick
          </button>
          <button
            onClick={() => handleApplyPreset('HOTAS (Stick + Throttle)', PRESET_HOTAS)}
            className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all"
          >
            HOTAS (Stick + Throttle)
          </button>
          <button
            onClick={() => handleApplyPreset('Dual Stick (HOSAS)', PRESET_HOSAS_DUAL_STICK)}
            className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all"
          >
            HOSAS (Dual Sticks)
          </button>
          <button
            onClick={() => handleApplyPreset('Standard Gamepad', PRESET_GAMEPAD)}
            className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all"
          >
            Gamepad / Controller
          </button>
        </div>
      </div>

      {/* 6-DoF AXIS CALIBRATION & LIVE METERS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>6-DoF Flight Axes & Live Calibration</span>
          </h4>
          <span className="text-[10px] text-slate-400">
            Real-time analog deflection (-100% to +100%)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              { key: 'pitch', label: 'Pitch (Nose Up / Down)', desc: 'Y-axis deflection' },
              { key: 'yaw', label: 'Yaw (Nose Left / Right)', desc: 'Z-twist or X-rudder' },
              { key: 'roll', label: 'Roll (Bank Left / Right)', desc: 'X-axis tilt' },
              { key: 'surge', label: 'Surge (Throttle / Reverse)', desc: 'Forward/back strafe slider' },
              { key: 'sway', label: 'Sway (Strafe Lateral)', desc: 'Left/right thrusters' },
              { key: 'heave', label: 'Heave (Strafe Vertical)', desc: 'Dorsal/ventral thrusters' },
            ] as const
          ).map(({ key, label, desc }) => {
            const axisCfg = config.axes[key];
            const { raw, processed } = getLiveAxisValue(axisCfg);
            const isDetecting = detectingAxisFor === key;
            const pct = Math.round(processed * 100);

            return (
              <div
                key={key}
                className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
                  isDetecting
                    ? 'bg-cyan-950/60 border-cyan-400 ring-1 ring-cyan-400 shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Row: Label, Device, Axis Select, Auto-Detect */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white tracking-wide block">
                      {label}
                    </span>
                    <span className="text-[10px] text-slate-400">{desc}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => (isDetecting ? setDetectingAxisFor(null) : startAxisDetection(key))}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                        isDetecting
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30'
                      }`}
                      title="Move your flight stick to auto-assign this axis"
                    >
                      {isDetecting ? 'Move Axis...' : 'Auto-Detect'}
                    </button>

                    <select
                      value={axisCfg.axisIndex}
                      onChange={(e) => handleUpdateAxis(key, { axisIndex: Number(e.target.value) })}
                      className="bg-slate-950 border border-slate-700 text-cyan-300 text-[11px] rounded px-1.5 py-0.5"
                    >
                      <option value="-1">Disabled</option>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((a) => (
                        <option key={a} value={a}>
                          Axis {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Meter Bar */}
                <div className="space-y-1">
                  <div className="h-4 bg-slate-950 rounded border border-slate-800 overflow-hidden relative flex items-center justify-center">
                    {/* Center zero line */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-700 z-10" />

                    {/* Deadzone visual band */}
                    <div
                      className="absolute top-0 bottom-0 bg-slate-800/40 z-0"
                      style={{
                        left: `${50 - axisCfg.deadzone * 50}%`,
                        width: `${axisCfg.deadzone * 100}%`,
                      }}
                    />

                    {/* Active deflection bar */}
                    {processed < 0 ? (
                      <div
                        className="absolute top-0 bottom-0 bg-rose-500/80 transition-[width] duration-75"
                        style={{
                          right: '50%',
                          width: `${Math.min(50, Math.abs(processed) * 50)}%`,
                        }}
                      />
                    ) : (
                      <div
                        className="absolute top-0 bottom-0 bg-cyan-500/80 transition-[width] duration-75"
                        style={{
                          left: '50%',
                          width: `${Math.min(50, processed * 50)}%`,
                        }}
                      />
                    )}

                    {/* Readout overlay */}
                    <span className="relative z-20 text-[10px] font-mono font-bold text-white drop-shadow">
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Invert, Deadzone, Sensitivity */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pt-1 border-t border-slate-800/60">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={axisCfg.inverted}
                      onChange={(e) => handleUpdateAxis(key, { inverted: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Invert</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">DZ:</span>
                    <input
                      type="range"
                      min="0.01"
                      max="0.25"
                      step="0.01"
                      value={axisCfg.deadzone}
                      onChange={(e) => handleUpdateAxis(key, { deadzone: Number(e.target.value) })}
                      className="w-14 accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded"
                    />
                    <span className="font-mono text-[10px] text-cyan-300 w-6 text-right">
                      {Math.round(axisCfg.deadzone * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px]">Curve:</span>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={axisCfg.sensitivity}
                      onChange={(e) => handleUpdateAxis(key, { sensitivity: Number(e.target.value) })}
                      className="w-14 accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded"
                    />
                    <span className="font-mono text-[10px] text-cyan-300 w-6 text-right">
                      {axisCfg.sensitivity.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BUTTON MAPPING & LIVE BUTTON TESTER */}
      <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>Flight Stick Buttons & Trigger Mapping</span>
          </h4>
          <span className="text-[10px] text-slate-400">
            Click 'Bind' then press physical stick button
          </span>
        </div>

        {/* Live Buttons Grid Indicator */}
        {primaryGamepad && primaryGamepad.buttonsPressed.length > 0 && (
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono">
              Live Hardware Button Tester ({primaryGamepad.id.slice(0, 24)}):
            </span>
            <div className="flex flex-wrap gap-1">
              {primaryGamepad.buttonsPressed.slice(0, 16).map((isPressed, idx) => (
                <div
                  key={idx}
                  className={`w-7 h-7 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-all ${
                    isPressed
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/50 scale-105'
                      : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  B{idx}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Button Action Assignment List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(
            [
              { key: 'primaryFire', label: 'Primary Fire (Laser Cannons)', defaultDesc: 'Trigger (Btn 0)' },
              { key: 'boost', label: 'Boost / Afterburner', defaultDesc: 'Secondary Fire / Thumb (Btn 1)' },
              { key: 'toggleDecoupled', label: 'IFCS Coupled / Decoupled', defaultDesc: 'Mode Toggle (Btn 2)' },
              { key: 'cycleTarget', label: 'Cycle Target Lock', defaultDesc: 'Target Lock (Btn 3)' },
              { key: 'strafeUp', label: 'Strafe Up (Hat Up)', defaultDesc: 'Hat Up (Btn 4 / Hat)' },
              { key: 'strafeDown', label: 'Strafe Down (Hat Down)', defaultDesc: 'Hat Down (Btn 5 / Hat)' },
              { key: 'strafeLeft', label: 'Strafe Left (Hat Left)', defaultDesc: 'Hat Left (Btn 6 / Hat)' },
              { key: 'strafeRight', label: 'Strafe Right (Hat Right)', defaultDesc: 'Hat Right (Btn 7 / Hat)' },
            ] as const
          ).map(({ key, label, defaultDesc }) => {
            const btnCfg = config.buttons[key];
            const isListening = listeningButtonFor === key;

            return (
              <div
                key={key}
                className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                  isListening
                    ? 'bg-cyan-950/70 border-cyan-400 ring-1 ring-cyan-400'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-white block">{label}</span>
                  <span className="text-[10px] text-slate-400">{defaultDesc}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-cyan-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {btnCfg.buttonIndex >= 0 ? `Button ${btnCfg.buttonIndex}` : 'None'}
                  </span>

                  <button
                    onClick={() =>
                      isListening ? setListeningButtonFor(null) : startButtonDetection(key)
                    }
                    className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                      isListening
                        ? 'bg-amber-500 text-slate-950 animate-pulse'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                    }`}
                  >
                    {isListening ? 'Press Stick Button...' : 'Bind'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
        <button
          onClick={onResetDefaults}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Flight Stick Config</span>
        </button>

        <span className="text-[11px] text-slate-400">
          All settings persist automatically to local profile
        </span>
      </div>
    </div>
  );
};
