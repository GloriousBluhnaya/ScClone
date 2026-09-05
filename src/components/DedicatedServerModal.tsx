import React, { useState, useEffect } from 'react';
import { Server, Wifi, Globe, Terminal, Check, RefreshCw, X, ShieldCheck } from 'lucide-react';

interface DedicatedServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customServerUrl: string;
  onSaveCustomServer: (url: string) => void;
  currentPing: number;
}

export const DedicatedServerModal: React.FC<DedicatedServerModalProps> = ({
  isOpen,
  onClose,
  customServerUrl,
  onSaveCustomServer,
  currentPing,
}) => {
  const [inputUrl, setInputUrl] = useState(customServerUrl);
  const [testingPing, setTestingPing] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    setInputUrl(customServerUrl);
  }, [customServerUrl, isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = () => {
    const target = inputUrl.trim() || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    setTestStatus('testing');
    const start = performance.now();

    try {
      const ws = new WebSocket(`${target.replace(/\/+$/, '')}?room=ping-test`);
      const timer = setTimeout(() => {
        ws.close();
        setTestStatus('error');
      }, 3500);

      ws.onopen = () => {
        const elapsed = Math.round(performance.now() - start);
        setTestingPing(elapsed);
        setTestStatus('success');
        clearTimeout(timer);
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        setTestStatus('error');
      };
    } catch {
      setTestStatus('error');
    }
  };

  const handleApply = () => {
    onSaveCustomServer(inputUrl.trim());
    onClose();
    window.location.reload();
  };

  const handleResetDefault = () => {
    onSaveCustomServer('');
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/80 rounded-xl border border-indigo-500/50 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">DEDICATED MULTIPLAYER SERVER</h2>
              <p className="text-xs text-indigo-400/80">Configure WebSocket Endpoint or Host Low-Latency Node</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-5 text-xs">
          {/* Current Status Badge */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${customServerUrl ? 'bg-indigo-400' : 'bg-emerald-400'} animate-pulse`} />
              <div>
                <span className="text-slate-400">Active Node: </span>
                <span className="font-bold text-white">
                  {customServerUrl ? 'Custom Dedicated VPS' : 'Cloud Run High Availability Node (EU)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded-md border border-slate-700">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentPing} ms</span>
            </div>
          </div>

          {/* Custom URL Input */}
          <div className="space-y-2">
            <label className="block text-slate-300 font-semibold">Custom Dedicated Server WebSocket URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="wss://your-dedicated-vps.com:3000 or ws://192.168.1.100:3000"
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-slate-200 outline-none transition-colors"
              />
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/50 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {testStatus === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span>Test Ping</span>
              </button>
            </div>

            {testStatus === 'success' && (
              <div className="text-emerald-400 text-[11px] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Connection successful! Latency: {testingPing} ms</span>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="text-rose-400 text-[11px]">
                Failed to connect to endpoint. Verify WebSocket server is running on target port and firewall allows traffic.
              </div>
            )}

            {/* HTTPS Mixed-Content Alert */}
            {typeof window !== 'undefined' && window.location.protocol === 'https:' && inputUrl.trim().startsWith('ws://') && (
              <div className="bg-amber-950/80 border border-amber-500/60 p-3 rounded-lg text-amber-300 text-[11px] space-y-1">
                <p className="font-bold">⚠️ Mixed Content Security Warning (HTTPS Page)</p>
                <p className="text-slate-300">
                  This website is loaded securely via <code className="text-amber-200">https://</code>. Web browsers strictly block unencrypted <code className="text-amber-200">ws://</code> connections on HTTPS pages.
                </p>
                <p className="text-slate-300">
                  • For remote VPS hosting: Use <code className="text-emerald-300 font-bold">wss://</code> (e.g. via Nginx reverse proxy with SSL certificate).<br />
                  • For local LAN/testing: Run the client locally on <code className="text-emerald-300 font-bold">http://localhost:3000</code> so <code className="text-amber-200">ws://</code> is allowed.
                </p>
              </div>
            )}
          </div>

          {/* Self-Hosting Instructions */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>How Connection Works for Both Players</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              When you configure a Custom Dedicated Server URL here and click <strong className="text-cyan-300">"Copy Game Link"</strong>, the generated invitation link automatically embeds your custom server endpoint (<code className="text-indigo-300">?server=...</code>). When Player 2 opens your link, their browser will automatically connect to your custom server!
            </p>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] select-all">
              # Launch standalone dedicated websocket server on any VPS/host<br />
              npm install &amp;&amp; npx tsx server.ts
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleResetDefault}
            className="text-slate-400 hover:text-slate-200 text-xs hover:underline cursor-pointer"
          >
            Reset to Default Cloud Node
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-indigo-600/30"
            >
              Apply &amp; Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
