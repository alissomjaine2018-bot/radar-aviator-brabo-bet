import { AviatorCandle, AviatorFeedChannel, CasinoHouse, RadarApiResponse, RadarAviatorCandle, RadarChannelInfo } from '../types';

export const RADAR_DEFAULT_CASA: CasinoHouse = 'BETBRABO';

export const RADAR_CHANNELS: Record<AviatorFeedChannel, RadarChannelInfo> = {
  aviator_1: {
    id: 'aviator_1',
    name: 'Aviator 1',
    title: 'Gráfico Aviator 1 (Sala 1)',
    shortName: 'Aviator 1',
    badge: 'SALA 1',
    apiName: 'broadcast.php',
    description: 'Feed oficial de alta frequência Sala 1 BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast.php',
    proxyUrl: '/api/radar/broadcast',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator',
    color: 'cyan',
    accentHex: '#06b6d4',
    house: 'BETBRABO',
  },
  radar_ao_vivo: {
    id: 'radar_ao_vivo',
    name: 'Aviator VIP',
    title: 'Gráfico Aviator VIP (Radar Ao Vivo)',
    shortName: 'Aviator VIP',
    badge: 'VIP RADAR',
    apiName: 'broadcast2.php',
    description: 'Feed oficial analítico de leitura de momento BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast2.php',
    proxyUrl: '/api/radar/broadcast2',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator-vip',
    color: 'purple',
    accentHex: '#a855f7',
    house: 'BETBRABO',
  },
  aviator_premium: {
    id: 'aviator_premium',
    name: 'Aviator Premium',
    title: 'Gráfico Aviator Premium',
    shortName: 'Aviator Premium',
    badge: 'PREMIUM VIP',
    apiName: 'broadcast3.php',
    description: 'Feed oficial VIP de inteligência artificial BETBRABO',
    apiUrl: 'https://www.radar-aviator.com/broadcast3.php',
    proxyUrl: '/api/radar/broadcast3',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator-premium',
    color: 'amber',
    accentHex: '#f59e0b',
    house: 'BETBRABO',
  },
  torre_1: {
    id: 'torre_1',
    name: 'Aviator 1 (Torre Bet)',
    title: 'Gráfico 1 Oficial Torre Bet',
    shortName: 'Aviator 1',
    badge: 'GRÁFICO 1',
    apiName: 'grafico1',
    description: 'Feed oficial em tempo real Gráfico 1 Torre Bet',
    apiUrl: 'https://aviator-rodadas.vorexhub.pro/grafico1?chave=f61f4fa7607539c4cb1220734438c5a2fe0c79e6fa72dcd1',
    proxyUrl: '/api/torre/grafico1',
    brokerUrl: 'https://torre.bet',
    color: 'emerald',
    accentHex: '#10b981',
    house: 'TORREBET',
  },
  torre_2: {
    id: 'torre_2',
    name: 'Aviator 2 (Torre Bet)',
    title: 'Gráfico 2 Oficial Torre Bet',
    shortName: 'Aviator 2',
    badge: 'GRÁFICO 2',
    apiName: 'grafico2',
    description: 'Feed oficial em tempo real Gráfico 2 Torre Bet',
    apiUrl: 'https://aviator-rodadas.vorexhub.pro/grafico2?chave=f61f4fa7607539c4cb1220734438c5a2fe0c79e6fa72dcd1',
    proxyUrl: '/api/torre/grafico2',
    brokerUrl: 'https://torre.bet',
    color: 'amber',
    accentHex: '#f59e0b',
    house: 'TORREBET',
  },
};

export const CHANNELS_BY_HOUSE: Record<CasinoHouse, AviatorFeedChannel[]> = {
  BETBRABO: ['aviator_1', 'radar_ao_vivo', 'aviator_premium'],
  TORREBET: ['torre_1', 'torre_2'],
};

export const HOUSE_INFO: Record<CasinoHouse, {
  id: CasinoHouse;
  name: string;
  brandName: string;
  tagline: string;
  brokerUrl: string;
  channels: AviatorFeedChannel[];
  accentColor: string;
  defaultChannel: AviatorFeedChannel;
}> = {
  BETBRABO: {
    id: 'BETBRABO',
    name: 'Bet Bravo',
    brandName: 'BETBRABO',
    tagline: '3 Gráficos Oficiais (Aviator 1, VIP e Premium)',
    brokerUrl: 'https://www.betbrabo.com/casino/spribe/aviator-vip',
    channels: ['aviator_1', 'radar_ao_vivo', 'aviator_premium'],
    accentColor: '#a855f7',
    defaultChannel: 'aviator_1',
  },
  TORREBET: {
    id: 'TORREBET',
    name: 'Torre Bet',
    brandName: 'TORRE BET',
    tagline: '2 Gráficos Oficiais (Gráfico 1 e Gráfico 2)',
    brokerUrl: 'https://torre.bet',
    channels: ['torre_1', 'torre_2'],
    accentColor: '#10b981',
    defaultChannel: 'torre_1',
  },
};

