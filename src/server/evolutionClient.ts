import { WhatsappGroupItem } from '../types.ts';

interface EvolutionClientOptions {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export class EvolutionApiClient {
  private baseUrl: string;
  private apiKey: string;
  private instance: string;

  constructor(opts: EvolutionClientOptions) {
    // Strip trailing slashes
    this.baseUrl = (opts.baseUrl || '').trim().replace(/\/+$/, '');
    this.apiKey = (opts.apiKey || '').trim();
    this.instance = (opts.instance || 'analista_bravo').trim();
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
      Accept: 'application/json',
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.instance);
  }

  /**
   * Checks the connection state of the instance
   * Returns: 'open' | 'close' | 'connecting' | 'unknown'
   */
  public async getConnectionState(): Promise<{
    state: 'open' | 'close' | 'connecting' | 'unknown';
    raw?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { state: 'unknown', error: 'Evolution API não configurada (URL, API Key ou Instância ausente).' };
    }

    const url = `${this.baseUrl}/instance/connectionState/${encodeURIComponent(this.instance)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          state: 'close',
          error: `HTTP ${res.status}: ${errorText.slice(0, 150)}`,
        };
      }

      const data = await res.json();
      // Evolution v2 formats: data.instance?.state or data.state or data.connectionStatus
      const rawState =
        data?.instance?.state ||
        data?.state ||
        data?.connectionStatus ||
        (data?.instance?.connectionStatus ? data.instance.connectionStatus : 'unknown');

      const normalized = String(rawState).toLowerCase();
      let state: 'open' | 'close' | 'connecting' | 'unknown' = 'unknown';

      if (normalized === 'open' || normalized === 'connected') {
        state = 'open';
      } else if (normalized === 'close' || normalized === 'closed' || normalized === 'disconnected') {
        state = 'close';
      } else if (normalized === 'connecting' || normalized === 'qrcode') {
        state = 'connecting';
      }

      return { state, raw: data };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        state: 'unknown',
        error: err?.message || 'Falha ao consultar estado da instância.',
      };
    }
  }

  /**
   * Retrieves connection QR Code or Pairing Code
   */
  public async getConnectQrCode(): Promise<{
    success: boolean;
    pairingCode?: string;
    code?: string;
    base64?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Configure a URL, Instância e API Key primeiro.' };
    }

    const url = `${this.baseUrl}/instance/connect/${encodeURIComponent(this.instance)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return {
          success: false,
          error: `Falha ao obter QR Code (HTTP ${res.status}): ${txt.slice(0, 180)}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        pairingCode: data.pairingCode || data.code || undefined,
        code: data.code || undefined,
        base64: data.base64 || (typeof data.qrcode?.base64 === 'string' ? data.qrcode.base64 : undefined),
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        success: false,
        error: `Erro ao conectar com Evolution API: ${err?.message || err}`,
      };
    }
  }

  /**
   * Disconnects / Logs out the instance
   */
  public async logout(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Instância não configurada.' };
    }

    const url = `${this.baseUrl}/instance/logout/${encodeURIComponent(this.instance)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return { success: res.ok };
    } catch (err: any) {
      clearTimeout(timeout);
      return { success: false, error: err?.message || 'Falha ao desconectar instância.' };
    }
  }

  /**
   * Fetches all WhatsApp groups that the connected number is a member of
   */
  public async fetchAllGroups(): Promise<{
    success: boolean;
    groups: WhatsappGroupItem[];
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, groups: [], error: 'Instância não configurada.' };
    }

    // Evolution v2 endpoint for groups
    const url = `${this.baseUrl}/group/fetchAllGroups/${encodeURIComponent(this.instance)}?getParticipants=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return {
          success: false,
          groups: [],
          error: `HTTP ${res.status}: ${txt.slice(0, 180)}`,
        };
      }

      const data = await res.json();
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.groups)
        ? data.groups
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const groups: WhatsappGroupItem[] = rawList
        .filter((g: any) => g && (g.id || g.jid))
        .map((g: any) => {
          const id = String(g.id || g.jid || '');
          const subject = String(g.subject || g.name || id);
          const size = Number(g.size || g.participants?.length || 0);
          return { id, subject, size };
        })
        .sort((a, b) => a.subject.localeCompare(b.subject));

      return { success: true, groups };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        success: false,
        groups: [],
        error: `Falha ao listar grupos: ${err?.message || err}`,
      };
    }
  }

  /**
   * Sends text message to a specific WhatsApp number or group JID
   * Preserves formatting (*bold*, _italic_, emojis, line breaks)
   */
  public async sendTextMessage(
    targetJid: string,
    text: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    raw?: any;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Evolution API não configurada.' };
    }
    if (!targetJid || !targetJid.includes('@')) {
      return { success: false, error: 'Identificador do grupo inválido (JID esperado: XXXXX@g.us).' };
    }
    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Texto da mensagem não pode ser vazio.' };
    }

    const url = `${this.baseUrl}/message/sendText/${encodeURIComponent(this.instance)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const payload = {
      number: targetJid.trim(),
      text: text.trim(),
      delay: 1000,
      linkPreview: false,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          success: false,
          error: `HTTP ${res.status}: ${errorText.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      const messageId =
        data?.key?.id ||
        data?.messageId ||
        data?.id ||
        `EVO_${Date.now()}`;

      return {
        success: true,
        messageId,
        raw: data,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      return {
        success: false,
        error: `Erro ao enviar mensagem para ${targetJid}: ${err?.message || err}`,
      };
    }
  }
}
