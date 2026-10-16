import { automationDb } from './db.ts';
import { EvolutionApiClient } from './evolutionClient.ts';
import { generateAutomatedList, auditBatchCorrection } from './engineBridge.ts';
import { AutomationBatch, AutomationStatus } from '../types.ts';

let isTickRunning = false;
let intervalTimer: any = null;

/**
 * Returns current date and time info in the configured timezone (default: America/Sao_Paulo)
 */
export function getCurrentTimeInZone(timeZone: string = 'America/Sao_Paulo'): {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  dayOfWeek: number; // 0=Sunday, 1=Monday... 6=Saturday
  nowDate: Date;
} {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    let d = '01',
      m = '01',
      y = '2026',
      hh = '00',
      mm = '00';

    for (const p of parts) {
      if (p.type === 'day') d = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'year') y = p.value;
      if (p.type === 'hour') hh = p.value;
      if (p.type === 'minute') mm = p.value;
    }

    // Determine day of week in timezone
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'narrow',
    });
    // Calculate weekday using localized date
    const localDate = new Date(`${y}-${m}-${d}T${hh}:${mm}:00`);
    const dayOfWeek = localDate.getDay();

    return {
      dateStr: `${y}-${m}-${d}`,
      timeStr: `${hh}:${mm}`,
      dayOfWeek,
      nowDate: now,
    };
  } catch (err) {
    // Fallback if timezone string is invalid
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return {
      dateStr: `${y}-${m}-${d}`,
      timeStr: `${hh}:${mm}`,
      dayOfWeek: now.getDay(),
      nowDate: now,
    };
  }
}

/**
 * Calculates end time based on start time and hours ahead
 */
