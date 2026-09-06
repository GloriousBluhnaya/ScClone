import React, { useState } from 'react';
import { Users, Copy, Check, Sparkles, ArrowRight, Globe, Shield, RefreshCw, X } from 'lucide-react';

interface RoomLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onSwitchRoom: (newRoomId: string) => void;
  connectedPilotsCount: number;
  currentPing: number;
  customServerUrl: string;
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onSwitchRoom,
  connectedPilotsCount,
  currentPing,
  customServerUrl,
}) => {
  const [inputRoomId, setInputRoomId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const getFullShareUrl = (roomId: string) => {
    if (typeof window === 'undefined') return '';
    const shareUrl = new URL(window.location.origin + window.location.pathname);
    shareUrl.searchParams.set('room', roomId);
    if (customServerUrl && customServerUrl.trim().length > 0) {
      shareUrl.searchParams.set('server', customServerUrl.trim());
    }
    return shareUrl.toString();
  };

  const handleCopyLink = async () => {
    const url = getFullShareUrl(currentRoomId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        prompt('Copy this 1v1 duel link:', url);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentRoomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      prompt('Copy this room code:', currentRoomId);
    }
  };

  const handleJoinInput = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = inputRoomId.trim();
    if (!cleaned) return;

    // Support pasting full URL into input
    if (cleaned.includes('http') || cleaned.includes('?')) {
      try {
        const parsed = new URL(cleaned);
        const roomParam = parsed.searchParams.get('room');
        if (roomParam) cleaned = roomParam;
      } catch {
        // Fallback to substring matching
        const match = cleaned.match(/room=([^&]+)/);
        if (match) cleaned = decodeURIComponent(match[1]);
      }
    }

    onSwitchRoom(cleaned);
    setInputRoomId('');
    onClose();
  };

  const handleCreateNewRoom = () => {
    const newRoom = 'duel-' + Math.random().toString(36).substring(2, 8);
    onSwitchRoom(newRoom);
    onClose();
  };

  const handleJoinPublicArena = () => {
    onSwitchRoom('public-arena-1');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                1v1 Multiplayer Lobby
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    connectedPilotsCount >= 2
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {connectedPilotsCount >= 2 ? '2/2 PILOTS CONNECTED' : '1/2 PILOT (WAITING FOR OPPONENT)'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Both ships must share the same Room Code to duel each other in real time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Room Display */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase tracking-wider text-slate-400">Current Room ID</span>
            <span className="font-mono text-cyan-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentPing}ms RTT
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-900/90 border border-cyan-500/40 rounded-lg px-3 py-2">
            <span className="font-mono font-bold text-base text-cyan-300 tracking-wider">
              {currentRoomId}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-md font-semibold transition-colors shadow-sm"
                title="Copy full invite link with room parameter"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Game Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Match & Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={handleJoinPublicArena}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
              currentRoomId === 'public-arena-1'
                ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Public Arena 1 (Quick Match)</span>
          </button>

          <button
            onClick={handleCreateNewRoom}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>New Private Duel Room</span>
          </button>
        </div>

        {/* Join by Code / URL */}
        <form onSubmit={handleJoinInput} className="mt-4">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Join Friend's Room (Enter Code or Paste Link)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="e.g. duel-a7k3 or paste link..."
              className="flex-1 bg-slate-950/80 border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!inputRoomId.trim()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <span>Join</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Multiplayer Instructions Callout */}
        <div className="mt-5 p-3 rounded-xl bg-cyan-950/30 border border-cyan-900/40 text-[11px] text-cyan-200/90 leading-relaxed flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-300">How to test with your friend:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
              <li>Click <strong className="text-cyan-200">Copy Game Link</strong> and send it to your friend.</li>
              <li>Or open the link in a <strong className="text-cyan-200">second browser tab/window</strong> to test both ships locally.</li>
              <li>Both players will spawn in the arena with high-frequency 45Hz positional sync!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
