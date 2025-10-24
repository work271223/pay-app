import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

type UserProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  country: string;
};

type TransactionType = 'topup' | 'withdraw' | 'pay' | 'reward';

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  ccy: string;
  ts: string;
  status: string;
  merchant?: string;
  network?: string;
};

type PendingWithdrawal = {
  id: string;
  amount: number;
  ccy: string;
  ts: string;
  status: string;
};

type CardData = {
  pan: string;
  exp: string;
  cvv: string;
  last4: string;
};

type UserRecord = {
  profile: UserProfile;
  balance: number;
  cardActive: boolean;
  card: CardData;
  txs: Transaction[];
  pendingWithdrawals: PendingWithdrawal[];
  createdAt: number;
  gpay: boolean;
  apay: boolean;
  bybitLinked: boolean;
  onboarded: boolean;
};

type SupabaseUserRow = UserRecord & { username: string };

type DBShape = {
  users: Record<string, UserRecord>;
};

type GenericDatabase = {
  public: {
    Tables: {
      users: {
        Row: SupabaseUserRow;
        Insert: SupabaseUserRow;
        Update: Partial<SupabaseUserRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type GenericSupabaseClient = SupabaseClient<GenericDatabase>;

const supabaseClient: GenericSupabaseClient | null = SUPABASE_URL && SUPABASE_KEY ? createClient<GenericDatabase>(SUPABASE_URL, SUPABASE_KEY) : null;

const FILE_DB_PATH = path.join(process.cwd(), 'server_db.json');

const emptyDB: DBShape = { users: {} };

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function makeCard(username: string): CardData {
  const h = hash(username);
  const last4 = (h % 9000) + 1000;
  const pan = `4532 9901 2234 ${last4}`;
  const mm = ((Math.floor(h / 10) % 12) + 1).toString().padStart(2, '0');
  const yy = (27 + (h % 5)).toString().padStart(2, '0');
  const cvv = ((h % 900) + 100).toString();
  return { pan, exp: `${mm}/${yy}`, cvv, last4: `${last4}` };
}

function normalizeProfile(profile?: Partial<UserProfile> | null): UserProfile {
  const base: UserProfile = { firstName: 'BYBIT', lastName: 'VC User', phone: '', email: '', country: '' };
  if (!profile) return base;
  return {
    firstName: typeof profile.firstName === 'string' ? profile.firstName.trim() : base.firstName,
    lastName: typeof profile.lastName === 'string' ? profile.lastName.trim() : base.lastName,
    phone: typeof profile.phone === 'string' ? profile.phone.trim() : base.phone,
    email: typeof profile.email === 'string' ? profile.email.trim() : base.email,
    country: typeof profile.country === 'string' ? profile.country.trim() : base.country,
  };
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false;
  const tx = value as Record<string, unknown>;
  return (
    typeof tx.id === 'string' &&
    typeof tx.type === 'string' &&
    typeof tx.amount === 'number' &&
    typeof tx.ccy === 'string' &&
    typeof tx.ts === 'string' &&
    typeof tx.status === 'string'
  );
}

function isPendingWithdrawal(value: unknown): value is PendingWithdrawal {
  if (!value || typeof value !== 'object') return false;
  const pw = value as Record<string, unknown>;
  return (
    typeof pw.id === 'string' &&
    typeof pw.amount === 'number' &&
    typeof pw.ccy === 'string' &&
    typeof pw.ts === 'string' &&
    typeof pw.status === 'string'
  );
}

function normalizeRecord(username: string, record?: Partial<UserRecord> | null): UserRecord {
  const base: UserRecord = {
    profile: normalizeProfile(),
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
    onboarded: false,
  };

  if (!record) {
    return base;
  }

  const txs = Array.isArray(record.txs) ? record.txs.filter(isTransaction) : base.txs;
  const pending = Array.isArray(record.pendingWithdrawals) ? record.pendingWithdrawals.filter(isPendingWithdrawal) : base.pendingWithdrawals;
  const card = record.card && typeof record.card === 'object' ? (record.card as Partial<CardData>) : undefined;

  return {
    profile: normalizeProfile(record.profile),
    balance: typeof record.balance === 'number' ? record.balance : base.balance,
    cardActive: typeof record.cardActive === 'boolean' ? record.cardActive : base.cardActive,
    card: card
      ? {
          pan: typeof card.pan === 'string' ? card.pan : base.card.pan,
          exp: typeof card.exp === 'string' ? card.exp : base.card.exp,
          cvv: typeof card.cvv === 'string' ? card.cvv : base.card.cvv,
          last4: typeof card.last4 === 'string' ? card.last4 : base.card.last4,
        }
      : base.card,
    txs,
    pendingWithdrawals: pending,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : base.createdAt,
    gpay: typeof record.gpay === 'boolean' ? record.gpay : base.gpay,
    apay: typeof record.apay === 'boolean' ? record.apay : base.apay,
    bybitLinked: typeof record.bybitLinked === 'boolean' ? record.bybitLinked : base.bybitLinked,
    onboarded: typeof record.onboarded === 'boolean' ? record.onboarded : base.onboarded,
  };
}

async function readFileDB(): Promise<DBShape> {
  try {
    const raw = await fs.readFile(FILE_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw || '{}') as Partial<DBShape>;
    const users: Record<string, UserRecord> = {};
    if (parsed.users && typeof parsed.users === 'object') {
      for (const [username, value] of Object.entries(parsed.users)) {
        users[username] = normalizeRecord(username, value);
      }
    }
    return { users };
  } catch {
    return emptyDB;
  }
}

async function writeFileDB(db: DBShape): Promise<void> {
  const tmp = `${FILE_DB_PATH}.tmp`;
  const serialized = JSON.stringify(db, null, 2) + '\n';
  await fs.writeFile(tmp, serialized, 'utf-8');
  await fs.rename(tmp, FILE_DB_PATH);
}

async function getUserFromSupabase(username: string): Promise<UserRecord | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle<SupabaseUserRow>();

    if (error || !data) {
      return null;
    }

    return normalizeRecord(username, data as Partial<UserRecord>);
  } catch {
    return null;
  }
}

async function upsertUserToSupabase(username: string, record: UserRecord): Promise<boolean> {
  if (!supabaseClient) return false;
  try {
  const row: SupabaseUserRow = { ...record, username };
  const { error } = await supabaseClient.from('users').upsert(row, { onConflict: 'username' });
    return !error;
  } catch {
    return false;
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;

  if (supabaseClient) {
    const stored = await getUserFromSupabase(username);
    if (stored) {
      return NextResponse.json(stored);
    }

    const fresh = normalizeRecord(username);
    await upsertUserToSupabase(username, fresh);
    return NextResponse.json(fresh);
  }

  const db = await readFileDB();
  const record = db.users[username] ?? normalizeRecord(username);
  if (!db.users[username]) {
    db.users[username] = record;
    await writeFileDB(db);
  }
  return NextResponse.json(record);
}

export async function POST(request: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'missing body' }, { status: 400 });
  }

  const record = normalizeRecord(username, body as Partial<UserRecord>);

  if (supabaseClient) {
    const ok = await upsertUserToSupabase(username, record);
    if (!ok) {
      return NextResponse.json({ error: 'failed to save to supabase' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const db = await readFileDB();
  db.users[username] = record;
  await writeFileDB(db);
  return NextResponse.json({ ok: true });
}
