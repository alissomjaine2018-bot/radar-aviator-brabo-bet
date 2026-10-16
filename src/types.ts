export interface AviatorCandle {
  id: string;
  roundId: string;
  graphicId?: string;
  date: string; // DD/MM/YYYY or YYYY-MM-DD
  time: string; // HH:MM:SS
  dateTime: Date;
  timestamp: number; // Unix timestamp in ms
  multiplier: number;
  rawMultiplierStr: string;
}

export type MultiplierCategory = 'rose' | 'fire' | 'purple' | 'shield' | 'red' | 'not_found';

export interface SignalCorrection {
  signalTime: string; // HH:MM
  signalMinutes: number; // Minutes from midnight (e.g. 14*60 + 25 = 865)
  maxMultiplier: number;
  emoji: string;
  category: MultiplierCategory;
  categoryName: string;
  matchingCandles: AviatorCandle[];
  winningCandle: AviatorCandle | null;
  winningIndex: number; // 0 to 5
  found: boolean;
  formattedLine: string;
}

export interface CorrectionSummary {
  totalSignals: number;
  foundSignals: number;
  roses: number; // >= 10.00x
  fires: number; // 6.00x - 9.99x
  purples: number; // 3.00x - 5.99x
  shields: number; // 2.30x - 2.99x
  reds: number; // < 2.30x
  notFound: number;
  greenRate: number; // Percentage >= 2.30x
  vipTargetRate: number; // Percentage >= 3.00x
  highestMultiplier: number;
  averageMultiplier: number;
}

export interface TelegramTemplateConfig {
  headerTitle: string;
  subHeaderTitle?: string;
  brokerLink: string;
  protecao: string;
  objetivo: string;
  gatilho?: string;
  maxTentativas?: string;
  entradaRule?: string;
  goldenRules?: string[];
  disclaimer?: string;
  candleWindow: number; // default 6
}

export interface PinkSignalResult {
  totalSignals: number;
  daysCount: number;
  forceLevel: number;
  forceHeader: string;
  selectedDates: string[];
  startTime: string;
  endTime: string;
  minSpacingMinutes: number;
  pinkCandles: AviatorCandle[];
  uniqueMinutes: string[];
  allDetectedMinutes: string[];
  removedMinutes: string[];
  minuteStats: Array<{
    minute: string;
    maxMultiplier: number;
    count: number;
    dates: string[];
    candles: AviatorCandle[];
  }>;
  groupedByHourText: string;
  formattedTelegramMessage: string;
}

export type CasinoHouse = 'BETBRABO' | 'TORREBET';

export type AviatorFeedChannel =
  | 'aviator_1'
  | 'radar_ao_vivo'
  | 'aviator_premium'
  | 'torre_1'
  | 'torre_2';

export interface RadarChannelInfo {
  id: AviatorFeedChannel;
  name: string;
  title: string;
  shortName: string;
  badge: string;
  apiName: string;
  description: string;
  apiUrl: string;
  proxyUrl: string;
  brokerUrl: string;
  color: string;
  accentHex: string;
  house: CasinoHouse;
}

export type SidebarTabId =
  | 'correcao'
  | 'temperatura'
  | 'whatsapp_automacao'
  | 'aviator_1'
  | 'radar_ao_vivo'
  | 'aviator_premium'
  | 'torre_1'
  | 'torre_2'
  | 'chuva_pirata'
  | 'surf_roxas'
  | 'listinha_10x'
  | 'dez_x_bolso'
  | 'maxima_10_20'
  | 'maxima_50'
  | 'mil_x'
  | 'duplas_x';

export interface WhatsappGroupItem {
  id: string; // e.g. "120363028123456789@g.us"
  subject: string; // group title
  size?: number;
}

export type AutomationBatchStatus =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'ENVIADO'
  | 'AGUARDANDO_CORRECAO'
  | 'CORRIGIDO'
  | 'ERRO';

export interface AutomationBatch {
  id: string; // BATCH_2026-10-15_14-00_BETBRABO_aviator_1
  scheduledSlot: string; // e.g. "14:00"
  date: string; // YYYY-MM-DD
  house: CasinoHouse;
  channel: AviatorFeedChannel;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: AutomationBatchStatus;
  signalsCount: number;
  uniqueMinutes: string[];
  lastSignalTime: string;
  finishCheckTime: string; // ISO string when correction is eligible
  listMessage: string;
  listMessageId: string | null;
  listSentAt: string | null;
  correctedMessage: string | null;
  correctedMessageId: string | null;
  correctedSentAt: string | null;
  summary: CorrectionSummary | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: string;
  timestamp: string; // ISO
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  event: string;
  details?: any;
}

export interface AutomationConfig {
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstance: string;
  targetGroupJid: string;
  targetGroupName: string;
  enabled: boolean;
  timezone: string; // default "America/Sao_Paulo"
  selectedHouse: CasinoHouse;
  selectedChannel: AviatorFeedChannel;
  minSpacingMinutes: number; // default 2
  candleWindow: number; // default 6
  windowHoursAhead: number; // default 2
  timeSlots: string[]; // e.g. ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"]
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  schedulerSecret: string;
}

export interface AutomationStatus {
  connected: boolean;
  connectionState: 'open' | 'close' | 'connecting' | 'unknown';
  schedulerActive: boolean;
  timezone: string;
  currentTimeInTz: string;
  nextScheduledSlot: string | null;
  activeGroup: { id: string; name: string } | null;
  totalBatchesSent: number;
  totalBatchesCorrected: number;
  lastBatch: AutomationBatch | null;
}

export interface RadarAviatorCandle {
  id: number;
  mult: number;
  class: 'azul' | 'roxa' | 'rosa' | string;
  t: string; // "YYYY-MM-DD HH:MM:SS"
  rodada: number;
}

export interface RadarMomento {
  estado: 'recolhendo' | 'pagando' | 'normal' | string;
  motivos: string[];
  score_pagantes: number;
  score_azuis: number;
  regra_3_azuis?: boolean;
  last_update: string;
}

export interface RadarApiResponse {
  ok: boolean;
  ts: string;
  momento?: RadarMomento;
  ultimaVela?: RadarAviatorCandle;
  padroes?: any[];
  sinalAtivo?: any;
  sinalResultado?: any;
  historico?: RadarAviatorCandle[];
}