export const RADAR_API_BASE_URL = RADAR_CHANNELS.radar_ao_vivo.apiUrl;

// Client-side cache and in-flight request deduplication
interface ClientCacheItem {
  data: RadarApiResponse;
  timestamp: number;
}
const clientCache = new Map<string, ClientCacheItem>();
const clientInFlight = new Map<string, Promise<RadarApiResponse>>();
const clientLastKnown = new Map<string, RadarApiResponse>();
const CLIENT_CACHE_TTL_MS = 2500; // 2.5s client-side cache
const CLIENT_FETCH_TIMEOUT_MS = 12000; // 12s client timeout

/**
 * Converts raw Torre Bet API response (grafico1 / grafico2 from vorexhub) into standard RadarApiResponse
 */
export function convertTorreBetResponse(raw: any, channel: AviatorFeedChannel = 'torre_1'): RadarApiResponse {
  const rodadas = Array.isArray(raw?.rodadas) ? raw.rodadas : [];
  const historico: RadarAviatorCandle[] = rodadas.map((r: any, idx: number) => {
    const mult = Number(r.multiplicador) || 1.0;
    const horaStr = String(r.hora || '');
    const parts = horaStr.split('T');
    const datePart = parts[0] || '';
    const timePart = (parts[1] || '').slice(0, 8) || '00:00:00';
    const cleanT = `${datePart} ${timePart}`;
    const roundIdNum = parseInt(String(r.rodada || '').replace(/\D/g, ''), 10) || Date.now() - idx * 1000;
    return {
      id: roundIdNum,
      rodada: roundIdNum,
      mult,
      t: cleanT,
      class: mult >= 10.0 ? 'rosa' : mult >= 2.0 ? 'roxa' : 'azul',
    };
  });

  // Calculate momento analytics dynamically from recent rounds
  const recent = historico.slice(0, 15);
  const pagantes = recent.filter((h) => h.mult >= 2.0).length;
  const roxas = recent.filter((h) => h.mult >= 2.0 && h.mult < 10.0).length;
  const rosas = recent.filter((h) => h.mult >= 10.0).length;
  const scorePagantes = Math.round((pagantes / Math.max(recent.length, 1)) * 100);
  const estado = scorePagantes >= 55 ? 'pagando' : scorePagantes <= 35 ? 'recolhendo' : 'normal';

  return {
    ok: true,
    ts: raw.atualizado_em || new Date().toISOString(),
    historico,
    ultimaVela: historico[0] || undefined,
    momento: {
      estado,
      motivos: [
        `Torre Bet: ${pagantes} velas pagantes nas últimas ${recent.length} rodadas (${roxas} roxas, ${rosas} rosas)`,
        scorePagantes >= 55 ? 'Mesa em momento quente com alta frequência de pagamentos' : 'Mesa em fluxo regular',
      ],
      score_pagantes: scorePagantes,
      score_azuis: 100 - scorePagantes,
      last_update: raw.atualizado_em || new Date().toISOString(),
    },
  };
}

/**
 * Fetches real-time Aviator broadcast data from radar-aviator.com or torre bet for specified channel
 */
