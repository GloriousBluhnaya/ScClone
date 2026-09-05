import React, { useState } from 'react';
import { UNITY_SCRIPTS, UNITY_SETUP_GUIDE } from '../unity/unityScripts';
import { Copy, Check, Download, BookOpen, Code2, Cpu, Globe, Crosshair, Sparkles } from 'lucide-react';

export const UnityCodeStudio: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [selectedScriptIndex, setSelectedScriptIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'scripts' | 'guide'>('scripts');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentScript = UNITY_SCRIPTS[selectedScriptIndex];

  const handleCopy = () => {
    const textToCopy = activeTab === 'scripts' ? currentScript.code : UNITY_SETUP_GUIDE;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const content = activeTab === 'scripts' ? currentScript.code : UNITY_SETUP_GUIDE;
    const filename = activeTab === 'scripts' ? currentScript.fileName : 'README_Unity_Setup.md';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Physics':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case 'Targeting & HUD':
        return <Crosshair className="w-4 h-4 text-amber-400" />;
      case 'Weapons':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case 'Networking':
        return <Globe className="w-4 h-4 text-purple-400" />;
      default:
        return <Code2 className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8 select-text">
      <div className="relative w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-['Chakra_Petch',sans-serif]">
                  Unity & C# Newtonian Architecture Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                  Unity 2022+ / NGO 1.0+
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Production-ready C# scripts with Netcode for GameObjects & 6-DoF Newtonian physics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab('scripts')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'scripts'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>C# Scripts ({UNITY_SCRIPTS.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'guide'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Setup Guide</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors text-sm cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'scripts' ? (
            <>
              {/* Sidebar: Script List */}
              <div className="w-72 border-r border-slate-800 bg-slate-950/40 p-3 overflow-y-auto flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
                  Spaceship Subsystems
                </div>
                {UNITY_SCRIPTS.map((script, idx) => (
                  <button
                    key={script.fileName}
                    onClick={() => setSelectedScriptIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      selectedScriptIndex === idx
                        ? 'bg-slate-800/90 border-cyan-500/50 shadow-md text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getCategoryIcon(script.category)}
                      <span className="text-xs font-mono font-semibold truncate">
                        {script.fileName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">
                      {script.title}
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Code View Area */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                {/* Code Header Bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/50">
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="font-mono text-cyan-400">{currentScript.fileName}</span>
                      <span className="text-xs text-slate-500 font-normal">
                        — {currentScript.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{currentScript.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors active:scale-95"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadFile}
                      className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors active:scale-95 shadow-md shadow-cyan-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .cs</span>
                    </button>
                  </div>
                </div>

                {/* Code Text Area */}
                <div className="flex-1 p-5 overflow-auto font-['JetBrains_Mono',monospace] text-xs text-slate-300 leading-relaxed bg-[#0b0f19]">
                  <pre className="select-text whitespace-pre">
                    <code>{currentScript.code}</code>
                  </pre>
                </div>
              </div>
            </>
          ) : (
            /* Setup Guide Tab */
            <div className="flex-1 p-8 overflow-y-auto bg-slate-950 text-slate-300 leading-relaxed max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-xl font-bold text-white font-['Chakra_Petch',sans-serif]">
                    Unity Project Integration Guide
                  </h3>
                  <p className="text-sm text-slate-400">
                    Step-by-step instructions to configure Rigidbody, Netcode, and HUD
                  </p>
                </div>
                <button
                  onClick={handleDownloadFile}
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Guide (.md)</span>
                </button>
              </div>

              <div className="prose prose-invert max-w-none text-sm space-y-4">
                <pre className="bg-slate-900 border border-slate-800 p-5 rounded-xl font-mono text-xs overflow-x-auto text-cyan-300">
                  {UNITY_SETUP_GUIDE}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
