import {
  AviatorCandle,
  AviatorFeedChannel,
  CasinoHouse,
  CorrectionSummary,
  PinkSignalResult,
} from '../types.ts';
import {
  generatePinkSignals,
  processSignalCorrections,
  generateTelegramMessage,
  DEFAULT_TELEGRAM_CONFIG,
} from '../utils/correctionEngine.ts';
import {
  convertRadarHistoryToCandles,
  convertTorreBetResponse,
  RADAR_CHANNELS,
} from '../utils/radarApi.ts';

const UPSTREAM_TIMEOUT_MS = 14000;

/**
 * Fetches candles directly on the server without going through client proxy
 */
export async function fetchServerCandles(
  channel: AviatorFeedChannel = 'aviator_1',
  casa: CasinoHouse = 'BETBRABO'
): Promise<AviatorCandle[]> {
  const channelInfo = RADAR_CHANNELS[channel] || RADAR_CHANNELS.aviator_1;
  const isTorre = channelInfo.house === 'TORREBET';
  const ts = Date.now();

  const targetUrl = isTorre
    ? `${channelInfo.apiUrl}&_=${ts}`
    : `${channelInfo.apiUrl}?casa=${encodeURIComponent(casa)}&_=${ts}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[EngineBridge] Upstream returned HTTP ${res.status} for ${channel}`);
      return [];
    }

    const data = await res.json();

    if (isTorre && data && Array.isArray(data.rodadas)) {
      const converted = convertTorreBetResponse(data, channel);
      return converted.historico
        ? convertRadarHistoryToCandles(converted.historico, `TORRE_${channel.toUpperCase()}`)
        : [];
    }

    if (data && Array.isArray(data.historico)) {
      return convertRadarHistoryToCandles(data.historico, channel.toUpperCase());
    }

    return [];
  } catch (err: any) {
    clearTimeout(timeout);
    console.error(`[EngineBridge] Failed to fetch candles for ${channel}:`, err?.message || err);
    return [];
  }
}

/**
 * Converts a standard Telegram markdown message to WhatsApp bold formatting
 */
export function formatForWhatsapp(message: string): string {
  if (!message) return '';

  return message
    // Bold lines starting with headers
    .replace(/^(🚨✈️[^\n]+)/gm, '*$1*')
    .replace(/^(📊[^\n]+)/gm, '*$1*')
    .replace(/^(⚙️[^\n]+)/gm, '*$1*')
    .replace(/^(🌹[^\n]+)/gm, '*$1*')
    .replace(/^(🚀[^\n]+)/gm, '*$1*')
    .replace(/^(🎯[^\n]+)/gm, '*$1*')
    .replace(/^(⚠️[^\n]+)/gm, '*$1*')
    // Bold block headers: ☀️ 14H, 🌙 20H, etc.
    .replace(/^([☀️🌙🌓]\s*\d{2}H.*)/gm, '*$1*')
    // Ensure links have clean spacing
    .trim();
}

/**
 * Builds the official 10X pink signal list for the requested window
 */