export async function fetchRadarBroadcast(
  channel: AviatorFeedChannel = 'radar_ao_vivo',
  casa: string = RADAR_DEFAULT_CASA
): Promise<RadarApiResponse> {
  const cacheKey = `${channel}:${casa}`;

  // 1. Check client-side fresh cache
  const cached = clientCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < CLIENT_CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Check if identical request is currently in-flight
  const existingInFlight = clientInFlight.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  // 3. Initiate request with deduplication
  const fetchPromise = (async (): Promise<RadarApiResponse> => {
    const channelInfo = RADAR_CHANNELS[channel] || RADAR_CHANNELS.radar_ao_vivo;
    const ts = Date.now();
    const isTorre = channelInfo.house === 'TORREBET';

    const directTargetUrl = channelInfo.apiUrl.includes('?')
      ? `${channelInfo.apiUrl}&_=${ts}`
      : `${channelInfo.apiUrl}?casa=${encodeURIComponent(casa)}&_=${ts}`;

    const proxyPath = channelInfo.proxyUrl.includes('?')
      ? `${channelInfo.proxyUrl}&_=${ts}`
      : `${channelInfo.proxyUrl}?casa=${encodeURIComponent(casa)}&_=${ts}`;

    const localProxyUrl = typeof window !== 'undefined' ? proxyPath : `http://localhost:3000${proxyPath}`;

    const endpointsToTry = isTorre
      ? [
          // Direct attempt first for Torre Bet (vorexhub has Access-Control-Allow-Origin: *)
          directTargetUrl,
          // Local server proxy
          localProxyUrl,
          // Fallback CORS proxy
          `https://api.allorigins.win/raw?url=${encodeURIComponent(directTargetUrl)}`,
        ]
      : [
          // Local Vite / Express proxy route for Betbrabo
          localProxyUrl,
          // Fallback proxies
          `https://api.allorigins.win/raw?url=${encodeURIComponent(directTargetUrl)}`,
          `https://corsproxy.io/?${encodeURIComponent(directTargetUrl)}`,
        ];

    let lastError: Error | null = null;

    for (const url of endpointsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json, text/plain, */*',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        // Torre Bet format: { grafico: 1, atualizado_em: "...", rodadas: [...] }
        if (data && Array.isArray(data.rodadas)) {
          const radarRes = convertTorreBetResponse(data, channel);
          clientCache.set(cacheKey, { data: radarRes, timestamp: Date.now() });
          clientLastKnown.set(cacheKey, radarRes);
          return radarRes;
        }

        // Radar Bet Bravo format: { ok: true, historico: [...] }
        if (data && (data.ok === true || Array.isArray(data.historico) || data.ultimaVela)) {
          const radarRes = data as RadarApiResponse;
          clientCache.set(cacheKey, { data: radarRes, timestamp: Date.now() });
          clientLastKnown.set(cacheKey, radarRes);
          return radarRes;
        }
      } catch (err: any) {
        lastError = err;
        // continue to next endpoint fallback
      }
    }

    // If all endpoints failed or timed out, use last known data if available
    const fallback = clientLastKnown.get(cacheKey);
    if (fallback) {
      return fallback;
    }

    // Default empty structure so app never crashes
    const defaultData: RadarApiResponse = {
      ok: true,
      ts: new Date().toISOString(),
      historico: [],
      momento: {
        estado: 'normal',
        motivos: [],
        score_pagantes: 50,
        score_azuis: 50,
        last_update: new Date().toISOString(),
      },
    };
    return defaultData;
  })();

  clientInFlight.set(cacheKey, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    clientInFlight.delete(cacheKey);
  }
}

/**
 * Converts a single Radar candle from API to app's AviatorCandle format
 */
export function convertRadarCandleToAviatorCandle(
  rc: RadarAviatorCandle,
  graphicId: string = 'BETBRABO'
): AviatorCandle {
  const parts = (rc.t || '').trim().split(' ');
  const datePart = parts[0] || ''; // YYYY-MM-DD
  const timePart = parts[1] || '00:00:00'; // HH:MM:SS

  // Format YYYY-MM-DD to DD/MM/YYYY
  let formattedDate = datePart;
  if (datePart.includes('-')) {
    const [y, m, d] = datePart.split('-');
    if (d && m && y) {
      formattedDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  const dateTime = new Date(`${datePart}T${timePart}`);
  const timestamp = isNaN(dateTime.getTime()) ? Date.now() : dateTime.getTime();
  const roundId = String(rc.rodada || rc.id || Math.floor(timestamp / 1000));

  return {
    id: `radar-${graphicId}-${roundId}`,
    roundId,
    graphicId,
    date: formattedDate,
    time: timePart,
    dateTime: isNaN(dateTime.getTime()) ? new Date() : dateTime,
    timestamp,
    multiplier: Number(rc.mult) || 1.0,
    rawMultiplierStr: `${Number(rc.mult).toFixed(2)}x`,
  };
}

/**
 * Converts the full historico array from Radar API into AviatorCandle[]
 * Orders chronologically: oldest first -> newest last
 */
export function convertRadarHistoryToCandles(
  historico: RadarAviatorCandle[],
  graphicId: string = 'BETBRABO'
): AviatorCandle[] {
  if (!Array.isArray(historico)) return [];

  const candles = historico.map((rc) => convertRadarCandleToAviatorCandle(rc, graphicId));

  // Sort chronologically (oldest first, newest last)
  candles.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return Number(a.roundId) - Number(b.roundId);
  });

  return candles;
}

/**
 * Merges incoming candles from live polling into existing candles, avoiding duplicates
 */
export function mergeCandles(
  existing: AviatorCandle[],
  incoming: AviatorCandle[]
): AviatorCandle[] {
  const map = new Map<string, AviatorCandle>();

  // Add existing
  for (const c of existing) {
    const key = `${c.date}_${c.roundId || c.time}_${c.multiplier}`;
    map.set(key, c);
  }

  // Add incoming (will update or add new)
  for (const c of incoming) {
    const key = `${c.date}_${c.roundId || c.time}_${c.multiplier}`;
    map.set(key, c);
  }

  const merged = Array.from(map.values());

  // Sort chronologically
  merged.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return (a.roundId || '').localeCompare(b.roundId || '');
  });

  return merged;
}
