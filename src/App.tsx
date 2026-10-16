import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StrategySidebar } from './components/StrategySidebar';
import { TemperaturaView } from './components/TemperaturaView';
import { Listinha10xView } from './components/Listinha10xView';
import { RadarLiveView } from './components/RadarLiveView';
import { StrategyDetailView } from './components/StrategyDetailView';
import { LiveApiPanel } from './components/LiveApiPanel';
import { SignalsInput } from './components/SignalsInput';
import { SummaryCards } from './components/SummaryCards';
import { TelegramOutput } from './components/TelegramOutput';
import { SignalInspector } from './components/SignalInspector';
import { TemplateCustomizer } from './components/TemplateCustomizer';
import { CasaSwitcherBanner } from './components/CasaSwitcherBanner';
import { WhatsappAutomationView } from './components/WhatsappAutomationView';

import {
  AviatorCandle,
  AviatorFeedChannel,
  CasinoHouse,
  CorrectionSummary,
  RadarApiResponse,
  SignalCorrection,
  TelegramTemplateConfig,
  SidebarTabId,
} from './types';
import {
  fetchRadarBroadcast,
  convertRadarHistoryToCandles,
  mergeCandles,
  RADAR_CHANNELS,
  HOUSE_INFO,
} from './utils/radarApi';
import {
  DEFAULT_TELEGRAM_CONFIG,
  extractSignalTimes,
  processSignalCorrections,
  generateTelegramMessage,
} from './utils/correctionEngine';