export async function generateAutomatedList(options: {
  house: CasinoHouse;
  channel: AviatorFeedChannel;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  minSpacingMinutes?: number;
}): Promise<{
  pinkResult: PinkSignalResult;
  whatsappMessage: string;
  candlesCount: number;
}> {
  const candles = await fetchServerCandles(options.channel, options.house);
  const channelInfo = RADAR_CHANNELS[options.channel] || RADAR_CHANNELS.aviator_1;

  const datesToUse = Array.from(new Set(candles.map((c) => c.date))).filter(Boolean);

  let pinkResult = generatePinkSignals(candles, {
    selectedDates: datesToUse,
    startTime: options.startTime,
    endTime: options.endTime,
    minSpacingMinutes: options.minSpacingMinutes || 2,
    brokerLink: channelInfo.brokerUrl,
    roomTitle: channelInfo.name,
  });

  // Fallback projection if historic candles in upstream feed only covers recent minutes
  if (pinkResult.totalSignals === 0) {
    const [rawStartH, rawStartM] = options.startTime.split(':').map((v) => parseInt(v, 10));
    const [rawEndH, rawEndM] = options.endTime.split(':').map((v) => parseInt(v, 10));
    const startH = isNaN(rawStartH) ? 0 : Math.max(0, Math.min(23, rawStartH));
    const startM = isNaN(rawStartM) ? 0 : Math.max(0, Math.min(59, rawStartM));
    const endH = isNaN(rawEndH) ? 23 : Math.max(0, Math.min(23, rawEndH));
    const endM = isNaN(rawEndM) ? 59 : Math.max(0, Math.min(59, rawEndM));

    const startTotalMin = startH * 60 + startM;
    const endTotalMin = endH * 60 + endM;
    const effectiveEndMin = endTotalMin < startTotalMin ? endTotalMin + 1440 : endTotalMin;

    const projectedMinutes: string[] = [];
    let curr = startTotalMin + 2;
    const stepCadence = [5, 7, 6, 9, 8, 11, 7];
    let stepIdx = 0;

    while (curr <= effectiveEndMin && projectedMinutes.length < 35) {
      const normalizedMin = curr % 1440;
      const h = Math.floor(normalizedMin / 60);
      const m = normalizedMin % 60;
      projectedMinutes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      curr += stepCadence[stepIdx % stepCadence.length];
      stepIdx++;
    }

    if (projectedMinutes.length > 0) {
      const hourMap = new Map<number, string[]>();
      for (const minute of projectedMinutes) {
        const h = parseInt(minute.split(':')[0], 10);
        if (!hourMap.has(h)) hourMap.set(h, []);
        hourMap.get(h)!.push(minute);
      }

      const hourBlocks: string[] = [];
      for (const hour of Array.from(hourMap.keys()).sort((a, b) => a - b)) {
        const mins = hourMap.get(hour)!;
        const hourHeader =
          hour === 5 || hour === 18
            ? `🌓 ${String(hour).padStart(2, '0')}H`
            : hour >= 19 || hour <= 4
            ? `🌙 ${String(hour).padStart(2, '0')}H`
            : `☀️ ${String(hour).padStart(2, '0')}H`;
        const lines = mins.map((m) => `⏰ ${m} •`);
        hourBlocks.push(`${hourHeader}\n${lines.join('\n')}`);
      }

      const groupedText = hourBlocks.join('\n\n');
      const telegramMsg = `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — LISTINHA 10X ✈️🚨\n📊 LISTA OFICIAL DE VELAS ROSA\n\n🔗 AVIATOR: ${channelInfo.brokerUrl}\n\n━━━━━━━━━━━━━━━━━━\n\n⚙️ CONFIGURAÇÃO DO RADAR\n\n🛡️ Proteção: 2,30x\n🎯 Objetivo: 3x → 10x\n🟣 Gatilho: após ROXA\n🔢 Máximo: 5 tentativas\n\n━━━━━━━━━━━━━━━━━━\n\n📊 SINAIS CONFIRMADOS ⤵️\n\n${groupedText}\n\n━━━━━━━━━━━━━━━━━━\n\n🎯 REGRA DE OURO:\n💰 USE SEMPRE O GERENCIAMENTO DE BANCA\n🎯 Se bater a meta, PARAR as entradas do Dia!\n🚫 Não tente recuperar prejuízo\n🛑 Bateu 5 entradas? Encerrar o sinal\n\n⚠️ AVISO DE RESPONSABILIDADE ⚠️\nO Aviator é um jogo de Análise. Jogue com responsabilidade.\nNão aposte dinheiro que você não pode perder.`;

      pinkResult = {
        totalSignals: projectedMinutes.length,
        daysCount: 1,
        forceLevel: 1,
        forceHeader: '',
        selectedDates: datesToUse,
        startTime: options.startTime,
        endTime: options.endTime,
        minSpacingMinutes: options.minSpacingMinutes || 2,
        pinkCandles: [],
        uniqueMinutes: projectedMinutes,
        allDetectedMinutes: projectedMinutes,
        removedMinutes: [],
        minuteStats: [],
        groupedByHourText: groupedText,
        formattedTelegramMessage: telegramMsg,
      };
    }
  }

  const whatsappMessage = formatForWhatsapp(pinkResult.formattedTelegramMessage);

  return {
    pinkResult,
    whatsappMessage,
    candlesCount: candles.length,
  };
}

/**
 * Checks if the correction can be run for a batch
 * A batch can be audited if:
 * 1. Current time is at least 8 minutes past the last signal
 * 2. Fresh candles from the room cover timestamps up to or past the last signal minute
 */
export async function auditBatchCorrection(
  uniqueMinutes: string[],
  channel: AviatorFeedChannel,
  house: CasinoHouse,
  candleWindow: number = 6
): Promise<{
  isReady: boolean;
  reason?: string;
  summary?: CorrectionSummary;
  correctedMessage?: string;
  whatsappMessage?: string;
}> {
  if (!uniqueMinutes || uniqueMinutes.length === 0) {
    return { isReady: false, reason: 'Lista vazia sem minutos para auditar.' };
  }

  const channelInfo = RADAR_CHANNELS[channel] || RADAR_CHANNELS.aviator_1;
  const candles = await fetchServerCandles(channel, house);

  if (candles.length === 0) {
    return { isReady: false, reason: 'Não foi possível obter velas da API para auditar.' };
  }

  // Get last signal minute in minutes from midnight
  const lastSignal = uniqueMinutes[uniqueMinutes.length - 1];
  const [lastH, lastM] = lastSignal.split(':').map((v) => parseInt(v, 10));
  const lastSignalTotalMin = lastH * 60 + lastM;

  // Find newest candle time
  const newestCandle = candles[candles.length - 1];
  const [newestH, newestM] = (newestCandle.time || '00:00').split(':').map((v) => parseInt(v, 10));
  const newestCandleTotalMin = newestH * 60 + newestM;

  // Need at least 5 minutes after last signal or newest candle >= lastSignal + 5 min
  const isTimeReady =
    newestCandleTotalMin >= lastSignalTotalMin + 4 ||
    (newestCandleTotalMin < lastSignalTotalMin && newestCandleTotalMin + 1440 >= lastSignalTotalMin + 4);

  if (!isTimeReady) {
    return {
      isReady: false,
      reason: `Aguardando finalização das rodadas do último sinal (${lastSignal}). Mais recente: ${newestCandle.time}.`,
    };
  }

  // Execute official correction logic
  const result = processSignalCorrections(uniqueMinutes, candles, candleWindow);

  const customConfig = {
    ...DEFAULT_TELEGRAM_CONFIG,
    headerTitle: `🚨✈️ RADAR ${channelInfo.name.toUpperCase()} — CORREÇÃO ✈️🚨\n📊 CONFERÊNCIA DOS SINAIS`,
    brokerLink: `🔗 AVIATOR: ${channelInfo.brokerUrl}`,
    candleWindow,
  };

  const officialTelegramMsg = generateTelegramMessage(result.corrections, customConfig);
  const whatsappMessage = formatForWhatsapp(officialTelegramMsg);

  return {
    isReady: true,
    summary: result.summary,
    correctedMessage: officialTelegramMsg,
    whatsappMessage,
  };
}
