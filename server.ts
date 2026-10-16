import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

// Middlewares
app.use(express.json());

// CORS & Security headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    nodeVersion: process.version,
  });
});

// In-memory cache and in-flight request deduplication for radar API
interface RadarCacheItem {
  data: any;
  timestamp: number;
}
const radarCache = new Map<string, RadarCacheItem>();
const radarInFlight = new Map<string, Promise<any>>();
const lastKnownGoodData = new Map<string, any>();
const CACHE_TTL_MS = 3500; // 3.5s cache to avoid spamming upstream
const UPSTREAM_TIMEOUT_MS = 14000; // 14s timeout for upstream

// Proxy helper for radar-aviator official endpoints
async function proxyRadarRequest(scriptName: string, req: express.Request, res: express.Response) {
  const casa = (req.query.casa as string) || 'BETBRABO';
  const cacheKey = `${scriptName}:${casa}`;

  // 1. Check in-memory fresh cache
  const cached = radarCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  // 2. Check if a request for this exact script & casa is already in-flight
  let requestPromise = radarInFlight.get(cacheKey);

  if (!requestPromise) {
    // 3. Initiate fetch with generous timeout and deduplication
    requestPromise = (async () => {
      const targetUrl = `https://www.radar-aviator.com/${scriptName}?casa=${encodeURIComponent(casa)}&_=${Date.now()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      try {
        const apiRes = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
          },
        });

        clearTimeout(timeout);

        if (!apiRes.ok) {
          throw new Error(`Upstream returned status ${apiRes.status}`);
        }

        const data = await apiRes.json();
        // Update cache and last known good
        radarCache.set(cacheKey, { data, timestamp: Date.now() });
        lastKnownGoodData.set(cacheKey, data);
        return data;
      } catch (err: any) {
        clearTimeout(timeout);
        const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
        if (!isAbort) {
          console.warn(`[Radar Proxy Warning] ${scriptName} (${casa}):`, err?.message || err);
        }

        // Fallback to last known good data if available
        const fallback = lastKnownGoodData.get(cacheKey);
        if (fallback) {
          return { ...fallback, _cachedFallback: true };
        }

        // Minimal safe structure so client never crashes
        return {
          ok: true,
          historico: [],
          momento: { estado: 'normal' },
          _defaultFallback: true,
        };
      } finally {
        radarInFlight.delete(cacheKey);
      }
    })();

    radarInFlight.set(cacheKey, requestPromise);
  }

  try {
    const result = await requestPromise;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Cache', 'MISS');
    return res.json(result);
  } catch (err: any) {
    // If unexpected error occurs, return fallback
    const fallback = lastKnownGoodData.get(cacheKey) || {
      ok: true,
      historico: [],
      momento: { estado: 'normal' },
    };
    res.setHeader('Content-Type', 'application/json');
    return res.json(fallback);
  }
}

// Aviator 1 (broadcast.php)
app.get('/api/radar/broadcast', (req, res) => {
  return proxyRadarRequest('broadcast.php', req, res);
});

// Aviator VIP (broadcast2.php)
app.get('/api/radar/broadcast2', (req, res) => {
  return proxyRadarRequest('broadcast2.php', req, res);
});

// Aviator Premium (broadcast3.php)
app.get('/api/radar/broadcast3', (req, res) => {
  return proxyRadarRequest('broadcast3.php', req, res);
});

// Generic radar alias fallback
app.get('/api/radar', (req, res) => {
  return proxyRadarRequest('broadcast2.php', req, res);
});

// Torre Bet official endpoints proxy
const TORRE_ENDPOINTS: Record<string, string> = {
  grafico1:
    'https://aviator-rodadas.vorexhub.pro/grafico1?chave=f61f4fa7607539c4cb1220734438c5a2fe0c79e6fa72dcd1',
  grafico2:
    'https://aviator-rodadas.vorexhub.pro/grafico2?chave=f61f4fa7607539c4cb1220734438c5a2fe0c79e6fa72dcd1',
};

async function proxyTorreRequest(graficoKey: 'grafico1' | 'grafico2', req: express.Request, res: express.Response) {
  const targetUrl = TORRE_ENDPOINTS[graficoKey];
  const cacheKey = `torre:${graficoKey}`;

  // 1. Check in-memory fresh cache
  const cached = radarCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  // 2. Check in-flight
  let requestPromise = radarInFlight.get(cacheKey);
  if (!requestPromise) {
    requestPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        const apiRes = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
          },
        });
        clearTimeout(timeout);
        if (!apiRes.ok) throw new Error(`Torre Bet returned status ${apiRes.status}`);
        const data = await apiRes.json();
        radarCache.set(cacheKey, { data, timestamp: Date.now() });
        lastKnownGoodData.set(cacheKey, data);
        return data;
      } catch (err: any) {
        clearTimeout(timeout);
        console.warn(`[Torre Bet Proxy Warning] ${graficoKey}:`, err?.message || err);
        const fallback = lastKnownGoodData.get(cacheKey);
        if (fallback) return { ...fallback, _cachedFallback: true };
        return {
          grafico: graficoKey === 'grafico1' ? 1 : 2,
          atualizado_em: new Date().toISOString(),
          rodadas: [],
        };
      } finally {
        radarInFlight.delete(cacheKey);
      }
    })();
    radarInFlight.set(cacheKey, requestPromise);
  }

  try {
    const result = await requestPromise;
    res.setHeader('Content-Type', 'application/json');
    return res.json(result);
  } catch (err: any) {
    const fallback = lastKnownGoodData.get(cacheKey) || {
      grafico: graficoKey === 'grafico1' ? 1 : 2,
      atualizado_em: new Date().toISOString(),
      rodadas: [],
    };
    res.setHeader('Content-Type', 'application/json');
    return res.json(fallback);
  }
}

app.get('/api/torre/grafico1', (req, res) => {
  return proxyTorreRequest('grafico1', req, res);
});

app.get('/api/torre/grafico2', (req, res) => {
  return proxyTorreRequest('grafico2', req, res);
});

// ==========================================
// WHATSAPP AUTOMATION & SCHEDULER ENDPOINTS
// ==========================================
import { automationDb } from './src/server/db.ts';
import { EvolutionApiClient } from './src/server/evolutionClient.ts';
import {
  runSchedulerTick,
  triggerImmediateBatch,
  getAutomationStatus,
  startAutonomousScheduler,
} from './src/server/scheduler.ts';

// Get automation aggregated status
app.get('/api/automation/status', async (req, res) => {
  try {
    const status = await getAutomationStatus();
    res.json({ ok: true, status });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Falha ao obter status' });
  }
});

// Get public configuration (API Key masked for security)
app.get('/api/automation/config', (req, res) => {
  try {
    const config = automationDb.getPublicConfig();
    res.json({ ok: true, config });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Update configuration
app.post('/api/automation/config', (req, res) => {
  try {
    const updated = automationDb.updateConfig(req.body || {});
    automationDb.addLog('INFO', 'Configurações de automação atualizadas pelo painel.');
    res.json({ ok: true, config: automationDb.getPublicConfig() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Connect instance & get QR Code
app.get('/api/automation/connect', async (req, res) => {
  try {
    const config = automationDb.getConfig();
    const evo = new EvolutionApiClient({
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const qrResult = await evo.getConnectQrCode();
    res.json({ ok: qrResult.success, ...qrResult });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Disconnect instance
app.post('/api/automation/disconnect', async (req, res) => {
  try {
    const config = automationDb.getConfig();
    const evo = new EvolutionApiClient({
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const logoutRes = await evo.logout();
    automationDb.addLog('INFO', 'Instância do WhatsApp desconectada pelo usuário.');
    res.json({ ok: logoutRes.success, ...logoutRes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Fetch all WhatsApp groups available on connected number
app.get('/api/automation/groups', async (req, res) => {
  try {
    const config = automationDb.getConfig();
    const evo = new EvolutionApiClient({
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const groupsRes = await evo.fetchAllGroups();
    res.json({ ok: groupsRes.success, groups: groupsRes.groups, error: groupsRes.error });
  } catch (err: any) {
    res.status(500).json({ ok: false, groups: [], error: err?.message });
  }
});

// Send test message to configured or specified group
app.post('/api/automation/test-send', async (req, res) => {
  try {
    const config = automationDb.getConfig();
    const targetJid = req.body.targetJid || config.targetGroupJid;
    const customText = req.body.text;

    if (!targetJid) {
      return res.status(400).json({ ok: false, error: 'Nenhum grupo de WhatsApp selecionado.' });
    }

    const evo = new EvolutionApiClient({
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const testMessage =
      customText ||
      `*🚨✈️ ANALISTA BRAVO — TESTE DE CONEXÃO OFICIAL ✈️🚨*\n\n✅ Integração com o WhatsApp homologada com sucesso!\n⏰ Teste executado em: ${new Date().toLocaleString('pt-BR', { timeZone: config.timezone })}\n📍 Grupo: *${config.targetGroupName || targetJid}*\n\n_As listas de sinais 10x e correções automáticas serão publicadas pontualmente neste canal._`;

    const sendRes = await evo.sendTextMessage(targetJid, testMessage);

    if (sendRes.success) {
      automationDb.addLog('SUCCESS', `Mensagem de teste enviada com sucesso para ${config.targetGroupName || targetJid}!`, {
        messageId: sendRes.messageId,
      });
      return res.json({ ok: true, messageId: sendRes.messageId });
    } else {
      automationDb.addLog('ERROR', `Falha no envio de teste para ${targetJid}: ${sendRes.error}`);
      return res.status(400).json({ ok: false, error: sendRes.error });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Get batches history
app.get('/api/automation/batches', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const batches = automationDb.getBatches(limit);
    res.json({ ok: true, batches });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Trigger immediate manual batch for testing
app.post('/api/automation/trigger-batch', async (req, res) => {
  try {
    const result = await triggerImmediateBatch({
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    });
    if (result.success) {
      res.json({ ok: true, batch: result.batch });
    } else {
      res.status(400).json({ ok: false, error: result.error, batch: result.batch });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Retry a specific batch
app.post('/api/automation/retry-batch/:id', async (req, res) => {
  try {
    const batch = automationDb.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ ok: false, error: 'Lote não encontrado.' });
    }

    batch.status = 'PROCESSANDO';
    batch.retryCount = 0;
    batch.lastError = null;
    automationDb.saveBatch(batch);

    // Re-run tick immediately
    const tickResult = await runSchedulerTick('retry');
    res.json({ ok: true, tickResult, batch: automationDb.getBatchById(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Get audit logs
app.get('/api/automation/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 60;
    const logs = automationDb.getLogs(limit);
    res.json({ ok: true, logs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// Cloud Scheduler / Webhook Cron Trigger
// Supports GET and POST with secret token check
const handleSchedulerTickRoute = async (req: express.Request, res: express.Response) => {
  const config = automationDb.getConfig();
  const secret =
    (req.headers['x-scheduler-secret'] as string) ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '') ||
    (req.query.secret as string);

  if (config.schedulerSecret && secret !== config.schedulerSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid scheduler secret token' });
  }

  try {
    const result = await runSchedulerTick('cloud-scheduler');
    res.json({ ok: true, timestamp: new Date().toISOString(), result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
};

app.post('/api/scheduler/tick', handleSchedulerTickRoute);
app.get('/api/scheduler/tick', handleSchedulerTickRoute);

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  // Start internal autonomous scheduler worker (runs every 30s)
  startAutonomousScheduler();

  if (isProduction && fs.existsSync(path.resolve(distPath, 'index.html'))) {
    console.log('[Server] Running in production mode, serving dist static files.');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    console.log('[Server] Running in development mode with Vite middleware.');
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, host, () => {
    console.log(`[Server] Analista Bravo ready on http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
