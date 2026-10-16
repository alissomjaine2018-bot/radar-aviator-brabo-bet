import fs from 'fs';
import path from 'path';
import {
  AutomationBatch,
  AutomationConfig,
  AutomationLog,
  CasinoHouse,
  AviatorFeedChannel,
} from '../types.ts';

interface AutomationDatabaseSchema {
  version: number;
  config: AutomationConfig;
  batches: AutomationBatch[];
  logs: AutomationLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'automation_db.json');
const DB_TMP_FILE = path.resolve(DATA_DIR, 'automation_db.tmp.json');

const DEFAULT_CONFIG: AutomationConfig = {
  evolutionApiUrl: process.env.EVOLUTION_API_URL || '',
  evolutionApiKey: process.env.EVOLUTION_API_KEY || '',
  evolutionInstance: process.env.EVOLUTION_INSTANCE_NAME || 'analista_bravo',
  targetGroupJid: '',
  targetGroupName: '',
  enabled: false,
  timezone: 'America/Sao_Paulo',
  selectedHouse: 'BETBRABO',
  selectedChannel: 'aviator_1',
  minSpacingMinutes: 2,
  candleWindow: 6,
  windowHoursAhead: 2,
  timeSlots: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  schedulerSecret: process.env.SCHEDULER_SECRET || 'analista-bravo-scheduler-key',
};

class AutomationDatabase {
  private schema: AutomationDatabaseSchema;
  private isWriting = false;

  constructor() {
    this.schema = this.loadFromDisk();
  }

  private ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('[DB] Failed to create data dir:', err);
      }
    }
  }

  private loadFromDisk(): AutomationDatabaseSchema {
    this.ensureDir();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          version: parsed.version || 1,
          config: {
            ...DEFAULT_CONFIG,
            ...(parsed.config || {}),
            // Ensure env vars take priority if set and DB has empty
            evolutionApiUrl: parsed.config?.evolutionApiUrl || process.env.EVOLUTION_API_URL || '',
            evolutionApiKey: parsed.config?.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
            evolutionInstance: parsed.config?.evolutionInstance || process.env.EVOLUTION_INSTANCE_NAME || 'analista_bravo',
            schedulerSecret: parsed.config?.schedulerSecret || process.env.SCHEDULER_SECRET || 'analista-bravo-scheduler-key',
          },
          batches: Array.isArray(parsed.batches) ? parsed.batches : [],
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        };
      } catch (err) {
        console.error('[DB] Error loading database from disk, using fallback defaults:', err);
      }
    }

    return {
      version: 1,
      config: { ...DEFAULT_CONFIG },
      batches: [],
      logs: [],
    };
  }

  private saveToDisk() {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      this.ensureDir();
      const payload = JSON.stringify(this.schema, null, 2);
      fs.writeFileSync(DB_TMP_FILE, payload, 'utf-8');
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('[DB] Error saving to disk:', err);
    } finally {
      this.isWriting = false;
    }
  }

  public getConfig(): AutomationConfig {
    return { ...this.schema.config };
  }

  public getPublicConfig(): Omit<AutomationConfig, 'evolutionApiKey' | 'schedulerSecret'> & {
    hasApiKey: boolean;
    hasSchedulerSecret: boolean;
    maskedApiKey: string;
  } {
    const raw = this.schema.config;
    const hasApiKey = Boolean(raw.evolutionApiKey && raw.evolutionApiKey.trim().length > 0);
    const hasSchedulerSecret = Boolean(raw.schedulerSecret && raw.schedulerSecret.trim().length > 0);
    const maskedApiKey = hasApiKey
      ? `${raw.evolutionApiKey.slice(0, 4)}••••••••${raw.evolutionApiKey.slice(-4)}`
      : '';

    const { evolutionApiKey, schedulerSecret, ...rest } = raw;
    return {
      ...rest,
      hasApiKey,
      hasSchedulerSecret,
      maskedApiKey,
    };
  }

  public updateConfig(partial: Partial<AutomationConfig>): AutomationConfig {
    // If partial has empty or masked API key, do not overwrite existing real API key
    if (partial.evolutionApiKey !== undefined) {
      if (partial.evolutionApiKey.includes('••••') || partial.evolutionApiKey.trim() === '') {
        delete partial.evolutionApiKey;
      }
    }

    this.schema.config = {
      ...this.schema.config,
      ...partial,
    };
    this.saveToDisk();
    return this.getConfig();
  }

  public getBatches(limit = 50): AutomationBatch[] {
    return [...this.schema.batches]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public getBatchById(id: string): AutomationBatch | undefined {
    return this.schema.batches.find((b) => b.id === id);
  }

  public findBatchBySlotAndDate(slot: string, date: string): AutomationBatch | undefined {
    return this.schema.batches.find((b) => b.scheduledSlot === slot && b.date === date);
  }

  public findActiveBatches(): AutomationBatch[] {
    return this.schema.batches.filter((b) =>
      b.status === 'ENVIADO' || b.status === 'AGUARDANDO_CORRECAO' || b.status === 'PROCESSANDO'
    );
  }

  public saveBatch(batch: AutomationBatch): AutomationBatch {
    const idx = this.schema.batches.findIndex((b) => b.id === batch.id);
    const updated = {
      ...batch,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      this.schema.batches[idx] = updated;
    } else {
      this.schema.batches.unshift(updated);
    }

    // Keep history manageable (last 200 batches)
    if (this.schema.batches.length > 200) {
      this.schema.batches = this.schema.batches.slice(0, 200);
    }

    this.saveToDisk();
    return updated;
  }

  public addLog(
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS',
    event: string,
    details?: any
  ): AutomationLog {
    const log: AutomationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      event,
      details,
    };

    this.schema.logs.unshift(log);
    if (this.schema.logs.length > 300) {
      this.schema.logs = this.schema.logs.slice(0, 300);
    }

    console.log(`[Automation ${level}] ${event}`, details ? JSON.stringify(details) : '');
    this.saveToDisk();
    return log;
  }

  public getLogs(limit = 60): AutomationLog[] {
    return [...this.schema.logs].slice(0, limit);
  }

  public clearLogs() {
    this.schema.logs = [];
    this.saveToDisk();
  }
}

export const automationDb = new AutomationDatabase();
