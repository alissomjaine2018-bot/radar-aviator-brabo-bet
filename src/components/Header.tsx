import React from 'react';
import { Plane, Sliders, Download, Radio, Castle, Flame } from 'lucide-react';
import { CasinoHouse } from '../types';
import { HOUSE_INFO } from '../utils/radarApi';

interface HeaderProps {
  onOpenSettings: () => void;
  onExportCSV?: () => void;
  onOpenRadarLive?: () => void;
  hasCandles?: boolean;
  currentHouse?: CasinoHouse;
  onSelectHouse?: (house: CasinoHouse) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onExportCSV,
  onOpenRadarLive,
  hasCandles = false,
  currentHouse = 'BETBRABO',
  onSelectHouse,
}) => {
  const isTorre = currentHouse === 'TORREBET';
  const houseInfo = HOUSE_INFO[currentHouse];
  return (
    <header className="border-b border-purple-900/40 bg-[#0e0c16]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-xl shadow-black/40">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-700 to-amber-500 p-[1.5px] shadow-lg shadow-purple-900/30">
            <div className="w-full h-full bg-[#0d0a17] rounded-[10px] flex items-center justify-center">
              <Plane className="w-6 h-6 text-amber-400 rotate-[-20deg] transition-transform hover:rotate-0" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-black"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">
                Analista Bravo
              </h1>
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                  isTorre
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-purple-950 text-purple-300 border-purple-700'
                }`}
              >
                {houseInfo.brandName}
              </span>
            </div>
            <p className="text-xs text-purple-300/70 font-medium">
              Correção Oficial Aviator VIP • {houseInfo.tagline}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Header House Switcher */}
          {onSelectHouse && (
            <div className="flex items-center gap-1 p-1 bg-[#140e29] border border-purple-800/80 rounded-xl shadow-inner">
              <button
                type="button"
                id="header-btn-betbrabo"
                onClick={() => onSelectHouse('BETBRABO')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentHouse === 'BETBRABO'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/60 ring-1 ring-purple-300'
                    : 'text-slate-400 hover:text-white hover:bg-purple-950/50'
                }`}
                title="Ativar APIs da Bet Bravo (3 Gráficos)"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">BET BRAVO</span>
                <span className="sm:hidden">BRAVO</span>
              </button>
              <button
                type="button"
                id="header-btn-torrebet"
                onClick={() => onSelectHouse('TORREBET')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentHouse === 'TORREBET'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/60 ring-1 ring-emerald-300'
                    : 'text-slate-400 hover:text-white hover:bg-emerald-950/50'
                }`}
                title="Ativar APIs da Torre Bet (2 Gráficos)"
              >
                <Castle className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">TORRE BET</span>
                <span className="sm:hidden">TORRE</span>
              </button>
            </div>
          )}

          {/* Radar Ao Vivo API button */}
          {onOpenRadarLive && (
            <button
              id="btn-open-radar-live"
              type="button"
              onClick={onOpenRadarLive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold border border-emerald-600/60 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
              title={`Abrir Gráficos Ao Vivo ${houseInfo.brandName}`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Gráficos Ao Vivo</span>
              <span className="text-[10px] bg-emerald-900/90 text-emerald-200 px-1.5 py-0.5 rounded font-black border border-emerald-500/50">
                {isTorre ? '2 SALAS' : '3 SALAS'}
              </span>
            </button>
          )}

          {/* Official API Live Badge */}
          <div
            className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold shadow-sm border ${
              isTorre
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : 'bg-purple-950/60 border-purple-600/50 text-purple-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-ping inline-block ${
                isTorre ? 'bg-emerald-400' : 'bg-purple-400'
              }`}
            />
            <span>API: {houseInfo.brandName}</span>
          </div>

          {/* Quick CSV Export if candles are loaded */}
          {hasCandles && onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 text-xs font-bold border border-emerald-700/50 transition-all shadow-sm cursor-pointer"
              title="Baixar histórico carregado em formato .CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Baixar .CSV</span>
            </button>
          )}

          <button
            id="btn-open-settings"
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-900/60 to-[#191528] hover:from-purple-800/70 hover:to-[#221b3a] text-purple-100 text-xs font-medium border border-purple-700/50 transition-all shadow-sm cursor-pointer"
            title="Personalizar Modelo Telegram"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Personalizar Template</span>
          </button>
        </div>
      </div>
    </header>
  );
};