import { Sparkles, Plane, Radio, Castle, Flame } from 'lucide-react';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<SidebarTabId>('temperatura');

  // Active Casino House ('BETBRABO' or 'TORREBET')
  const [currentHouse, setCurrentHouse] = useState<CasinoHouse>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analista_bravo_house');
      if (saved === 'TORREBET' || saved === 'BETBRABO') return saved;
    }
    return 'BETBRABO';
  });

  // Active Live API Channel ('aviator_1', 'radar_ao_vivo', 'aviator_premium', 'torre_1', 'torre_2')
  const [currentChannel, setCurrentChannel] = useState<AviatorFeedChannel>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('analista_bravo_house');
      if (saved === 'TORREBET') return 'torre_1';
    }
    return 'aviator_1';
  });

  // Real-time Data State (fed directly from the official live broadcast APIs)
  const [candles, setCandles] = useState<AviatorCandle[]>([]);
  const [radarData, setRadarData] = useState<RadarApiResponse | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Signals State
  const [signalsText, setSignalsText] = useState<string>('');
  const [telegramConfig, setTelegramConfig] = useState<TelegramTemplateConfig>(DEFAULT_TELEGRAM_CONFIG);

  // Result state
  const [corrections, setCorrections] = useState<SignalCorrection[] | null>(null);
  const [summary, setSummary] = useState<CorrectionSummary | null>(null);
  const [formattedMessage, setFormattedMessage] = useState<string>('');

  // Modals & Toast state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time window passed from TemperaturaView into Listinha10x
  const [listinhaTimeRange, setListinhaTimeRange] = useState<{ start: string; end: string } | null>(null);

  const pollIntervalRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch real-time broadcast from the selected official API
  const fetchChannelData = useCallback(
    async (ch: AviatorFeedChannel, isSilent = false, forcedHouse?: CasinoHouse) => {
      if (!isSilent) setIsLiveLoading(true);

      const channelInfo = RADAR_CHANNELS[ch] || RADAR_CHANNELS.aviator_1;
      const targetHouse = forcedHouse || channelInfo.house || currentHouse;

      try {
        const response = await fetchRadarBroadcast(ch, targetHouse);
        setRadarData(response);
        setLastSyncTime(new Date());

        if (response.historico && response.historico.length > 0) {
          const liveCandles = convertRadarHistoryToCandles(
            response.historico,
            targetHouse === 'TORREBET' ? `TORRE_${ch.toUpperCase()}` : ch.toUpperCase()
          );
          setCandles((prev) => {
            if (prev.length === 0) return liveCandles;
            return mergeCandles(prev, liveCandles);
          });
        }
      } catch (err: any) {
        // On transient error, keep existing candles intact and avoid alarming the user
        if (!isSilent) {
          console.warn('Notice syncing live channel:', err?.message || err);
          showToast(`Conectando à API ${channelInfo.name}...`);
        }
      } finally {
        if (!isSilent) setIsLiveLoading(false);
      }
    },
    [currentHouse]
  );

  // Switch channel handler
  const handleSelectChannel = (ch: AviatorFeedChannel) => {
    setCurrentChannel(ch);
    const targetHouse = RADAR_CHANNELS[ch]?.house || currentHouse;
    fetchChannelData(ch, false, targetHouse);
    const houseLabel = targetHouse === 'TORREBET' ? 'Torre Bet' : 'BETBRABO';
    showToast(`Conectado ao ${RADAR_CHANNELS[ch]?.name || ch} (${houseLabel} Ao Vivo)!`);
  };

  // Switch Casino House handler (BETBRABO <-> TORREBET)
  const handleSelectHouse = (house: CasinoHouse) => {
    if (house === currentHouse) return;
    setCurrentHouse(house);
    if (typeof window !== 'undefined') {
      localStorage.setItem('analista_bravo_house', house);
    }

    // Reset candles to avoid mixing different house rounds
    setCandles([]);
    setRadarData(null);
    setCorrections(null);
    setSummary(null);

    if (house === 'TORREBET') {
      const nextChannel: AviatorFeedChannel = 'torre_1';
      setCurrentChannel(nextChannel);
      if (
        activeTab === 'aviator_1' ||
        activeTab === 'radar_ao_vivo' ||
        activeTab === 'aviator_premium'
      ) {
        setActiveTab('torre_1');
      }
      fetchChannelData(nextChannel, false, 'TORREBET');
      showToast('🏰 Torre Bet Conectada! Todas as abas agora analisam os 2 Gráficos Oficiais da Torre Bet.');
    } else {
      const nextChannel: AviatorFeedChannel = 'aviator_1';
      setCurrentChannel(nextChannel);
      if (activeTab === 'torre_1' || activeTab === 'torre_2') {
        setActiveTab('aviator_1');
      }
      fetchChannelData(nextChannel, false, 'BETBRABO');
      showToast('🔥 Bet Bravo Conectada! Todas as abas voltaram para os 3 Gráficos Oficiais da Bet Bravo.');
    }
  };

  // Handle direct candles sync from Radar View or Listinha
  const handleLoadCandlesFromRadar = (newCandles: AviatorCandle[], sourceName: string) => {
    setCandles(newCandles);
    const times = extractSignalTimes(signalsText);
    if (times.length > 0) {
      const result = processSignalCorrections(times, newCandles, telegramConfig.candleWindow);
      const msg = generateTelegramMessage(result.corrections, telegramConfig);
      setCorrections(result.corrections);
      setSummary(result.summary);
      setFormattedMessage(msg);
    }
  };

  // Initialize and keep live API auto-synced continuously with sequential polling
  useEffect(() => {
    let isSubscribed = true;
    let pollTimer: any = null;

    const poll = async () => {
      if (!isSubscribed) return;
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        try {
          await fetchChannelData(currentChannel, true);
        } catch (e) {
          // Handled inside fetchChannelData
        }
      }
      if (isSubscribed) {
        pollTimer = setTimeout(poll, 5000);
      }
    };

    // Initial fetch on mount or channel change
    fetchChannelData(currentChannel, false);
    pollTimer = setTimeout(poll, 5000);

    return () => {
      isSubscribed = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [currentChannel, fetchChannelData]);

  // Keep channel in sync with sidebar clicks if user clicks a specific Aviator room
  const handleSidebarSelectTab = (tab: SidebarTabId) => {
    setActiveTab(tab);
    if (
      tab === 'aviator_1' ||
      tab === 'radar_ao_vivo' ||
      tab === 'aviator_premium' ||
      tab === 'torre_1' ||
      tab === 'torre_2'
    ) {
      setCurrentChannel(tab);
    }
  };

  // Handle Generate Action in Correção Brava
  const handleGenerate = () => {
    const times = extractSignalTimes(signalsText);
    if (times.length === 0) {
      showToast('Por favor, informe ao menos um horário de sinal no campo acima.');
      return;
    }

    if (candles.length === 0) {
      showToast('Aguardando sincronização de rodadas da API Oficial...');
      return;
    }

    const channelInfo = RADAR_CHANNELS[currentChannel] || RADAR_CHANNELS.aviator_1;
    const isTorre = currentHouse === 'TORREBET';
    const customConfig: TelegramTemplateConfig = {
      ...telegramConfig,
      headerTitle: isTorre
        ? `🚨🏰 TORRE BET — ${channelInfo.name.toUpperCase()} 🏰🚨\n📊 CONFERÊNCIA DOS SINAIS`
        : `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
      brokerLink: isTorre
        ? `🔗 TORRE BET: https://torre.bet`
        : `🔗 AVIATOR: ${channelInfo.brokerUrl}`,
    };

    const result = processSignalCorrections(times, candles, telegramConfig.candleWindow);
    const msg = generateTelegramMessage(result.corrections, customConfig);
    setCorrections(result.corrections);
    setSummary(result.summary);
    setFormattedMessage(msg);
    showToast(`Correção calculada com as rodadas oficiais do ${channelInfo.name}!`);

    setTimeout(() => {
      const el = document.getElementById('results-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Handle configuration update
  const handleSaveConfig = (newConfig: TelegramTemplateConfig) => {
    setTelegramConfig(newConfig);
    if (corrections && candles.length > 0) {
      const times = extractSignalTimes(signalsText);
      const result = processSignalCorrections(times, candles, newConfig.candleWindow);
      const msg = generateTelegramMessage(result.corrections, newConfig);
      setCorrections(result.corrections);
      setSummary(result.summary);
      setFormattedMessage(msg);
    }
    showToast('Configurações do Telegram atualizadas!');
  };

  // Handle load signals from any strategy into Main Correção
  const handleLoadSignalsToMain = (text: string) => {
    setSignalsText(text);
    setActiveTab('correcao');
    showToast('Sinais carregados na Correção Brava!');

    // Automatically compute audit if candles exist
    if (candles.length > 0) {
      const times = extractSignalTimes(text);
      if (times.length > 0) {
        const channelInfo = RADAR_CHANNELS[currentChannel] || RADAR_CHANNELS.aviator_1;
        const isTorre = currentHouse === 'TORREBET';
        const customConfig: TelegramTemplateConfig = {
          ...telegramConfig,
          headerTitle: isTorre
            ? `🚨🏰 TORRE BET — ${channelInfo.name.toUpperCase()} 🏰🚨\n📊 CONFERÊNCIA DOS SINAIS`
            : `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
          brokerLink: isTorre
            ? `🔗 TORRE BET: https://torre.bet`
            : `🔗 AVIATOR: ${channelInfo.brokerUrl}`,
        };
        const result = processSignalCorrections(times, candles, telegramConfig.candleWindow);
        const msg = generateTelegramMessage(result.corrections, customConfig);
        setCorrections(result.corrections);
        setSummary(result.summary);
        setFormattedMessage(msg);
      }
    }
  };

  const canGenerate = candles.length > 0 && extractSignalTimes(signalsText).length > 0;

  return (
    <div className="min-h-screen bg-[#090712] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-900 to-indigo-900 border border-amber-400/60 rounded-xl shadow-2xl shadow-black text-xs font-semibold text-slate-100 animate-slideUp">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRadarLive={() => setActiveTab(currentHouse === 'TORREBET' ? 'torre_1' : 'radar_ao_vivo')}
        hasCandles={candles.length > 0}
        currentHouse={currentHouse}
        onSelectHouse={handleSelectHouse}
      />

      {/* Two-Column App Layout: Sidebar (Left) + Active View (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto">
        {/* Left Sidebar */}
        <StrategySidebar
          activeTab={activeTab}
          onSelectTab={handleSidebarSelectTab}
          candlesCount={candles.length}
          currentHouse={currentHouse}
          onSelectHouse={handleSelectHouse}
        />

        {/* Right Main Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* BOTÃO GRANDE / HERO SWITCHER: BET BRAVO vs TORRE BET */}
          <CasaSwitcherBanner
            currentHouse={currentHouse}
            onSelectHouse={handleSelectHouse}
            candlesCount={candles.length}
          />

          {/* Tab 1: Correção Brava (100% Direct Live API) */}
          {activeTab === 'correcao' && (
            <div className="space-y-6">
              {/* Input Phase: 2 Columns (LiveApiPanel + SignalsInput) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <LiveApiPanel
                  currentChannel={currentChannel}
                  onChangeChannel={handleSelectChannel}
                  candles={candles}
                  radarData={radarData}
                  isLoading={isLiveLoading}
                  onRefresh={() => fetchChannelData(currentChannel, false)}
                  lastSyncTime={lastSyncTime}
                  currentHouse={currentHouse}
                />

                <SignalsInput
                  signalsText={signalsText}
                  onChangeText={setSignalsText}
                  onGenerate={handleGenerate}
                  canGenerate={canGenerate}
                  hasCandles={candles.length > 0}
                />
              </div>

              {/* Results Section */}
              {summary && corrections && (
                <section id="results-section" className="space-y-6 pt-2">
                  <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 flex items-center gap-2">
                        Correção Oficial — {RADAR_CHANNELS[currentChannel]?.name || currentChannel}
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-amber-300 border border-purple-800 font-mono">
                          {summary.totalSignals} sinais auditados
                        </span>
                      </h2>
                    </div>
                  </div>

                  <SummaryCards summary={summary} />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-6">
                      <TelegramOutput
                        messageText={formattedMessage}
                        totalSignals={summary.totalSignals}
                      />
                    </div>

                    <div className="xl:col-span-6">
                      <SignalInspector corrections={corrections} />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Tab: Gráficos de Histórico Ao Vivo (Aviator 1, Radar Ao Vivo, Aviator Premium, Torre 1, Torre 2) */}
          {(activeTab === 'aviator_1' ||
            activeTab === 'radar_ao_vivo' ||
            activeTab === 'aviator_premium' ||
            activeTab === 'torre_1' ||
            activeTab === 'torre_2') && (
            <RadarLiveView
              candles={candles}
              initialChannel={activeTab}
              onLoadCandlesToMain={handleLoadCandlesFromRadar}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              showToast={showToast}
              currentHouse={currentHouse}
            />
          )}

          {/* Tab 2: Dashboard de Temperatura do Mercado & IA 24h */}
          {activeTab === 'temperatura' && (
            <TemperaturaView
              candles={candles}
              onNavigateToTab={(tab) => handleSidebarSelectTab(tab)}
              onSelectChannel={(ch) => handleSelectChannel(ch)}
              onSelectTimeWindow={(ch, start, end) => {
                handleSelectChannel(ch);
                setListinhaTimeRange({ start, end });
                setActiveTab('listinha_10x');
              }}
              showToast={showToast}
              currentHouse={currentHouse}
            />
          )}

          {/* Tab: Automação Oficial WhatsApp 24h */}
          {activeTab === 'whatsapp_automacao' && (
            <WhatsappAutomationView
              currentHouse={currentHouse}
              showToast={showToast}
            />
          )}

          {/* Tab 3: Listinha 10x (100% Direct Official Live APIs) */}
          {activeTab === 'listinha_10x' && (
            <Listinha10xView
              candles={candles}
              fileName={RADAR_CHANNELS[currentChannel]?.name || currentChannel}
              activeChannel={currentChannel}
              onChangeActiveChannel={handleSelectChannel}
              onOpenRadarLive={() => setActiveTab(currentHouse === 'TORREBET' ? 'torre_1' : 'radar_ao_vivo')}
              onLoadSignalsToMain={handleLoadSignalsToMain}
              onLoadCandlesToMain={handleLoadCandlesFromRadar}
              showToast={showToast}
              initialStartTime={listinhaTimeRange?.start}
              initialEndTime={listinhaTimeRange?.end}
              currentHouse={currentHouse}
            />
          )}

          {/* Tabs 4-7: Specialized Strategies */}
          {(activeTab === 'maxima_10_20' ||
            activeTab === 'maxima_50' ||
            activeTab === 'mil_x' ||
            activeTab === 'duplas_x') && (
            <StrategyDetailView
              strategyId={activeTab}
              candles={candles}
              onLoadSignalsToMain={handleLoadSignalsToMain}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-purple-900/40 bg-[#090712] py-4 px-4 text-center text-xs text-purple-300/50">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-amber-400 rotate-[-20deg]" />
            <span className="font-bold text-slate-300">Analista Bravo</span>
            <span>
              • Alimentado 100% pelas APIs Oficiais da {currentHouse === 'TORREBET' ? 'TORRE BET 🏰' : 'BETBRABO ✈️'} Ao Vivo
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Regra Oficial: 6 velas consecutivas • Emojis 🌹 🔥 🟣 🛡 ❌
          </p>
        </div>
      </footer>

      {/* Template Customizer Modal */}
      <TemplateCustomizer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={telegramConfig}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