function calculateEndTime(startTime: string, hoursAhead: number = 2): string {
  const [h, m] = startTime.split(':').map((v) => parseInt(v, 10));
  const total = (h + hoursAhead) % 24;
  return `${String(total).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * Checks if current minute matches a slot within a 2-minute grace tolerance
 */
function isSlotDue(slot: string, current: string): boolean {
  const [sH, sM] = slot.split(':').map((v) => parseInt(v, 10));
  const [cH, cM] = current.split(':').map((v) => parseInt(v, 10));

  const slotTotal = sH * 60 + sM;
  const currentTotal = cH * 60 + cM;

  const diff = currentTotal - slotTotal;
  return diff >= 0 && diff <= 3; // Within 0 to 3 minutes past scheduled time
}

/**
 * Core Scheduler Tick Execution
 * Thread-safe & idempotent
 */
export async function runSchedulerTick(source: string = 'internal'): Promise<{
  executed: boolean;
  actions: string[];
  errors: string[];
}> {
  if (isTickRunning) {
    return { executed: false, actions: ['Tick em andamento, ignorando execução simultânea.'], errors: [] };
  }

  isTickRunning = true;
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    const config = automationDb.getConfig();
    const tzInfo = getCurrentTimeInZone(config.timezone);

    // 1. Audit active batches waiting for correction
    const activeBatches = automationDb.findActiveBatches();

    for (const batch of activeBatches) {
      if (batch.status === 'AGUARDANDO_CORRECAO') {
        try {
          const auditResult = await auditBatchCorrection(
            batch.uniqueMinutes,
            batch.channel,
            batch.house,
            config.candleWindow || 6
          );

          if (auditResult.isReady && auditResult.whatsappMessage) {
            // Send correction to the exact same group
            const evo = new EvolutionApiClient({
              baseUrl: config.evolutionApiUrl,
              apiKey: config.evolutionApiKey,
              instance: config.evolutionInstance,
            });

            if (config.targetGroupJid) {
              const sendRes = await evo.sendTextMessage(config.targetGroupJid, auditResult.whatsappMessage);

              if (sendRes.success) {
                batch.status = 'CORRIGIDO';
                batch.correctedMessage = auditResult.correctedMessage || null;
                batch.correctedMessageId = sendRes.messageId || null;
                batch.correctedSentAt = new Date().toISOString();
                batch.summary = auditResult.summary || null;
                batch.lastError = null;

                automationDb.saveBatch(batch);
                automationDb.addLog(
                  'SUCCESS',
                  `Lista corrigida enviada com sucesso no grupo ${config.targetGroupName || config.targetGroupJid}!`,
                  {
                    batchId: batch.id,
                    messageId: sendRes.messageId,
                    greenRate: `${auditResult.summary?.greenRate}%`,
                    maiorVela: auditResult.summary?.highestMultiplier,
                  }
                );
                actions.push(`Correção enviada para lote ${batch.id}`);
              } else {
                batch.retryCount = (batch.retryCount || 0) + 1;
                batch.lastError = sendRes.error || 'Falha ao enviar correção';
                automationDb.saveBatch(batch);
                errors.push(`Erro ao enviar correção do lote ${batch.id}: ${sendRes.error}`);
              }
            }
          }
        } catch (err: any) {
          batch.retryCount = (batch.retryCount || 0) + 1;
          batch.lastError = err?.message || String(err);
          automationDb.saveBatch(batch);
          errors.push(`Falha ao auditar lote ${batch.id}: ${err?.message || err}`);
        }
      }
    }

    // 2. Check if automation is enabled and if we should trigger a new scheduled batch
    if (!config.enabled) {
      return { executed: true, actions: [...actions, 'Automação pausada nas configurações.'], errors };
    }

    if (!config.targetGroupJid) {
      return { executed: true, actions: [...actions, 'Nenhum grupo de WhatsApp configurado.'], errors };
    }

    if (!config.daysOfWeek.includes(tzInfo.dayOfWeek)) {
      return { executed: true, actions: [...actions, `Hoje (dia ${tzInfo.dayOfWeek}) não está na escala de dias programados.`], errors };
    }

    // Check each configured time slot
    for (const slot of config.timeSlots) {
      if (isSlotDue(slot, tzInfo.timeStr)) {
        // Idempotency check: verify if batch was already created/sent for this slot & date
        const existingBatch = automationDb.findBatchBySlotAndDate(slot, tzInfo.dateStr);

        if (existingBatch && existingBatch.status !== 'ERRO') {
          // Already handled or in progress
          continue;
        }

        const batchId = `BATCH_${tzInfo.dateStr}_${slot.replace(':', '-')}_${config.selectedHouse}_${config.selectedChannel}`;
        const startTime = slot;
        const endTime = calculateEndTime(slot, config.windowHoursAhead || 2);

        // Reserve batch atomically
        const newBatch: AutomationBatch = {
          id: batchId,
          scheduledSlot: slot,
          date: tzInfo.dateStr,
          house: config.selectedHouse,
          channel: config.selectedChannel,
          startTime,
          endTime,
          status: 'PROCESSANDO',
          signalsCount: 0,
          uniqueMinutes: [],
          lastSignalTime: '',
          finishCheckTime: '',
          listMessage: '',
          listMessageId: null,
          listSentAt: null,
          correctedMessage: null,
          correctedMessageId: null,
          correctedSentAt: null,
          summary: null,
          retryCount: 0,
          lastError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        automationDb.saveBatch(newBatch);
        automationDb.addLog('INFO', `Iniciando geração programada para horário ${slot} (${config.selectedHouse} - ${config.selectedChannel}).`);

        try {
          // Generate automated list
          const generated = await generateAutomatedList({
            house: config.selectedHouse,
            channel: config.selectedChannel,
            startTime,
            endTime,
            minSpacingMinutes: config.minSpacingMinutes || 2,
          });

          const uniqueMinutes = generated.pinkResult.uniqueMinutes;
          const lastSignalTime = uniqueMinutes[uniqueMinutes.length - 1] || endTime;

          // Dispatch to WhatsApp
          const evo = new EvolutionApiClient({
            baseUrl: config.evolutionApiUrl,
            apiKey: config.evolutionApiKey,
            instance: config.evolutionInstance,
          });

          const sendRes = await evo.sendTextMessage(config.targetGroupJid, generated.whatsappMessage);

          if (!sendRes.success) {
            throw new Error(sendRes.error || 'Falha ao enviar mensagem de lista para o grupo');
          }

          newBatch.status = 'AGUARDANDO_CORRECAO';
          newBatch.signalsCount = uniqueMinutes.length;
          newBatch.uniqueMinutes = uniqueMinutes;
          newBatch.lastSignalTime = lastSignalTime;
          newBatch.listMessage = generated.whatsappMessage;
          newBatch.listMessageId = sendRes.messageId || null;
          newBatch.listSentAt = new Date().toISOString();
          newBatch.finishCheckTime = new Date(Date.now() + (uniqueMinutes.length * 2 + 10) * 60000).toISOString();
          newBatch.lastError = null;

          automationDb.saveBatch(newBatch);
          automationDb.addLog(
            'SUCCESS',
            `Lista de sinais das ${startTime} às ${endTime} enviada no WhatsApp (${uniqueMinutes.length} sinais)!`,
            {
              batchId: newBatch.id,
              messageId: sendRes.messageId,
              grupo: config.targetGroupName || config.targetGroupJid,
            }
          );

          actions.push(`Lista enviada para horário ${slot}`);
        } catch (err: any) {
          newBatch.status = 'ERRO';
          newBatch.lastError = err?.message || String(err);
          automationDb.saveBatch(newBatch);
          automationDb.addLog('ERROR', `Erro na geração/envio do lote ${batchId}`, { error: err?.message || err });
          errors.push(`Erro no lote ${slot}: ${err?.message || err}`);
        }
      }
    }

    return { executed: true, actions, errors };
  } catch (globalErr: any) {
    automationDb.addLog('ERROR', 'Falha crítica no ciclo do agendador', { error: globalErr?.message || globalErr });
    return { executed: false, actions, errors: [globalErr?.message || String(globalErr)] };
  } finally {
    isTickRunning = false;
  }
}

/**
 * Triggers an immediate test batch right now without waiting for scheduled clock time
 */
export async function triggerImmediateBatch(opts?: {
  startTime?: string;
  endTime?: string;
}): Promise<{
  success: boolean;
  batch?: AutomationBatch;
  error?: string;
}> {
  const config = automationDb.getConfig();
  const tzInfo = getCurrentTimeInZone(config.timezone);

  if (!config.targetGroupJid) {
    return { success: false, error: 'Selecione um grupo de WhatsApp primeiro nas configurações.' };
  }

  const [currH, currM] = tzInfo.timeStr.split(':').map((v) => parseInt(v, 10));
  const startTime = opts?.startTime || tzInfo.timeStr;
  const endH = (currH + (config.windowHoursAhead || 2)) % 24;
  const endTime = opts?.endTime || `${String(endH).padStart(2, '0')}:${String(currM).padStart(2, '0')}`;

  const batchId = `MANUAL_${Date.now()}_${config.selectedHouse}_${config.selectedChannel}`;

  const batch: AutomationBatch = {
    id: batchId,
    scheduledSlot: 'MANUAL',
    date: tzInfo.dateStr,
    house: config.selectedHouse,
    channel: config.selectedChannel,
    startTime,
    endTime,
    status: 'PROCESSANDO',
    signalsCount: 0,
    uniqueMinutes: [],
    lastSignalTime: '',
    finishCheckTime: '',
    listMessage: '',
    listMessageId: null,
    listSentAt: null,
    correctedMessage: null,
    correctedMessageId: null,
    correctedSentAt: null,
    summary: null,
    retryCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  automationDb.saveBatch(batch);
  automationDb.addLog('INFO', `Disparo manual iniciado para o grupo ${config.targetGroupName || config.targetGroupJid} (${startTime} às ${endTime}).`);

  try {
    const generated = await generateAutomatedList({
      house: config.selectedHouse,
      channel: config.selectedChannel,
      startTime,
      endTime,
      minSpacingMinutes: config.minSpacingMinutes || 2,
    });

    const uniqueMinutes = generated.pinkResult.uniqueMinutes;
    const lastSignalTime = uniqueMinutes[uniqueMinutes.length - 1] || endTime;

    const evo = new EvolutionApiClient({
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const sendRes = await evo.sendTextMessage(config.targetGroupJid, generated.whatsappMessage);

    if (!sendRes.success) {
      throw new Error(sendRes.error || 'Falha ao enviar mensagem no grupo');
    }

    batch.status = 'AGUARDANDO_CORRECAO';
    batch.signalsCount = uniqueMinutes.length;
    batch.uniqueMinutes = uniqueMinutes;
    batch.lastSignalTime = lastSignalTime;
    batch.listMessage = generated.whatsappMessage;
    batch.listMessageId = sendRes.messageId || null;
    batch.listSentAt = new Date().toISOString();
    batch.finishCheckTime = new Date(Date.now() + (uniqueMinutes.length * 2 + 10) * 60000).toISOString();
    batch.lastError = null;

    automationDb.saveBatch(batch);
    automationDb.addLog(
      'SUCCESS',
      `Lista manual enviada com sucesso no grupo ${config.targetGroupName || config.targetGroupJid}!`,
      {
        batchId: batch.id,
        messageId: sendRes.messageId,
        sinais: uniqueMinutes.length,
      }
    );

    return { success: true, batch };
  } catch (err: any) {
    batch.status = 'ERRO';
    batch.lastError = err?.message || String(err);
    automationDb.saveBatch(batch);
    automationDb.addLog('ERROR', 'Falha no disparo manual', { error: err?.message || err });
    return { success: false, batch, error: err?.message || String(err) };
  }
}

/**
 * Gets aggregated automation status for frontend
 */
export async function getAutomationStatus(): Promise<AutomationStatus> {
  const config = automationDb.getConfig();
  const tzInfo = getCurrentTimeInZone(config.timezone);

  const evo = new EvolutionApiClient({
    baseUrl: config.evolutionApiUrl,
    apiKey: config.evolutionApiKey,
    instance: config.evolutionInstance,
  });

  let connectionState: 'open' | 'close' | 'connecting' | 'unknown' = 'unknown';
  if (evo.isConfigured()) {
    const stateRes = await evo.getConnectionState();
    connectionState = stateRes.state;
  }

  // Find next scheduled slot
  let nextScheduledSlot: string | null = null;
  if (config.enabled && config.timeSlots.length > 0) {
    const sorted = [...config.timeSlots].sort();
    const futureSlot = sorted.find((s) => s > tzInfo.timeStr);
    nextScheduledSlot = futureSlot || sorted[0] || null;
  }

  const allBatches = automationDb.getBatches(100);
  const totalBatchesSent = allBatches.filter((b) => b.status === 'ENVIADO' || b.status === 'AGUARDANDO_CORRECAO' || b.status === 'CORRIGIDO').length;
  const totalBatchesCorrected = allBatches.filter((b) => b.status === 'CORRIGIDO').length;
  const lastBatch = allBatches[0] || null;

  return {
    connected: connectionState === 'open',
    connectionState,
    schedulerActive: config.enabled,
    timezone: config.timezone,
    currentTimeInTz: `${tzInfo.dateStr} ${tzInfo.timeStr}`,
    nextScheduledSlot,
    activeGroup: config.targetGroupJid
      ? { id: config.targetGroupJid, name: config.targetGroupName || config.targetGroupJid }
      : null,
    totalBatchesSent,
    totalBatchesCorrected,
    lastBatch,
  };
}

/**
 * Starts background autonomous worker inside server.ts (runs every 30 seconds)
 */
export function startAutonomousScheduler() {
  if (intervalTimer) return;
  console.log('[Scheduler] Starting autonomous background worker (tick every 30s)...');
  intervalTimer = setInterval(() => {
    runSchedulerTick('interval').catch((err) => {
      console.error('[Scheduler Worker Error]:', err);
    });
  }, 30000);

  // Run initial tick on boot after 5 seconds
  setTimeout(() => {
    runSchedulerTick('boot').catch(() => {});
  }, 5000);
}
