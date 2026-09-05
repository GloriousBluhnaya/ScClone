import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Navigation,
  Crosshair,
  Zap,
  Eye,
  RotateCw,
  Keyboard,
  RotateCcw,
  AlertCircle,
  Check,
  Search,
  Sliders,
  Sparkles,
  Gamepad,
  CheckCircle2,
} from 'lucide-react';
import {
  ControlActionId,
  ControlCategory,
  KeyBindingItem,
  KeyBindingsMap,
  InputDeviceMode,
  FlightStickConfig,
  VirtualJoystickState,
} from '../types';
import {
  formatKeyLabel,
  findBindingConflict,
} from '../utils/keybindings';
import { FlightStickSetup } from './FlightStickSetup';

interface FlightControlsGuideProps {
  isOpen: boolean;
  onClose: () => void;
  keybindings: KeyBindingsMap;
  onUpdateKeybindings: (newBindings: KeyBindingsMap) => void;
  onResetDefaults: () => void;
  inputDeviceMode: InputDeviceMode;
  onSelectInputDeviceMode: (mode: InputDeviceMode) => void;
  flightStickConfig: FlightStickConfig;
  onUpdateFlightStickConfig: (newConfig: FlightStickConfig) => void;
  onResetFlightStickDefaults: () => void;
  virtualJoystick: VirtualJoystickState;
  onUpdateVirtualJoystick: (vjoy: VirtualJoystickState) => void;
}

type ModalTab = 'keyboard_mouse' | 'flight_stick' | 'guide';

