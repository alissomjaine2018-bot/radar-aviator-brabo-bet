import React from 'react';
import { CasinoHouse } from '../types';
import { HOUSE_INFO } from '../utils/radarApi';
import { Flame, Castle, CheckCircle2, Radio, Sparkles } from 'lucide-react';

interface HouseSelectorBarProps {
  currentHouse: CasinoHouse;
  onSelectHouse: (house: CasinoHouse) => void;
  className?: string;
}

export const HouseSelectorBar: React.FC<HouseSelectorBarProps> = ({
  currentHouse,
  onSelectHouse,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-[#120d26]/90 border border-purple-800/40 rounded-3xl p-2 sm:p-2.5 shadow-2xl backdrop-blur-md ${className}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {/* BOTÃO GRANDE: BET BRABO */}
        <button
          id="btn-switch-house-betbrabo"
          type="button"
          onClick={() => onSelectHouse('BETBRABO')}
          className={`relative p-3.5 sm:p-4 rounded-2xl text-left transition-all duration-300 cursor-pointer flex items-center justify-between overflow-hidden ${
            currentHouse === 'BETBRABO'
              ? 'bg-gradient-to-r from-purple-950 via-[#1c1340] to-indigo-950 border-2 border-purple-500 shadow-[0_0_24px_rgba(168,85,247,0.45)] ring-2 ring-purple-500/40 scale-[1.01]'
              : 'bg-[#150f2e]/60 hover:bg-[#1a1438] border border-purple-900/40 text-slate-400 hover:text-white'
          }`}
        >
          {/* Ambient Glow */}
          {currentHouse === 'BETBRABO' && (
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
          )}

          <div className="flex items-center gap-3.5 relative z-10">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform ${
                currentHouse === 'BETBRABO'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 text-white shadow-lg shadow-purple-950/60 scale-105'
                  : 'bg-purple-950/70 border border-purple-800/60 text-purple-300'
              }`}
            >
              <Flame className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-base sm:text-lg font-black tracking-wide ${
                    currentHouse === 'BETBRABO' ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  BET BRABO
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 font-mono">
                  3 SALAS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Aviator 1 • Aviator VIP • Aviator Premium
              </p>
            </div>
          </div>

          <div className="shrink-0 relative z-10">
            {currentHouse === 'BETBRABO' ? (
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-700/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>ATIVO</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500 group-hover:text-purple-300">
                Selecionar ➔
              </span>
            )}
          </div>
        </button>

        {/* BOTÃO GRANDE: TORRE BET */}
        <button
          id="btn-switch-house-torrebet"
          type="button"
          onClick={() => onSelectHouse('TORREBET')}
          className={`relative p-3.5 sm:p-4 rounded-2xl text-left transition-all duration-300 cursor-pointer flex items-center justify-between overflow-hidden ${
            currentHouse === 'TORREBET'
              ? 'bg-gradient-to-r from-emerald-950 via-[#0e2722] to-teal-950 border-2 border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.45)] ring-2 ring-emerald-400/40 scale-[1.01]'
              : 'bg-[#150f2e]/60 hover:bg-[#1a1438] border border-purple-900/40 text-slate-400 hover:text-white'
          }`}
        >
          {/* Ambient Glow */}
          {currentHouse === 'TORREBET' && (
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-600/20 rounded-full blur-2xl pointer-events-none" />
          )}

          <div className="flex items-center gap-3.5 relative z-10">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform ${
                currentHouse === 'TORREBET'
                  ? 'bg-gradient-to-tr from-emerald-500 via-teal-600 to-amber-400 text-white shadow-lg shadow-emerald-950/60 scale-105'
                  : 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-300'
              }`}
            >
              <Castle className="w-6 h-6 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-base sm:text-lg font-black tracking-wide ${
                    currentHouse === 'TORREBET' ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  TORRE BET
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono">
                  2 GRÁFICOS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Aviator 1 • Aviator 2 (API Oficial Torre Bet)
              </p>
            </div>
          </div>

          <div className="shrink-0 relative z-10">
            {currentHouse === 'TORREBET' ? (
              <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-500/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>ATIVO</span>
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500 group-hover:text-emerald-300">
                Selecionar ➔
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
