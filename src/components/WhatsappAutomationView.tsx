import React, { useState, useEffect, useCallback } from 'react';
import {
  AutomationBatch,
  AutomationConfig,
  AutomationLog,
  AutomationStatus,
  CasinoHouse,
  AviatorFeedChannel,
  WhatsappGroupItem,
} from '../types';
import { RADAR_CHANNELS, HOUSE_INFO } from '../utils/radarApi';
import {
  MessageSquare,
  Radio,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Flame,
  Zap,
  Power,
  RotateCcw,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Users,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WhatsappAutomationViewProps {
  currentHouse: CasinoHouse;
  showToast?: (msg: string) => void;
}

export const WhatsappAutomationView: React.FC<WhatsappAutomationViewProps> = ({
  currentHouse,
  showToast,
}) => {
  // Main state
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [config, setConfig] = useState<Partial<AutomationConfig>>({});
  const [groups, setGroups] = useState<WhatsappGroupItem[]>([]);
  const [batches, setBatches] = useState<AutomationBatch[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);

  // Loading states
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [isTriggeringBatch, setIsTriggeringBatch] = useState<boolean>(false);
  const [retryingBatchId, setRetryingBatchId] = useState<string | null>(null);

  // Form states for configuration
  const [apiUrl, setApiUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [instanceName, setInstanceName] = useState<string>('analista_bravo');
  const [selectedGroupJid, setSelectedGroupJid] = useState<string>('');
  const [selectedHouse, setSelectedHouse] = useState<CasinoHouse>(currentHouse);
  const [selectedChannel, setSelectedChannel] = useState<AviatorFeedChannel>('aviator_1');
  const [isAutomationEnabled, setIsAutomationEnabled] = useState<boolean>(false);
  const [timeSlots, setTimeSlots] = useState<string[]>([
    '09:00',
    '11:00',
    '13:00',
    '15:00',
    '17:00',
    '19:00',
    '21:00',
  ]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [minSpacingMinutes, setMinSpacingMinutes] = useState<number>(2);
  const [candleWindow, setCandleWindow] = useState<number>(6);
  const [windowHoursAhead, setWindowHoursAhead] = useState<number>(2);
  const [schedulerSecret, setSchedulerSecret] = useState<string>('');

  // QR Code Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<{
    base64?: string;
    code?: string;
    pairingCode?: string;
    error?: string;
  } | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);

  // Expanded batch message drawer
  const [expandedBatchMessage, setExpandedBatchMessage] = useState<{
    id: string;
    title: string;
    content: string;
  } | null>(null);

  // Helpers
  const notify = (msg: string) => {
    if (showToast) showToast(msg);
  };

  // Fetch all initial data
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingStatus(true);
    try {
      // 1. Status
      const statusRes = await fetch('/api/automation/status');
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.ok) setStatus(sData.status);
      }

      // 2. Config
      const configRes = await fetch('/api/automation/config');
      if (configRes.ok) {
        const cData = await configRes.json();
        if (cData.ok && cData.config) {
          const c = cData.config;
          setConfig(c);
          setApiUrl(c.evolutionApiUrl || '');
          setInstanceName(c.evolutionInstance || 'analista_bravo');
          setSelectedGroupJid(c.targetGroupJid || '');
          setSelectedHouse(c.selectedHouse || 'BETBRABO');
          setSelectedChannel(c.selectedChannel || 'aviator_1');
          setIsAutomationEnabled(Boolean(c.enabled));
          if (Array.isArray(c.timeSlots)) setTimeSlots(c.timeSlots);
          if (Array.isArray(c.daysOfWeek)) setDaysOfWeek(c.daysOfWeek);
          if (c.minSpacingMinutes) setMinSpacingMinutes(c.minSpacingMinutes);
          if (c.candleWindow) setCandleWindow(c.candleWindow);
          if (c.windowHoursAhead) setWindowHoursAhead(c.windowHoursAhead);
        }
      }

      // 3. Batches
      const batchesRes = await fetch('/api/automation/batches?limit=30');
      if (batchesRes.ok) {
        const bData = await batchesRes.json();
        if (bData.ok) setBatches(bData.batches || []);
      }

      // 4. Logs
      const logsRes = await fetch('/api/automation/logs?limit=40');
      if (logsRes.ok) {
        const lData = await logsRes.json();
        if (lData.ok) setLogs(lData.logs || []);
      }
    } catch (err: any) {
      console.error('Error loading automation data:', err);
    } finally {
      if (!silent) setIsLoadingStatus(false);
    }
  }, []);

  // Poll status and batches periodically (every 10s)
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  // Load groups from Evolution API
  const handleLoadGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const res = await fetch('/api/automation/groups');
      const data = await res.json();
      if (data.ok && Array.isArray(data.groups)) {
        setGroups(data.groups);
        notify(`${data.groups.length} grupos carregados do WhatsApp!`);
      } else {
        notify(`Não foi possível carregar os grupos: ${data.error || 'Verifique a conexão.'}`);
      }
    } catch (err: any) {
      notify(`Erro ao consultar grupos: ${err?.message || err}`);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Open QR Code modal & start fetching
  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true);
    setIsLoadingQr(true);
    setQrCodeData(null);

    try {
      const res = await fetch('/api/automation/connect');
      const data = await res.json();
      if (data.ok) {
        setQrCodeData(data);
      } else {
        setQrCodeData({ error: data.error || 'Falha ao solicitar QR Code.' });
      }
    } catch (err: any) {
      setQrCodeData({ error: err?.message || 'Falha de comunicação com o servidor.' });
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Poll QR modal connection state
  useEffect(() => {
    let qrTimer: any = null;
    if (isQrModalOpen) {
      qrTimer = setInterval(async () => {
        try {
          const res = await fetch('/api/automation/status');
          if (res.ok) {
            const data = await res.json();
            if (data?.status?.connected) {
              setStatus(data.status);
              setIsQrModalOpen(false);
              confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
              notify('✅ WhatsApp conectado com sucesso!');
              handleLoadGroups();
            }
          }
        } catch {}
      }, 3500);
    }
    return () => {
      if (qrTimer) clearInterval(qrTimer);
    };
  }, [isQrModalOpen]);

  // Disconnect WhatsApp
  const handleDisconnect = async () => {
    if (!window.confirm('Deseja realmente desconectar a instância do WhatsApp?')) return;
    try {
      const res = await fetch('/api/automation/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        notify('Instância desconectada.');
        loadAllData(false);
      } else {
        notify(`Erro ao desconectar: ${data.error}`);
      }
    } catch (err: any) {
      notify(`Erro: ${err?.message || err}`);
    }
  };

  // Save full configuration
  const handleSaveConfig = async (overrideEnabled?: boolean) => {
    setIsSavingConfig(true);
    const targetGroup = groups.find((g) => g.id === selectedGroupJid);
    const groupName = targetGroup?.subject || config.targetGroupName || '';

    const payload: Partial<AutomationConfig> = {
      evolutionApiUrl: apiUrl.trim(),
      evolutionInstance: instanceName.trim(),
      targetGroupJid: selectedGroupJid,
      targetGroupName: groupName,
      selectedHouse,
      selectedChannel,
      enabled: overrideEnabled !== undefined ? overrideEnabled : isAutomationEnabled,
      timeSlots,
      daysOfWeek,
      minSpacingMinutes,
      candleWindow,
      windowHoursAhead,
    };

    if (apiKey.trim()) {
      payload.evolutionApiKey = apiKey.trim();
    }
    if (schedulerSecret.trim()) {
      payload.schedulerSecret = schedulerSecret.trim();
    }

    try {
      const res = await fetch('/api/automation/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        notify('Configurações salvas com sucesso!');
        loadAllData(true);
        if (apiKey.trim()) setApiKey(''); // Clear raw key input after saving
      } else {
        notify(`Erro ao salvar: ${data.error}`);
      }
    } catch (err: any) {
      notify(`Erro ao salvar configurações: ${err?.message || err}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Toggle active/paused state
  const handleToggleActive = () => {
    const nextState = !isAutomationEnabled;
    setIsAutomationEnabled(nextState);
    handleSaveConfig(nextState);
  };

  // Test Send to Group
  const handleSendTestMessage = async () => {
    if (!selectedGroupJid) {
      notify('Selecione um grupo de WhatsApp primeiro.');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/automation/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetJid: selectedGroupJid }),
      });

      const data = await res.json();
      if (data.ok) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        notify('Mensagem de teste enviada com sucesso no grupo do WhatsApp!');
        loadAllData(true);
      } else {
        notify(`Falha no envio de teste: ${data.error}`);
      }
    } catch (err: any) {
      notify(`Erro ao enviar teste: ${err?.message || err}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Immediate manual batch trigger
  const handleTriggerManualBatch = async () => {
    if (!selectedGroupJid) {
      notify('Selecione um grupo de WhatsApp primeiro nas configurações.');
      return;
    }

    setIsTriggeringBatch(true);
    try {
      const res = await fetch('/api/automation/trigger-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.ok) {
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
        notify(
          `🚀 Lista disparada com sucesso no grupo! ${data.batch?.signalsCount} sinais gerados. A correção automática será enviada quando as rodadas concluírem.`
        );
        loadAllData(true);
      } else {
        notify(`Erro no disparo manual: ${data.error}`);
      }
    } catch (err: any) {
      notify(`Erro ao disparar lote: ${err?.message || err}`);
    } finally {
      setIsTriggeringBatch(false);
    }
  };

  // Retry failed batch
  const handleRetryBatch = async (batchId: string) => {
    setRetryingBatchId(batchId);
    try {
      const res = await fetch(`/api/automation/retry-batch/${encodeURIComponent(batchId)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        notify('Tentativa reiniciada para o lote.');
        loadAllData(true);
      } else {
        notify(`Erro ao reiniciar lote: ${data.error}`);
      }
    } catch (err: any) {
      notify(`Erro: ${err?.message || err}`);
    } finally {
      setRetryingBatchId(null);
    }
  };

  // Time slot management
  const handleAddSlot = () => {
    const val = newSlotInput.trim();
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(val)) {
      notify('Formato de horário inválido. Use HH:MM (ex: 14:30).');
      return;
    }
    const formatted = val.padStart(5, '0');
    if (timeSlots.includes(formatted)) {
      notify('Este horário já está configurado.');
      return;
    }
    const updated = [...timeSlots, formatted].sort();
    setTimeSlots(updated);
    setNewSlotInput('');
  };

  const handleRemoveSlot = (slot: string) => {
    setTimeSlots(timeSlots.filter((s) => s !== slot));
  };

  const handlePresetSlots = (mode: '2h' | '1h' | 'day_blocks') => {
    if (mode === '2h') {
      setTimeSlots(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']);
      notify('Horários a cada 2 horas definidos.');
    } else if (mode === '1h') {
      setTimeSlots([
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
        '19:00',
        '20:00',
        '21:00',
      ]);
      notify('Horários de 1 em 1 hora definidos.');
    } else {
      setTimeSlots(['09:00', '14:00', '19:00']);
      notify('Horários principais (Manhã, Tarde e Noite) definidos.');
    }
  };

  const handleToggleDay = (dayIndex: number) => {
    if (daysOfWeek.includes(dayIndex)) {
      if (daysOfWeek.length === 1) {
        notify('Ao menos um dia da semana deve ficar selecionado.');
        return;
      }
      setDaysOfWeek(daysOfWeek.filter((d) => d !== dayIndex));
    } else {
      setDaysOfWeek([...daysOfWeek, dayIndex].sort());
    }
  };

  const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const isConnected = status?.connected || status?.connectionState === 'open';

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER BANNER */}
      <div className="bg-[#120e24] border border-emerald-900/50 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-700 to-green-400 p-[1.5px] shadow-lg shadow-emerald-950/50 shrink-0">
              <div className="w-full h-full bg-[#0d0a17] rounded-[14px] flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  AUTOMAÇÃO WHATSAPP OFICIAL ⚡
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Evolution API Multi-Device
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/50 text-purple-300">
                  24H Sem Computador Ligado
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Disparador Automático de Listas & Correção 10X
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Gera a lista das próximas horas, envia diretamente no grupo do WhatsApp selecionado e publica a correção oficial auditada com assertividade assim que o último sinal finalizar.
              </p>
            </div>
          </div>

          {/* Quick status pill and master switch */}
          <div className="flex items-center gap-3 bg-[#181330] p-3 rounded-2xl border border-purple-900/50 shrink-0">
            <div className="text-right">
              <div className="text-xs font-black text-white flex items-center justify-end gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                  }`}
                />
                <span>{isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {isAutomationEnabled ? '🟢 Agendador Ativo' : '⚪ Agendador Pausado'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleActive}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                isAutomationEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isAutomationEnabled ? 'Ativo' : 'Pausado'}</span>
            </button>
          </div>
        </div>

        {/* 4 SUMMARY METRIC CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-purple-900/40">
          {/* Card 1: WhatsApp Status */}
          <div className="bg-[#150f2e] border border-purple-900/40 p-3 rounded-2xl">
            <div className="text-[10px] font-mono text-slate-400">STATUS DA INSTÂNCIA</div>
            <div className="text-sm font-black text-white mt-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span className="truncate">
                {isConnected ? 'Conectado (Online)' : status?.connectionState || 'Desconectado'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              Instância: {instanceName || 'analista_bravo'}
            </div>
          </div>

          {/* Card 2: Grupo Selecionado */}
          <div className="bg-[#150f2e] border border-purple-900/40 p-3 rounded-2xl">
            <div className="text-[10px] font-mono text-slate-400">GRUPO DE DESTINO</div>
            <div className="text-sm font-black text-pink-300 mt-1 truncate">
              {config.targetGroupName || (selectedGroupJid ? 'Grupo Selecionado' : 'Nenhum Grupo')}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              {selectedGroupJid || 'Selecione abaixo'}
            </div>
          </div>

          {/* Card 3: Próximo Disparo */}
          <div className="bg-[#150f2e] border border-purple-900/40 p-3 rounded-2xl">
            <div className="text-[10px] font-mono text-slate-400">PRÓXIMO ENVIO</div>
            <div className="text-sm font-black text-amber-300 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{status?.nextScheduledSlot ? `${status.nextScheduledSlot}h` : 'Nenhum'}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Fuso: {status?.timezone || 'America/Sao_Paulo'}
            </div>
          </div>

          {/* Card 4: Total de Lotes Auditados */}
          <div className="bg-[#150f2e] border border-purple-900/40 p-3 rounded-2xl">
            <div className="text-[10px] font-mono text-slate-400">TOTAL DISPARADOS</div>
            <div className="text-sm font-black text-emerald-400 mt-1">
              {status?.totalBatchesSent || 0} listas • {status?.totalBatchesCorrected || 0} corrigidas
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Idempotência 100% ativa
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN TWO-COLUMN CONFIGURATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: CONEXÃO EVOLUTION API + SELEÇÃO DE GRUPO */}
        <div className="lg:col-span-5 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>1. Conexão Evolution API (WhatsApp)</span>
            </h3>
            {isConnected && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Sessão Ativa
              </span>
            )}
          </div>

          {/* Inputs */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                URL da Evolution API:
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://evolution.seuservidor.com"
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Endereço do seu servidor Evolution API v2/v1
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Nome da Instância:
              </label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="analista_bravo"
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                API Key (Token Secreto):
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.hasApiKey ? '•••••••••••••••• (Já configurada)' : 'Cole sua API Key da Evolution'}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Fica protegida no backend seguro. Nunca é exposta no navegador.
              </span>
            </div>
          </div>

          {/* Connect / QR Code / Disconnect Action Buttons */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenQrModal}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>Conectar com QR Code</span>
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="py-2.5 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs cursor-pointer transition-all"
              >
                Desconectar
              </button>
            )}
          </div>

          {/* Target Group Selector */}
          <div className="pt-4 border-t border-purple-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pink-400" />
                <span>2. Grupo de Destino no WhatsApp:</span>
              </label>

              <button
                type="button"
                onClick={handleLoadGroups}
                disabled={isLoadingGroups}
                className="text-[11px] font-bold text-purple-300 hover:text-purple-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingGroups ? 'animate-spin' : ''}`} />
                <span>{isLoadingGroups ? 'Buscando...' : 'Carregar Grupos'}</span>
              </button>
            </div>

            {groups.length > 0 ? (
              <select
                value={selectedGroupJid}
                onChange={(e) => setSelectedGroupJid(e.target.value)}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-sans"
              >
                <option value="">Selecione um grupo da lista...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.subject} {g.size ? `(${g.size} membros)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-[#150f2e] border border-dashed border-purple-900/60 text-center">
                <p className="text-xs text-slate-400">
                  {isConnected
                    ? 'Clique no botão acima para carregar os grupos em que seu WhatsApp participa.'
                    : 'Conecte o WhatsApp pelo QR Code para listar seus grupos.'}
                </p>
                {selectedGroupJid && (
                  <div className="mt-2 text-[10px] font-mono text-pink-300">
                    Grupo atual salvo: {config.targetGroupName || selectedGroupJid}
                  </div>
                )}
              </div>
            )}

            {/* Test Send Button */}
            {selectedGroupJid && (
              <button
                type="button"
                onClick={handleSendTestMessage}
                disabled={isSendingTest}
                className="w-full py-2.5 px-3 rounded-xl bg-[#191436] hover:bg-purple-900/60 border border-purple-700/60 text-purple-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 text-pink-400 ${isSendingTest ? 'animate-ping' : ''}`} />
                <span>{isSendingTest ? 'Enviando teste...' : 'Enviar Mensagem de Teste no Grupo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CONFIGURAÇÃO DE HORÁRIOS, SALAS E DISPARO IMEDIATO */}
        <div className="lg:col-span-7 bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-purple-900/30">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>3. Programação e Regras de Disparo</span>
            </h3>

            {/* Immediate manual dispatch CTA */}
            <button
              type="button"
              onClick={handleTriggerManualBatch}
              disabled={isTriggeringBatch || !isConnected || !selectedGroupJid}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
              title="Gera uma lista real agora, envia no grupo e agenda a correção automática"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isTriggeringBatch ? 'animate-spin' : ''}`} />
              <span>{isTriggeringBatch ? 'Disparando...' : 'Disparar Lista Agora 🚀'}</span>
            </button>
          </div>

          {/* Casa e Sala Selecionadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Casa de Apostas:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHouse('BETBRABO');
                    setSelectedChannel('aviator_1');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedHouse === 'BETBRABO'
                      ? 'bg-purple-900/90 border border-purple-400 text-white shadow'
                      : 'bg-[#150f2e] border border-purple-900/50 text-slate-400'
                  }`}
                >
                  🔥 Bet Bravo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHouse('TORREBET');
                    setSelectedChannel('torre_1');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedHouse === 'TORREBET'
                      ? 'bg-emerald-900/90 border border-emerald-400 text-white shadow'
                      : 'bg-[#150f2e] border border-purple-900/50 text-slate-400'
                  }`}
                >
                  🏰 Torre Bet
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Sala do Aviator:
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value as AviatorFeedChannel)}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-sans"
              >
                {selectedHouse === 'TORREBET' ? (
                  <>
                    <option value="torre_1">Torre Bet — Gráfico 1 Oficial</option>
                    <option value="torre_2">Torre Bet — Gráfico 2 Oficial</option>
                  </>
                ) : (
                  <>
                    <option value="aviator_1">Bet Bravo — Aviator 1 (Sala 1)</option>
                    <option value="radar_ao_vivo">Bet Bravo — Aviator VIP (Radar)</option>
                    <option value="aviator_premium">Bet Bravo — Aviator Premium</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Horários Programados */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>Horários de Envio Automático ({timeSlots.length} horários):</span>
              </label>

              {/* Quick Presets */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handlePresetSlots('2h')}
                  className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-[10px] text-purple-300 font-mono"
                >
                  A cada 2h
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSlots('day_blocks')}
                  className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-[10px] text-purple-300 font-mono"
                >
                  Manhã/Tarde/Noite
                </button>
              </div>
            </div>

            {/* Slots Badges */}
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-[#140e2b] border border-purple-900/40 min-h-[50px] items-center">
              {timeSlots.map((slot) => (
                <span
                  key={slot}
                  className="px-2.5 py-1 rounded-xl bg-purple-950 border border-purple-700/70 text-pink-300 font-mono font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <span>⏰ {slot}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(slot)}
                    className="text-slate-400 hover:text-rose-400 font-black cursor-pointer"
                    title="Remover horário"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Add Custom Slot Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSlotInput}
                onChange={(e) => setNewSlotInput(e.target.value)}
                placeholder="Ex: 14:30"
                className="w-32 bg-[#17112f] border border-purple-900/60 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleAddSlot}
                className="px-3 py-1.5 rounded-xl bg-purple-900 hover:bg-purple-800 border border-purple-700 text-xs font-bold text-white cursor-pointer"
              >
                + Adicionar Horário
              </button>
            </div>
          </div>

          {/* Dias da Semana */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-200 block">
              Dias da Semana Ativos:
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_LABELS.map((label, idx) => {
                const isSelected = daysOfWeek.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleToggleDay(idx)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-pink-950 border border-pink-500 text-pink-200 font-black shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                        : 'bg-[#150f2e] border border-purple-950 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parâmetros avançados: Janela de horas à frente, espaçamento, velas de proteção */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Janela do Envio:
              </label>
              <select
                value={windowHoursAhead}
                onChange={(e) => setWindowHoursAhead(parseInt(e.target.value, 10))}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-2 py-1.5 text-xs text-white"
              >
                <option value={1}>Próxima 1 Hora</option>
                <option value={2}>Próximas 2 Horas</option>
                <option value={3}>Próximas 3 Horas</option>
                <option value={4}>Próximas 4 Horas</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Espaçamento Mínimo:
              </label>
              <select
                value={minSpacingMinutes}
                onChange={(e) => setMinSpacingMinutes(parseInt(e.target.value, 10))}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-2 py-1.5 text-xs text-white"
              >
                <option value={1}>1 minuto (todos)</option>
                <option value={2}>2 minutos (recomendado)</option>
                <option value={3}>3 minutos</option>
                <option value={5}>5 minutos</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Janela de Proteção:
              </label>
              <select
                value={candleWindow}
                onChange={(e) => setCandleWindow(parseInt(e.target.value, 10))}
                className="w-full bg-[#17112f] border border-purple-900/60 rounded-xl px-2 py-1.5 text-xs text-white"
              >
                <option value={4}>4 velas</option>
                <option value={6}>6 velas (oficial VIP)</option>
                <option value={8}>8 velas</option>
              </select>
            </div>
          </div>

          {/* Save Programação Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => handleSaveConfig()}
              disabled={isSavingConfig}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/70 cursor-pointer transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>{isSavingConfig ? 'SALVANDO CONFIGURAÇÃO...' : 'SALVAR PROGRAMAÇÃO COMPLETA ✅'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. HISTÓRICO DE LOTES (SINAIS ENVIADOS E CORRIGIDOS) */}
      <div className="bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-900/30">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            <h3 className="text-base font-extrabold text-white">
              Histórico de Lotes e Auditoria de Correções
            </h3>
            <span className="text-xs font-mono font-bold text-slate-400 bg-purple-950 px-2 py-0.5 rounded">
              {batches.length} registros
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadAllData(false)}
            className="text-xs text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Tabela</span>
          </button>
        </div>

        {batches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-purple-900/40 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-3">LOTE / DATA</th>
                  <th className="py-2.5 px-3">SALA</th>
                  <th className="py-2.5 px-3">INTERVALO</th>
                  <th className="py-2.5 px-3">SINAIS</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">CORREÇÃO (% ACERTO)</th>
                  <th className="py-2.5 px-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 font-mono">
                {batches.map((batch) => {
                  const isCorrected = batch.status === 'CORRIGIDO';
                  const isWaiting = batch.status === 'AGUARDANDO_CORRECAO';
                  const isProcessing = batch.status === 'PROCESSANDO';
                  const isError = batch.status === 'ERRO';

                  return (
                    <tr key={batch.id} className="hover:bg-purple-950/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-200">{batch.scheduledSlot}</div>
                        <div className="text-[10px] text-slate-500">{batch.date}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-pink-300">
                          {RADAR_CHANNELS[batch.channel]?.name || batch.channel}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {batch.house}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-bold">
                        {batch.startTime} às {batch.endTime}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white">{batch.signalsCount}</span> rosas
                      </td>
                      <td className="py-3 px-3">
                        {isCorrected ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-black text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> CORRIGIDO
                          </span>
                        ) : isWaiting ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700 font-black text-[10px] flex items-center gap-1 w-fit animate-pulse">
                            <Clock className="w-3 h-3" /> AGUARDANDO FIM
                          </span>
                        ) : isProcessing ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-700 font-black text-[10px] flex items-center gap-1 w-fit">
                            <RefreshCw className="w-3 h-3 animate-spin" /> PROCESSANDO
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-black text-[10px] flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3 h-3" /> {batch.lastError ? 'ERRO' : 'FALHA'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {batch.summary ? (
                          <div className="font-bold text-emerald-400">
                            {batch.summary.greenRate.toFixed(1)}% Greens{' '}
                            <span className="text-amber-300 text-[10px]">
                              (Maior: {batch.summary.highestMultiplier.toFixed(2)}x)
                            </span>
                          </div>
                        ) : isWaiting ? (
                          <span className="text-[10px] text-slate-500">
                            Aguardando último sinal ({batch.lastSignalTime})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {batch.listMessage && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBatchMessage({
                                  id: batch.id,
                                  title: `Lista Enviada (${batch.startTime} às ${batch.endTime})`,
                                  content: batch.listMessage,
                                })
                              }
                              className="px-2 py-1 rounded bg-[#1b1535] hover:bg-purple-900 text-[10px] text-pink-300 font-bold"
                            >
                              Ver Lista
                            </button>
                          )}

                          {batch.correctedMessage && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBatchMessage({
                                  id: batch.id,
                                  title: `Correção Oficial (${batch.startTime} às ${batch.endTime})`,
                                  content: batch.correctedMessage,
                                })
                              }
                              className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-[10px] text-emerald-300 font-bold border border-emerald-800"
                            >
                              Ver Correção
                            </button>
                          )}

                          {isError && (
                            <button
                              type="button"
                              onClick={() => handleRetryBatch(batch.id)}
                              disabled={retryingBatchId === batch.id}
                              className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-[10px] text-rose-300 font-bold border border-rose-800"
                            >
                              {retryingBatchId === batch.id ? '...' : 'Tentar Novamente'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-[#090614] rounded-2xl border border-dashed border-purple-900/50">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">Nenhum lote disparado ainda.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Quando chegar o horário programado ou ao clicar no botão "Disparar Lista Agora", a lista e sua respectiva correção aparecerão aqui automaticamente.
            </p>
          </div>
        )}
      </div>

      {/* 4. CONSOLE DE LOGS DO AGENDADOR */}
      <div className="bg-[#0f0b1f] border border-purple-900/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-purple-900/30">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Auditoria em Tempo Real & Logs do Sistema</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-500">Últimos {logs.length} eventos</span>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs scrollbar-thin">
          {logs.length > 0 ? (
            logs.map((log) => {
              const isSuccess = log.level === 'SUCCESS';
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';

              return (
                <div
                  key={log.id}
                  className="p-2 rounded-xl bg-[#090614] border border-purple-950/80 flex items-start justify-between gap-3 text-[11px]"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                        isSuccess
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isError
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : isWarn
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-purple-950 text-purple-300 border border-purple-800'
                      }`}
                    >
                      {log.level}
                    </span>
                    <div>
                      <span className="text-slate-200">{log.event}</span>
                      {log.details && (
                        <span className="text-slate-500 ml-1 text-[10px]">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-500 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-center text-slate-500 text-xs">
              Nenhum log registrado ainda.
            </div>
          )}
        </div>
      </div>

      {/* 5. GUIA DO GOOGLE CLOUD SCHEDULER & WEBHOOK */}
      <div className="bg-[#110c26] border border-sky-900/40 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400" />
          <h4 className="text-xs font-black text-white uppercase tracking-wider">
            Execução 24 Horas em Segundo Plano (Google Cloud Scheduler)
          </h4>
        </div>
        <p className="text-xs text-slate-300">
          O servidor possui um trabalhador autônomo interno executando a cada 30 segundos. Para garantir 100% de disponibilidade mesmo em caso de suspensão de CPU pelo Cloud Run, configure um gatilho HTTP no Google Cloud Scheduler:
        </p>
        <div className="p-3 rounded-xl bg-[#080512] border border-purple-950 font-mono text-xs text-slate-300 space-y-1">
          <div>
            <strong className="text-sky-300">Frequência:</strong> */1 * * * * (A cada 1 minuto)
          </div>
          <div className="break-all">
            <strong className="text-sky-300">URL Alvo:</strong>{' '}
            {typeof window !== 'undefined' ? `${window.location.origin}/api/scheduler/tick` : '/api/scheduler/tick'}
          </div>
          <div>
            <strong className="text-sky-300">Método HTTP:</strong> POST
          </div>
          <div>
            <strong className="text-sky-300">Header Seguro:</strong> x-scheduler-secret:{' '}
            <span className="text-pink-300">{config.schedulerSecret || 'analista-bravo-scheduler-key'}</span>
          </div>
        </div>
      </div>

      {/* MODAL DO QR CODE */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#120d2b] border border-purple-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <span>Conectar WhatsApp</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-white font-black text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Abra o WhatsApp no celular &gt; Aparelhos Conectados &gt; Conectar um Aparelho e aponte a câmera para o QR Code abaixo:
            </p>

            <div className="flex items-center justify-center min-h-[220px] bg-white rounded-2xl p-4 shadow-inner">
              {isLoadingQr ? (
                <div className="flex flex-col items-center gap-2 text-slate-800">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
                  <span className="text-xs font-bold">Gerando QR Code...</span>
                </div>
              ) : qrCodeData?.base64 ? (
                <img
                  src={
                    qrCodeData.base64.startsWith('data:')
                      ? qrCodeData.base64
                      : `data:image/png;base64,${qrCodeData.base64}`
                  }
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 object-contain"
                />
              ) : qrCodeData?.error ? (
                <div className="p-3 text-rose-600 text-xs font-bold">
                  {qrCodeData.error}
                </div>
              ) : (
                <div className="text-xs text-slate-500">QR Code indisponível.</div>
              )}
            </div>

            {qrCodeData?.pairingCode && (
              <div className="p-2.5 rounded-xl bg-[#1a1238] border border-purple-800">
                <span className="text-[10px] text-slate-400 block">Código de Pareamento:</span>
                <span className="text-base font-black text-emerald-400 tracking-widest font-mono">
                  {qrCodeData.pairingCode}
                </span>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleOpenQrModal}
                disabled={isLoadingQr}
                className="flex-1 py-2 px-3 rounded-xl bg-purple-900 hover:bg-purple-800 text-xs font-bold text-white cursor-pointer"
              >
                Atualizar QR Code 🔄
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPANDED MESSAGE DRAWER */}
      {expandedBatchMessage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#120d2b] border border-purple-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-pink-400" />
                <span>{expandedBatchMessage.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setExpandedBatchMessage(null)}
                className="text-slate-400 hover:text-white font-black text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <textarea
              readOnly
              rows={14}
              value={expandedBatchMessage.content}
              className="w-full bg-[#080512] border border-purple-950 rounded-2xl p-4 font-mono text-xs text-slate-200 resize-none focus:outline-none leading-relaxed"
            />

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(expandedBatchMessage.content);
                  notify('Mensagem copiada para a área de transferência!');
                }}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Mensagem</span>
              </button>

              <button
                type="button"
                onClick={() => setExpandedBatchMessage(null)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