export const FlightControlsGuide: React.FC<FlightControlsGuideProps> = ({
  isOpen,
  onClose,
  keybindings,
  onUpdateKeybindings,
  onResetDefaults,
  inputDeviceMode,
  onSelectInputDeviceMode,
  flightStickConfig,
  onUpdateFlightStickConfig,
  onResetFlightStickDefaults,
  virtualJoystick,
  onUpdateVirtualJoystick,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(
    inputDeviceMode === 'flight_stick' ? 'flight_stick' : 'keyboard_mouse'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | ControlCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync tab when opening if input mode changed
  useEffect(() => {
    if (isOpen) {
      if (inputDeviceMode === 'flight_stick') {
        setActiveTab('flight_stick');
      } else {
        setActiveTab('keyboard_mouse');
      }
    }
  }, [isOpen, inputDeviceMode]);

  // Active key listening state
  const [listeningSlot, setListeningSlot] = useState<{
    actionId: ControlActionId;
    slot: 'primary' | 'secondary';
  } | null>(null);

  // Status message for conflict or feedback
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'warn' | 'info';
  } | null>(null);

  // Clear listening slot when modal closes
  useEffect(() => {
    if (!isOpen) {
      setListeningSlot(null);
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Global keydown, mousedown, wheel handler when in listening mode
  useEffect(() => {
    if (!listeningSlot) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape
      if (e.code === 'Escape') {
        setListeningSlot(null);
        setStatusMessage({ text: 'Key remapping cancelled', type: 'info' });
        setTimeout(() => setStatusMessage(null), 2500);
        return;
      }

      const newCode = e.code;
      applyRemap(listeningSlot.actionId, listeningSlot.slot, newCode);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If user clicked the cancel button or quick-select chip, let its handler work
      if (target?.closest('[data-cancel-rebind="true"]') || target?.closest('[data-quick-rebind="true"]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      applyRemap(listeningSlot.actionId, listeningSlot.slot, `Mouse${e.button}`);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      applyRemap(listeningSlot.actionId, listeningSlot.slot, code);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [listeningSlot, keybindings]);

  const applyRemap = (
    actionId: ControlActionId,
    slot: 'primary' | 'secondary',
    newCode: string
  ) => {
    const updated: KeyBindingsMap = { ...keybindings };
    const currentAction = updated[actionId];
    if (!currentAction) return;

    // Check conflict
    const conflict = findBindingConflict(keybindings, actionId, newCode, slot);

    if (conflict) {
      // Auto swap or reassign
      const conflictSlot = conflict.primary === newCode ? 'primary' : 'secondary';
      const oldCodeForCurrent = slot === 'primary' ? currentAction.primary : currentAction.secondary;

      if (conflictSlot === 'primary') {
        updated[conflict.id] = {
          ...conflict,
          primary: oldCodeForCurrent || 'NONE',
        };
      } else {
        updated[conflict.id] = {
          ...conflict,
          secondary: oldCodeForCurrent,
        };
      }

      setStatusMessage({
        text: `Reassigned "${formatKeyLabel(newCode)}" from ${conflict.label} to ${currentAction.label}`,
        type: 'warn',
      });
    } else {
      setStatusMessage({
        text: `Bound "${formatKeyLabel(newCode)}" to ${currentAction.label}`,
        type: 'success',
      });
    }

    // Set new key
    if (slot === 'primary') {
      updated[actionId] = {
        ...currentAction,
        primary: newCode,
      };
    } else {
      updated[actionId] = {
        ...currentAction,
        secondary: newCode,
      };
    }

    onUpdateKeybindings(updated);
    setListeningSlot(null);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleClearSecondary = (actionId: ControlActionId, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: KeyBindingsMap = { ...keybindings };
    if (updated[actionId]) {
      updated[actionId] = {
        ...updated[actionId],
        secondary: undefined,
      };
      onUpdateKeybindings(updated);
      setStatusMessage({
        text: `Cleared secondary binding for ${updated[actionId].label}`,
        type: 'info',
      });
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const handleReset = () => {
    onResetDefaults();
    setListeningSlot(null);
    setStatusMessage({
      text: 'All controls reset to Star Citizen / Newtonian defaults',
      type: 'success',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Filter actions for display
  const filteredActions = useMemo(() => {
    const list = Object.values(keybindings) as KeyBindingItem[];
    return list.filter((item) => {
      const matchesCategory =
        categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch =
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatKeyLabel(item.primary).toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatKeyLabel(item.secondary).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [keybindings, categoryFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6 select-text">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col font-['Chakra_Petch',sans-serif] overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Vessel Flight Controls & Keymapping</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300">
                  IFCS v4.2
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Configure 6-DoF Newtonian flight axes, virtual joystick, targeting & weapons
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
            title="Close Controls"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* INPUT DEVICE MODE SELECTOR BAR */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Active Flight Input Device:
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                onSelectInputDeviceMode('keyboard_mouse');
                setActiveTab('keyboard_mouse');
                setStatusMessage({ text: 'Active input switched to Mouse & Keyboard', type: 'info' });
                setTimeout(() => setStatusMessage(null), 2500);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                inputDeviceMode === 'keyboard_mouse'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Mouse & Keyboard</span>
              {inputDeviceMode === 'keyboard_mouse' && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                onSelectInputDeviceMode('flight_stick');
                setActiveTab('flight_stick');
                setStatusMessage({ text: 'Active input switched to Flight Stick / HOTAS', type: 'info' });
                setTimeout(() => setStatusMessage(null), 2500);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                inputDeviceMode === 'flight_stick'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Gamepad className="w-3.5 h-3.5" />
              <span>Flight Stick / HOTAS</span>
              {inputDeviceMode === 'flight_stick' && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-2 bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('keyboard_mouse')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'keyboard_mouse'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Keyboard & Mouse</span>
            </button>

            <button
              onClick={() => setActiveTab('flight_stick')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'flight_stick'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Gamepad className="w-3.5 h-3.5" />
              <span>Flight Stick & HOTAS Setup</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'guide'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Flight Manual & TVI Theory</span>
            </button>
          </div>

          {activeTab === 'keyboard_mouse' && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 hover:bg-slate-800 px-2.5 py-1 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-700"
              title="Reset all bindings to default Star Citizen layout"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Reset KBM Defaults</span>
            </button>
          )}
        </div>

        {/* FEEDBACK STATUS BANNER */}
        {statusMessage && (
          <div
            className={`px-6 py-2 text-xs flex items-center gap-2 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300'
                : statusMessage.type === 'warn'
                ? 'bg-amber-950/80 border-b border-amber-500/40 text-amber-300'
                : 'bg-cyan-950/80 border-b border-cyan-500/40 text-cyan-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-3.5 h-3.5" />
            ) : statusMessage.type === 'warn' ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span className="font-mono">{statusMessage.text}</span>
          </div>
        )}

        {/* LISTENING OVERLAY NOTICE */}
        {listeningSlot && (
          <div className="bg-cyan-950/95 border-b border-cyan-400/60 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="text-xs text-cyan-200 font-semibold">
                  Awaiting Input: Press any <strong className="text-white">keyboard key</strong>, click any <strong className="text-white">mouse button</strong>, or roll <strong className="text-white">mouse wheel</strong> for{' '}
                  <span className="text-cyan-300 underline underline-offset-2">
                    {keybindings[listeningSlot.actionId]?.label} ({listeningSlot.slot})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pl-4.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  Quick Mouse Assign:
                </span>
                {[
                  { code: 'Mouse0', label: 'Left Click' },
                  { code: 'Mouse2', label: 'Right Click' },
                  { code: 'Mouse1', label: 'Middle Click' },
                  { code: 'Mouse3', label: 'Mouse 4 (Back)' },
                  { code: 'Mouse4', label: 'Mouse 5 (Fwd)' },
                  { code: 'WheelUp', label: 'Wheel Up' },
                  { code: 'WheelDown', label: 'Wheel Down' },
                ].map((btn) => (
                  <button
                    key={btn.code}
                    type="button"
                    data-quick-rebind="true"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      applyRemap(listeningSlot.actionId, listeningSlot.slot, btn.code);
                    }}
                    className="px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-200 hover:text-white text-[10px] font-mono cursor-pointer transition-colors shadow-sm"
                  >
                    + {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              data-cancel-rebind="true"
              onClick={() => setListeningSlot(null)}
              className="text-[11px] font-mono text-cyan-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 px-3 py-1 rounded border border-cyan-500/40 cursor-pointer transition-colors shrink-0"
            >
              Press ESC to Cancel
            </button>
          </div>
        )}

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="p-6 overflow-y-auto max-h-[68vh] space-y-4 text-xs">
          {activeTab === 'keyboard_mouse' && (
            <div className="space-y-4">
              {/* Category Filter & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'all', label: 'All Actions' },
                      { id: 'translations', label: 'Translations (6-DoF)' },
                      { id: 'rotations', label: 'Rotations (V-Joy)' },
                      { id: 'systems', label: 'IFCS Systems' },
                      { id: 'combat', label: 'Combat & Weapons' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                        categoryFilter === cat.id
                          ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search controls..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  Click any keycap to rebind. Standard keyboard keys and mouse buttons (LMB, RMB, MMB) are supported.
                </span>
                <span className="font-mono text-cyan-400 text-[10px]">
                  {filteredActions.length} Actions
                </span>
              </div>

              {/* Controls Remapping Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/50">
                {filteredActions.map((action) => {
                  const isPrimaryListening =
                    listeningSlot?.actionId === action.id &&
                    listeningSlot.slot === 'primary';
                  const isSecondaryListening =
                    listeningSlot?.actionId === action.id &&
                    listeningSlot.slot === 'secondary';

                  return (
                    <div
                      key={action.id}
                      className="p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors"
                    >
                      {/* Left: Action Info */}
                      <div className="flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-xs">
                            {action.label}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                              action.category === 'translations'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                                : action.category === 'rotations'
                                ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20'
                                : action.category === 'systems'
                                ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                                : 'bg-red-950/60 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {action.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {action.description}
                        </p>
                      </div>

                      {/* Right: Key Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Primary Key Button */}
                        <button
                          onClick={() =>
                            setListeningSlot({
                              actionId: action.id,
                              slot: 'primary',
                            })
                          }
                          className={`min-w-[84px] px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center border cursor-pointer ${
                            isPrimaryListening
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                              : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-white shadow-sm'
                          }`}
                          title="Click to rebind primary key"
                        >
                          {isPrimaryListening ? (
                            <span className="text-[10px] tracking-wider animate-pulse">
                              PRESS KEY...
                            </span>
                          ) : (
                            formatKeyLabel(action.primary)
                          )}
                        </button>

                        {/* Secondary Key Button */}
                        <div className="relative flex items-center">
                          <button
                            onClick={() =>
                              setListeningSlot({
                                actionId: action.id,
                                slot: 'secondary',
                              })
                            }
                            className={`min-w-[84px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center justify-center border cursor-pointer ${
                              isSecondaryListening
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                                : action.secondary
                                ? 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-400 text-slate-300 hover:text-white'
                                : 'bg-slate-900/40 border-dashed border-slate-800 hover:border-slate-600 text-slate-500 hover:text-slate-300 text-[10px]'
                            }`}
                            title={
                              action.secondary
                                ? 'Click to rebind secondary key'
                                : 'Click to add alternate secondary key'
                            }
                          >
                            {isSecondaryListening ? (
                              <span className="text-[10px] tracking-wider animate-pulse">
                                PRESS KEY...
                              </span>
                            ) : action.secondary ? (
                              formatKeyLabel(action.secondary)
                            ) : (
                              '+ ALT KEY'
                            )}
                          </button>

                          {/* Clear Secondary Key button */}
                          {action.secondary && !isSecondaryListening && (
                            <button
                              onClick={(e) => handleClearSecondary(action.id, e)}
                              className="ml-1 p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                              title="Remove alternate key"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredActions.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No actions match your search query "{searchQuery}".
                  </div>
                )}
              </div>

              {/* Virtual Joystick Settings */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="font-semibold text-cyan-300 text-sm">Virtual Joystick Calibration</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Max Radius Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Max Radius (Sensitivity)</span>
                      <span className="text-cyan-400 font-mono">{virtualJoystick.maxRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="400"
                      step="5"
                      value={virtualJoystick.maxRadius}
                      onChange={(e) => onUpdateVirtualJoystick({ ...virtualJoystick, maxRadius: parseInt(e.target.value, 10) })}
                      className="w-full accent-cyan-500"
                    />
                    <p className="text-[10px] text-slate-500">How far the mouse travels for maximum turn.</p>
                  </div>

                  {/* Deadzone Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Deadzone Radius</span>
                      <span className="text-cyan-400 font-mono">{virtualJoystick.deadzoneRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={virtualJoystick.deadzoneRadius}
                      onChange={(e) => onUpdateVirtualJoystick({ ...virtualJoystick, deadzoneRadius: parseInt(e.target.value, 10) })}
                      className="w-full accent-cyan-500"
                    />
                    <p className="text-[10px] text-slate-500">Center area where mouse movement is ignored.</p>
                  </div>

                  {/* Opacity Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">V-Joy Opacity</span>
                      <span className="text-cyan-400 font-mono">{Math.round(virtualJoystick.circleOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={virtualJoystick.circleOpacity}
                      onChange={(e) => onUpdateVirtualJoystick({ ...virtualJoystick, circleOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-500"
                    />
                    <p className="text-[10px] text-slate-500">Visibility of the on-screen joystick circle.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'flight_stick' && (
            <FlightStickSetup
              config={flightStickConfig}
              onUpdateConfig={onUpdateFlightStickConfig}
              onResetDefaults={onResetFlightStickDefaults}
            />
          )}

          {activeTab === 'guide' && (
            /* FLIGHT MANUAL & THEORY TAB */
            <div className="space-y-4">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Rotations */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    <RotateCw className="w-4 h-4" />
                    <span>Virtual Joystick (V-Joy)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Mouse Pitch / Yaw</span>
                    <span className="font-mono text-cyan-300 font-semibold">Vector from HUD Center</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Recenter Joystick</span>
                    <span className="font-mono text-cyan-300 font-semibold">
                      [{formatKeyLabel(keybindings.recenterVJoy.primary)}]
                      {keybindings.recenterVJoy.secondary && ` or [${formatKeyLabel(keybindings.recenterVJoy.secondary)}]`}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Invert Pitch</span>
                    <span className="font-mono text-cyan-300 font-semibold">
                      [{formatKeyLabel(keybindings.invertPitch.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Roll Left / Right</span>
                    <span className="font-mono text-cyan-300 font-semibold">
                      [{formatKeyLabel(keybindings.rollLeft.primary)}] / [{formatKeyLabel(keybindings.rollRight.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-0.5 text-slate-400">
                    <span>Max Rotation Rates</span>
                    <span className="font-mono text-amber-300">Pitch 72°/s · Yaw 45°/s</span>
                  </div>
                </div>

                {/* Translations */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                    <Navigation className="w-4 h-4" />
                    <span>Linear 6-DoF Strafe</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Main Throttle / Surge</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      [{formatKeyLabel(keybindings.throttleForward.primary)}] / [{formatKeyLabel(keybindings.throttleReverse.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Lateral Strafe (Sway)</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      [{formatKeyLabel(keybindings.strafeLeft.primary)}] / [{formatKeyLabel(keybindings.strafeRight.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Vertical Strafe (Heave)</span>
                    <span className="font-mono text-emerald-300 font-semibold">
                      [{formatKeyLabel(keybindings.strafeUp.primary)}] / [{formatKeyLabel(keybindings.strafeDown.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-0.5 text-slate-400">
                    <span>Thruster Authority</span>
                    <span className="font-mono text-emerald-400 font-semibold">Fwd 8G · Strafe 5G · Rev 3G</span>
                  </div>
                </div>
              </div>

              {/* Combat & IFCS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                    <Zap className="w-4 h-4" />
                    <span>IFCS Flight Dynamics</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Coupled / Decoupled</span>
                    <span className="font-mono text-amber-300 font-semibold">
                      [{formatKeyLabel(keybindings.toggleDecoupled.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Afterburner / Boost</span>
                    <span className="font-mono text-amber-300 font-semibold">
                      [{formatKeyLabel(keybindings.boost.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-0.5 text-slate-400">
                    <span>Speed Limits</span>
                    <span className="font-mono text-amber-300">SCM 320 m/s · Boost 500 m/s</span>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-red-400 uppercase tracking-wider text-[11px]">
                    <Crosshair className="w-4 h-4" />
                    <span>Weapons & Target Lock</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span className="text-slate-400">Fire Laser Cannons</span>
                    <span className="font-mono text-red-300 font-semibold">
                      [{formatKeyLabel(keybindings.primaryFire.primary)}]
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cycle Radar Targets</span>
                    <span className="font-mono text-red-300 font-semibold">
                      [{formatKeyLabel(keybindings.cycleTarget.primary)}]
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Vector Indicator (TVI) & Ballistics Lead PIP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3.5 text-[11px] leading-relaxed flex flex-col gap-1.5">
                  <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-cyan-400" />
                    <span>Total Vector Indicator (TVI):</span>
                  </div>
                  <p className="text-slate-400">
                    The <strong className="text-cyan-300">TVI (winged circle)</strong> displays your true 3D direction of travel. In decoupled flight or during heavy strafes, your ship will drift away from where your nose is pointed; the dashed drift line and degree indicator show your current angle of slip. The <strong className="text-amber-400">ATVI</strong> marker indicates the retrograde (reverse) braking vector.
                  </p>
                </div>

                <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3.5 text-[11px] leading-relaxed flex flex-col gap-1.5">
                  <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Ballistics Lead PIP Intercept:</span>
                  </div>
                  <p className="text-slate-400">
                    Laser bolts inherit your ship's velocity plus 1250 m/s muzzle velocity. The targeting computer calculates where the target will be at projectile arrival time. Steer your crosshair directly onto the <strong className="text-cyan-300">Lead PIP diamond</strong> to score hits!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTION BAR */}
        <div className="border-t border-slate-800 px-6 py-3.5 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
            <span>Storage: Local Browser Storage</span>
            <span className="text-emerald-400">● Synced</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-lg shadow-cyan-600/20 active:scale-95"
            >
              Confirm & Return to Cockpit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
