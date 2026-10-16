import React from 'react';
import { AviatorCandle, AviatorFeedChannel, CasinoHouse, RadarApiResponse } from '../types';
import { RADAR_CHANNELS, CHANNELS_BY_HOUSE, HOUSE_INFO } from '../utils/radarApi';
import {
  Radio,
  Plane,
  Crown,
  Castle,
  RefreshCw,
  Flame,
  Snowflake,
  Zap,
  Activity,
  Layers,
  Clock,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface LiveApiPanelProps {
  currentChannel: AviatorFeedChannel;
  onChangeChannel: (ch: AviatorFeedChannel) => void;
  candles: AviatorCandle[];
  radarData: RadarApiResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  lastSyncTime: Date | null;
  currentHouse?: CasinoHouse;
}

export const LiveApiPanel: React.FC<LiveApiPanelProps> = ({
  currentChannel,
  onChangeChannel,
  candles,
  radarData,
  isLoading,
  onRefresh,
  lastSyncTime,
  currentHouse = 'BETBRABO',
}) => {
  const isTorre = currentHouse === 'TORREBET';
  const houseInfo = HOUSE_INFO[currentHouse] || HOUSE_INFO.BETBRABO;
  const availableChannels = CHANNELS_BY_HOUSE[currentHouse] || CHANNELS_BY_HOUSE.BETBRABO;
  const channelInfo = RADAR_CHANNELS[currentChannel] || RADAR_CHANNELS[availableChannels[0]];
  const momento = radarData?.momento;
  const ultimaVela = radarData?.ultimaVela;
  const historico = radarData?.historico || [];

  const estado = (momento?.estado || 'normal').toLowerCase();
  const isPagando = estado.includes('pagando');
  const isRecolhendo = estado.includes('recolhendo');

  const getMultiplierBadge = (mult: number) => {
    if (mult >= 50.0) return 'bg-amber-400 text-black border-amber-300 font-black shadow-[0_0_12px_rgba(251,191,36,0.6)]';
    if (mult >= 10.0) return 'bg-pink-600 text-white border-pink-400 font-extrabold shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    if (mult >= 2.0) return 'bg-purple-600 text-white border-purple-400 font-bold';
    return 'bg-blue-600/90 text-white border-blue-400 font-medium';
  };

  return (
    <div className="bg-[#120f22] rounded-2xl border border-purple-900/50 p-5 shadow-xl shadow-black/40 flex flex-col justify-between space-y-4">
      {/* Top Section: Room Selector */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-ping ${
                isTorre ? 'bg-emerald-400' : 'bg-purple-400'
              }`}
            />
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              API Oficial Ao Vivo
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isTorre
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-purple-950 text-purple-300 border-purple-700'
                }`}
              >
                {houseInfo.brandName}
              </span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-800/60 text-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Atualizar leituras da API agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-pink-400' : 'text-purple-300'}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        </div>

        {/* Dynamic Room Selector Tabs (2 for Torre Bet, 3 for Bet Bravo) */}
        <div className={`grid gap-2 mt-3 ${availableChannels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {availableChannels.map((ch) => {
            const chInfo = RADAR_CHANNELS[ch];
            const isSelected = currentChannel === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => onChangeChannel(ch)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? isTorre
                      ? 'bg-emerald-950/90 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] text-white ring-1 ring-emerald-400'
                      : ch === 'aviator_1'
                      ? 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] text-white ring-1 ring-cyan-400'
                      : ch === 'radar_ao_vivo'
                      ? 'bg-purple-950/90 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] text-white ring-1 ring-purple-400'
                      : 'bg-amber-950/90 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)] text-white ring-1 ring-amber-400'
                    : 'bg-[#17112c] border-purple-900/40 text-slate-400 hover:text-white hover:border-purple-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black flex items-center gap-1.5 truncate">
                    {isTorre ? (
                      <Castle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : ch === 'aviator_1' ? (
                      <Plane className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : ch === 'radar_ao_vivo' ? (
                      <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
                    ) : (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">{chInfo.shortName}</span>
                  </span>
                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-purple-900/80 text-purple-200 shrink-0">
                    {chInfo.badge}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-purple-300/80 mt-1 truncate">
                  {chInfo.apiName}
                </div>
              </button>
            );
          })}
        </div>

        {/* Room Status Banner */}
        <div className="mt-3 p-3.5 rounded-2xl bg-[#16112d] border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`text-2xl sm:text-3xl font-black px-3 py-1 rounded-xl border ${
                ultimaVela ? getMultiplierBadge(ultimaVela.mult) : 'text-slate-400 bg-slate-900'
              }`}
            >
              {ultimaVela ? `${ultimaVela.mult.toFixed(2)}x` : '--'}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{channelInfo.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">
                  #{ultimaVela?.rodada || ultimaVela?.id || '--'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{ultimaVela?.t ? ultimaVela.t.split(' ')[1] || ultimaVela.t : '--:--:--'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:items-end text-left sm:text-right">
            {isPagando ? (
              <span className="px-2.5 py-1 rounded-lg bg-pink-950 border border-pink-500/60 text-pink-300 text-[10px] font-black animate-pulse flex items-center gap-1">
                <Flame className="w-3 h-3 text-pink-400" />
                MOMENTO PAGANDO 🔥
              </span>
            ) : isRecolhendo ? (
              <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/60 text-cyan-300 text-[10px] font-black flex items-center gap-1">
                <Snowflake className="w-3 h-3 text-cyan-400" />
                MOMENTO RECOLHENDO ❄️
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-amber-950 border border-amber-500/60 text-amber-300 text-[10px] font-black flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                EQUILIBRADO ⚡
              </span>
            )}
            <span className="text-[10px] text-emerald-400 font-mono font-bold mt-1">
              {candles.length.toLocaleString()} velas carregadas da API
            </span>
          </div>
        </div>

        {/* Live Ribbon of recent candles */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              Fita de Rodadas ao Vivo ({historico.length})
            </span>
            <span className="text-[9px] text-slate-400 font-mono">Mais recentes à esquerda</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
            {historico.length > 0 ? (
              historico.map((v, i) => (
                <div
                  key={`${v.id}_${i}`}
                  className={`shrink-0 px-2 py-1 rounded-lg border text-center transition-all ${getMultiplierBadge(
                    v.mult
                  )}`}
                >
                  <div className="text-[11px] font-black">{v.mult.toFixed(2)}x</div>
                  <div className="text-[8px] opacity-75 font-mono">
                    {v.t ? (v.t.split(' ')[1] || v.t).slice(0, 5) : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-2 text-center text-xs text-slate-500 w-full font-mono">
                Sincronizando rodadas da API ao vivo...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info: Link oficial */}
      <div className="pt-2 border-t border-purple-900/40 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <a
          href={channelInfo.brokerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-400 hover:text-pink-300 underline flex items-center gap-1 font-bold"
        >
          <span>Abrir {channelInfo.name} na {isTorre ? 'TORRE BET' : 'BETBRABO'}</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {lastSyncTime && (
          <span className="text-slate-500">
            {lastSyncTime.toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
};
