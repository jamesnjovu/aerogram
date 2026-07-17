import { randomBytes } from "node:crypto";
import { Api, TelegramClient, sessions } from "telegram";
import { NewMessage, type NewMessageEvent } from "telegram/events";
import { config } from "../config";
import { loadSession, saveSession, deleteSession } from "../store/db";
import { normalizeMessage } from "./normalize";

const { StringSession } = sessions;

/**
 * Owns the lifecycle of GramJS TelegramClient instances.
 *
 * Two kinds of clients:
 *  - "pending": created during login, keyed by an opaque tempToken, not yet tied to an app user.
 *  - "active":  authorized clients keyed by app user id, kept warm and streaming updates.
 */

export type MessageEmitter = (
  userId: number,
  event: "message:new" | "message:edit",
  payload: unknown,
) => void;

interface PendingClient {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  createdAt: number;
}

interface ActiveClient {
  client: TelegramClient;
  lastAccess: number;
  updatesBound: boolean;
}

const PENDING_TTL_MS = 10 * 60 * 1000;
const IDLE_TTL_MS = 15 * 60 * 1000;

class ClientManager {
  private pending = new Map<string, PendingClient>();
  private active = new Map<number, ActiveClient>();
  private connecting = new Map<number, Promise<TelegramClient>>();
  private emitter: MessageEmitter | null = null;

  constructor() {
    setInterval(() => this.sweep(), 60 * 1000).unref();
  }

  setEmitter(fn: MessageEmitter) {
    this.emitter = fn;
  }

  private makeClient(sessionString: string): TelegramClient {
    const client = new TelegramClient(
      new StringSession(sessionString),
      config.API_ID,
      config.API_HASH,
      { connectionRetries: 5, autoReconnect: true, useWSS: true },
    );
    try {
      (client as unknown as { setLogLevel: (l: string) => void }).setLogLevel("error");
    } catch {
      /* older/newer GramJS may not expose setLogLevel */
    }
    return client;
  }

  /* ----------------------------- pending (login) ----------------------------- */

  async createPending(phone: string): Promise<{ tempToken: string; phoneCodeHash: string }> {
    const client = this.makeClient("");
    await client.connect();
    const { phoneCodeHash } = await client.sendCode(
      { apiId: config.API_ID, apiHash: config.API_HASH },
      phone,
    );
    const tempToken = randomBytes(24).toString("hex");
    this.pending.set(tempToken, { client, phone, phoneCodeHash, createdAt: Date.now() });
    return { tempToken, phoneCodeHash };
  }

  getPending(tempToken: string): PendingClient | undefined {
    return this.pending.get(tempToken);
  }

  async dropPending(tempToken: string): Promise<void> {
    const p = this.pending.get(tempToken);
    if (!p) return;
    this.pending.delete(tempToken);
    try {
      await p.client.disconnect();
    } catch {
      /* ignore */
    }
  }

  /** Promote a successfully-authorized pending client to an active client and persist its session. */
  async finalizeLogin(tempToken: string, userId: number): Promise<void> {
    const p = this.pending.get(tempToken);
    if (!p) throw new Error("pending login not found");
    this.pending.delete(tempToken);

    const sessionString = p.client.session.save() as unknown as string;
    saveSession(userId, sessionString);

    // Replace any existing active client for this user.
    const existing = this.active.get(userId);
    if (existing && existing.client !== p.client) {
      try {
        await existing.client.disconnect();
      } catch {
        /* ignore */
      }
    }
    const entry: ActiveClient = { client: p.client, lastAccess: Date.now(), updatesBound: false };
    this.active.set(userId, entry);
    this.bindUpdates(userId, entry);
  }

  /* ----------------------------- active clients ----------------------------- */

  /** Get (or transparently rehydrate) the authorized client for an app user. */
  async getClient(userId: number): Promise<TelegramClient> {
    const entry = this.active.get(userId);
    if (entry) {
      entry.lastAccess = Date.now();
      if (!entry.client.connected) await entry.client.connect();
      return entry.client;
    }

    // Coalesce concurrent rehydrations.
    const inFlight = this.connecting.get(userId);
    if (inFlight) return inFlight;

    const promise = this.rehydrate(userId).finally(() => this.connecting.delete(userId));
    this.connecting.set(userId, promise);
    return promise;
  }

  private async rehydrate(userId: number): Promise<TelegramClient> {
    const sessionString = loadSession(userId);
    if (!sessionString) throw new UnauthorizedError();

    const client = this.makeClient(sessionString);
    await client.connect();
    if (!(await client.isUserAuthorized())) {
      deleteSession(userId);
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
      throw new UnauthorizedError();
    }
    const entry: ActiveClient = { client, lastAccess: Date.now(), updatesBound: false };
    this.active.set(userId, entry);
    this.bindUpdates(userId, entry);
    return client;
  }

  private bindUpdates(userId: number, entry: ActiveClient): void {
    if (entry.updatesBound) return;
    entry.updatesBound = true;
    entry.client.addEventHandler(async (event: NewMessageEvent) => {
      try {
        const msg = event.message;
        const chatId = String((msg as any).chatId ?? event.chatId ?? "");
        if (!chatId) return;
        const dto = normalizeMessage(msg, chatId);
        this.emitter?.(userId, "message:new", { chatId, message: dto });
      } catch {
        /* never let a bad update crash the handler */
      }
    }, new NewMessage({}));
  }

  async logout(userId: number): Promise<void> {
    const entry = this.active.get(userId);
    this.active.delete(userId);
    deleteSession(userId);
    if (entry) {
      try {
        await entry.client.invoke(new Api.auth.LogOut());
      } catch {
        /* ignore */
      }
      try {
        await entry.client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  /* --------------------------------- upkeep --------------------------------- */

  private sweep(): void {
    const nowMs = Date.now();
    for (const [token, p] of this.pending) {
      if (nowMs - p.createdAt > PENDING_TTL_MS) void this.dropPending(token);
    }
    for (const [userId, entry] of this.active) {
      if (nowMs - entry.lastAccess > IDLE_TTL_MS) {
        this.active.delete(userId);
        entry.client.disconnect().catch(() => {});
      }
    }
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export const clientManager = new ClientManager();
