import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
let supabaseClient: any = null;
// prefer runtime envs for server
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    // lazy import to avoid hard dependency failures in environments without installed package
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    // if import fails, we will fallback to file DB
    supabaseClient = null;
  }
}

async function readFileDB() {
  const file = path.join(process.cwd(), 'server_db.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

async function writeFileDB(obj: any) {
  const file = path.join(process.cwd(), 'server_db.json');
  const tmp = file + '.tmp';
  const data = JSON.stringify(obj, null, 2) + '\n';
  await fs.writeFile(tmp, data, 'utf-8');
  // atomic replace
  await fs.rename(tmp, file);
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function makeCard(username: string) {
  const h = hash(username);
  const last4 = (h % 9000) + 1000;
  const pan = `4532 9901 2234 ${last4}`;
  const mm = ((Math.floor(h / 10) % 12) + 1).toString().padStart(2, '0');
  const yy = (27 + (h % 5)).toString().padStart(2, '0');
  const cvv = ((h % 900) + 100).toString();
  return { pan, exp: `${mm}/${yy}`, cvv, last4: `${last4}` };
}

function defaultRecord(username: string) {
  return {
    profile: { firstName: 'BYBIT', lastName: 'VC User', phone: '', email: '', country: '' },
    balance: 0,
    cardActive: false,
    card: makeCard(username),
    txs: [
      {
        id: `welcome-${Date.now()}`,
        type: 'reward',
        amount: 5,
        ccy: 'USDT',
        ts: new Date().toISOString(),
        status: 'Welcome bonus за регистрацию',
      },
    ],
    pendingWithdrawals: [],
    createdAt: Date.now(),
    gpay: false,
    apay: false,
    bybitLinked: false,
  };
}

async function getUserFromSupabase(username: string) {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from('users').select('*').eq('username', username).maybeSingle();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function upsertUserToSupabase(username: string, payload: any) {
  if (!supabaseClient) return false;
  try {
    // ensure username field exists
    const toSave = { ...payload, username };
    const { error } = await supabaseClient.from('users').upsert(toSave, { onConflict: 'username' });
    if (error) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export async function GET(request: Request, { params }: { params: { username: string } }) {
  const username = (await params).username;

  // If Supabase configured, prefer it
  if (supabaseClient) {
    const user = await getUserFromSupabase(username);
    if (user) return NextResponse.json(user);
    // create default and persist
    const def = defaultRecord(username);
    await upsertUserToSupabase(username, def);
    return NextResponse.json(def);
  }

  // Fallback: file DB
  const db = await readFileDB();
  if (!db.users) db.users = {};
  let user = db.users[username] ?? null;
  if (!user) {
    user = defaultRecord(username);
    db.users[username] = user;
    try {
      await writeFileDB(db);
    } catch (e) {}
  }
  return NextResponse.json(user);
}

export async function POST(request: Request, { params }: { params: { username: string } }) {
  const username = (await params).username;
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: 'missing body' }, { status: 400 });

  if (supabaseClient) {
    const ok = await upsertUserToSupabase(username, payload);
    if (!ok) return NextResponse.json({ error: 'failed to save to supabase' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const db = await readFileDB();
  if (!db.users) db.users = {};
  db.users[username] = payload;
  try {
    await writeFileDB(db);
  } catch (e) {
    return NextResponse.json({ error: 'failed to write' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
