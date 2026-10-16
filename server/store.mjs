import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openStore(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS api_keys(id TEXT PRIMARY KEY,name TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,scopes TEXT NOT NULL,expires INTEGER NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS connectors(id TEXT PRIMARY KEY,config TEXT NOT NULL,secret TEXT,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,idem_key TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,payload_hash TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,actor TEXT NOT NULL,approved_at TEXT,approval_expires INTEGER,approved_hash TEXT,provider TEXT);
 CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,op_id TEXT REFERENCES operations(id),at TEXT NOT NULL,type TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sandbox_effects(id TEXT PRIMARY KEY,op_id TEXT UNIQUE NOT NULL,repo TEXT NOT NULL,title TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS events_operation ON events(op_id,seq);`);
  return db;
}
