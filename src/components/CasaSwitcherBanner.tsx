import React from 'react';
import { CasinoHouse } from '../types';
import { HOUSE_INFO, CHANNELS_BY_HOUSE, RADAR_CHANNELS } from '../utils/radarApi';
import { Flame, Castle, CheckCircle2, ArrowRight, Radio, Sparkles, Activity } from 'lucide-react';

interface CasaSwitcherBannerProps {
  currentHouse: CasinoHouse;
  onSelectHouse: (house: CasinoHouse) => void;
  candlesCount?: number;
}

export const CasaSwitcherBanner: React.FC<CasaSwitcherBannerProps> = ({
  currentHouse,
  onSelectHouse,
  candlesCount = 0,
}) => {
  const isTorre = currentHouse === 'TORREBET';
  const isBetbrabo = currentHouse === 'BETBRABO';

  return (
    <div className="bg-[#0e0a1e] border border-purple-900/50 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden mb-6">
      {/* Background glow ambiance */}
      <div
        className={`absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isTorre ? 'bg-emerald-600/15' : 'bg-purple-600/20'
        }`}
      />
      <div
        className={`absolute -bottom-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isTorre ? 'bg-emerald-500/10' : 'bg-amber-600/15'
        }`}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              Selecione a Casa de Apostas Oficial
            </span>
            <span
              className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border ${
                isTorre
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-purple-950 text-purple-300 border-purple-500/80 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
              }`}
            >
              {isTorre ? 'TORRE BET ATIVA' : 'BET BRAVO ATIVA'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Alterne entre as casas oficiais com 1 clique. Todas as abas, robôs e estratégias se adaptam à API da casa escolhida:
          </p>
        </div>

        {/* Right: Big interactive buttons for Bet Bravo and Torre Bet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto shrink-0">
          {/* BOTÃO GRANDE: BET BRAVO */}
          <button
            type="button"
            id="btn-switch-betbrabo"
            onClick={() => onSelectHouse('BETBRABO')}
            className={`group relative flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all duration-300 cursor-pointer text-left min-w-[240px] ${
              isBetbrabo
                ? 'bg-gradient-to-r from-[#20113f] to-[#170e2f] border-purple-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.5)] ring-2 ring-purple-400/40'
                : 'bg-[#130f24] hover:bg-[#1a1433] border-purple-900/60 text-slate-300 hover:border-purple-600 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                  isBetbrabo
                    ? 'bg-purple-600/30 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)] text-amber-300'
                    : 'bg-purple-950/60 border-purple-800/60 text-slate-400 group-hover:text-amber-400'
                }`}
              >
                <Flame className={`w-6 h-6 ${isBetbrabo ? 'animate-pulse text-amber-400' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-wide">BET BRAVO</span>
                  {isBetbrabo && (
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-purple-500 text-white uppercase">
                      Ativa
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-purple-300/80 block mt-0.5">
                  3 Gráficos Oficiais (1, VIP, Premium)
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {isBetbrabo ? (
                <div className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-purple-300" />
                </div>
              ) : (
                <span className="text-[11px] font-bold text-purple-400/70 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-transform flex items-center">
                  Ativar <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </span>
              )}
            </div>
          </button>

          {/* BOTÃO GRANDE: TORRE BET */}
          <button
            type="button"
            id="btn-switch-torrebet"
            onClick={() => onSelectHouse('TORREBET')}
            className={`group relative flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all duration-300 cursor-pointer text-left min-w-[240px] ${
              isTorre
                ? 'bg-gradient-to-r from-[#0d2a20] to-[#0a1e17] border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/40'
                : 'bg-[#130f24] hover:bg-[#0e211b] border-emerald-900/60 text-slate-300 hover:border-emerald-500 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                  isTorre
                    ? 'bg-emerald-600/30 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)] text-emerald-300'
                    : 'bg-emerald-950/60 border-emerald-800/60 text-slate-400 group-hover:text-emerald-400'
                }`}
              >
                <Castle className={`w-6 h-6 ${isTorre ? 'animate-pulse text-emerald-400' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-wide text-emerald-300">TORRE BET</span>
                  {isTorre && (
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500 text-black uppercase">
                      Ativa
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-emerald-300/80 block mt-0.5">
                  2 Gráficos Oficiais (Gráfico 1 e 2)
                </span>
              </div>
            </div>

            <div className="shrink-0">
              {isTorre ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                </div>
              ) : (
                <span className="text-[11px] font-bold text-emerald-400/80 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-transform flex items-center">
                  Ativar <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
