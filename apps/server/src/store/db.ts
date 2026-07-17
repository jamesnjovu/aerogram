import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../config";
import { encrypt, decrypt } from "../crypto/encryption";

/**
 * Thin persistence layer over the built-in `node:sqlite`.
 * Stores app users, their (encrypted) Telegram session strings, and a lightweight
 * entity cache so we can rebuild InputPeers across server restarts.
 */

const dataDir = resolve(config.DATA_DIR);
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "app.sqlite"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id  TEXT    NOT NULL UNIQUE,
    phone       TEXT,
    first_name  TEXT,
    last_name   TEXT,
    username    TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enc_session  TEXT    NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entities (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    marked_id    TEXT    NOT NULL,
    raw_id       TEXT    NOT NULL,
    type         TEXT    NOT NULL,
    access_hash  TEXT,
    title        TEXT,
    PRIMARY KEY (user_id, marked_id)
  );
`);

export interface UserRow {
  id: number;
  tg_user_id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: number;
}

export interface EntityRow {
  marked_id: string;
  raw_id: string;
  type: string;
  access_hash: string | null;
  title: string | null;
}

const now = () => Math.floor(Date.now() / 1000);

/* ---------------------------- users ---------------------------- */

const selectUserByTg = db.prepare("SELECT * FROM users WHERE tg_user_id = ?");
const selectUserById = db.prepare("SELECT * FROM users WHERE id = ?");
const insertUser = db.prepare(
  `INSERT INTO users (tg_user_id, phone, first_name, last_name, username, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const updateUser = db.prepare(
  `UPDATE users SET phone = ?, first_name = ?, last_name = ?, username = ? WHERE id = ?`,
);

export function upsertUser(u: {
  tgUserId: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): UserRow {
  const existing = selectUserByTg.get(u.tgUserId) as UserRow | undefined;
  if (existing) {
    updateUser.run(
      u.phone ?? existing.phone,
      u.firstName ?? existing.first_name,
      u.lastName ?? existing.last_name,
      u.username ?? existing.username,
      existing.id,
    );
    return selectUserById.get(existing.id) as unknown as UserRow;
  }
  const info = insertUser.run(
    u.tgUserId,
    u.phone ?? null,
    u.firstName ?? null,
    u.lastName ?? null,
    u.username ?? null,
    now(),
  );
  return selectUserById.get(Number(info.lastInsertRowid)) as unknown as UserRow;
}

export function getUserById(id: number): UserRow | undefined {
  return selectUserById.get(id) as UserRow | undefined;
}

/* --------------------------- sessions -------------------------- */

const selectSession = db.prepare("SELECT enc_session FROM sessions WHERE user_id = ?");
const upsertSessionStmt = db.prepare(
  `INSERT INTO sessions (user_id, enc_session, updated_at) VALUES (?, ?, ?)
   ON CONFLICT(user_id) DO UPDATE SET enc_session = excluded.enc_session, updated_at = excluded.updated_at`,
);
const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE user_id = ?");

export function saveSession(userId: number, sessionString: string): void {
  upsertSessionStmt.run(userId, encrypt(sessionString), now());
}

export function loadSession(userId: number): string | null {
  const row = selectSession.get(userId) as { enc_session: string } | undefined;
  if (!row) return null;
  try {
    return decrypt(row.enc_session);
  } catch {
    return null;
  }
}

export function deleteSession(userId: number): void {
  deleteSessionStmt.run(userId);
}

/* --------------------------- entities -------------------------- */

const upsertEntityStmt = db.prepare(
  `INSERT INTO entities (user_id, marked_id, raw_id, type, access_hash, title)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(user_id, marked_id) DO UPDATE SET
     raw_id = excluded.raw_id, type = excluded.type,
     access_hash = excluded.access_hash, title = excluded.title`,
);
const selectEntity = db.prepare(
  "SELECT marked_id, raw_id, type, access_hash, title FROM entities WHERE user_id = ? AND marked_id = ?",
);

export function saveEntity(
  userId: number,
  e: { markedId: string; rawId: string; type: string; accessHash?: string | null; title?: string | null },
): void {
  upsertEntityStmt.run(userId, e.markedId, e.rawId, e.type, e.accessHash ?? null, e.title ?? null);
}

export function getEntity(userId: number, markedId: string): EntityRow | undefined {
  return selectEntity.get(userId, markedId) as EntityRow | undefined;
}

export { db };
