import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
// TURSO_DATABASE_URL points at the hosted database (Vercel, GitHub Actions); without it, a local SQLite file is used.
export function connect(url=process.env.TURSO_DATABASE_URL){
  if(!url){
    const dir=(process.env.TOKENPOLICE_DATA||'./data').replace(/\\/g,'/');
    mkdirSync(dir,{recursive:true});
    url='file:'+dir+'/votes.sqlite';
  }
  return createClient({url,authToken:process.env.TURSO_AUTH_TOKEN||undefined});
}
export const schema=[
  'CREATE TABLE IF NOT EXISTS votes(id TEXT PRIMARY KEY,event TEXT,member TEXT,amount TEXT,wallet TEXT,address TEXT,tx_hash TEXT,voted_at TEXT)',
  'CREATE INDEX IF NOT EXISTS votes_address ON votes(address)',
  'CREATE INDEX IF NOT EXISTS votes_wallet ON votes(wallet)',
  'CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT)',
  'CREATE TABLE IF NOT EXISTS ge6_events(tx_hash TEXT,log_index INTEGER,block_number INTEGER,block_hash TEXT,vote_index TEXT,address TEXT,amount TEXT,voted_at TEXT,PRIMARY KEY(tx_hash,log_index))',
  'CREATE TABLE IF NOT EXISTS indexer_lease(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,expires INTEGER)',
  'CREATE TABLE IF NOT EXISTS names(address TEXT PRIMARY KEY,name TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS manual_predictions(address TEXT PRIMARY KEY,rank1 TEXT,rank2 TEXT,rank3 TEXT,version INTEGER NOT NULL,updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS name_history(id INTEGER PRIMARY KEY,address TEXT,name TEXT,updated_at TEXT)',
  'CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,started INTEGER,count INTEGER)',
  'CREATE TABLE IF NOT EXISTS search_log(address TEXT PRIMARY KEY,count INTEGER NOT NULL,first_at TEXT NOT NULL,last_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS search_log_last ON search_log(last_at)',
];
export async function initialize(db){await db.batch(schema,'write');}
