"use client";

import React, {
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowDownToDot,
	ArrowRight,
	ArrowUpFromDot,
	ChevronRight,
	Coins,
	Copy,
	CreditCard,
	Eye,
	Gift,
	History,
	Settings,
	ShieldCheck,
	Sparkles,
	Sun,
	Moon,
	User,
	Wallet,
	} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";

type ThemeVariant = "light" | "bybit";
type TabKey = "home" | "bonuses" | "cards" | "profile";
type ScreenState = "intro" | "onboarding" | "loading" | "app";

type UserProfile = {
	firstName: string;
	lastName: string;
	phone: string;
	email: string;
	country: string;
};

type TransactionType = "topup" | "withdraw" | "pay" | "reward";

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

type ReferralStats = {
	code: string;
	link: string;
	earned: number;
	referrals: number;
	rate: number;
};

type AppState = {
	username: string;
	profile: UserProfile;
	setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
	balance: number;
	setBalance: React.Dispatch<React.SetStateAction<number>>;
	maskedCard: string;
	cardHolder: string;
	gpay: boolean;
	setGpay: React.Dispatch<React.SetStateAction<boolean>>;
	apay: boolean;
	setApay: React.Dispatch<React.SetStateAction<boolean>>;
	bybitLinked: boolean;
	setBybitLinked: React.Dispatch<React.SetStateAction<boolean>>;
	refStats: ReferralStats;
	cardData: CardData;
	cardActive: boolean;
	setCardActive: React.Dispatch<React.SetStateAction<boolean>>;
	txs: Transaction[];
	setTxs: React.Dispatch<React.SetStateAction<Transaction[]>>;
};

const STORAGE_KEY = "byvc.db";
const USERNAME_KEY = "byvc.dev.username";

const emptyProfile: UserProfile = { firstName: "", lastName: "", phone: "", email: "", country: "" };

const PAYMENT_URL = "https://app.bybitpay.pro/";
const BYBIT_URL = "https://www.bybit.com/";

type DBShape = { users: Record<string, UserRecord> };

const emptyDB: DBShape = { users: {} };

function normalizeProfile(
	profile?: Partial<UserProfile> & { name?: string }
): UserProfile {
	if (!profile) return { ...emptyProfile };
	const fullName = typeof profile.name === "string" ? profile.name : "";
	const [fromNameFirst, ...fromNameRest] = fullName.trim().split(/\s+/).filter(Boolean);
	const firstName = (profile.firstName ?? fromNameFirst ?? "").trim();
	const lastName = (profile.lastName ?? (fromNameRest.length ? fromNameRest.join(" ") : "")).trim();
	const phone = (profile.phone ?? "").trim();
	const email = (profile.email ?? "").trim();
	const country = (profile.country ?? "").trim();
	return { firstName, lastName, phone, email, country };
}

function normalizeRecord(username: string, record: UserRecord | undefined): UserRecord {
	if (!record) return defaultRecord(username);
	const base = defaultRecord(username);
	const normalized: UserRecord = {
		...base,
		...record,
		profile: normalizeProfile(record.profile),
		onboarded: typeof record.onboarded === "boolean" ? record.onboarded : base.onboarded,
	};
	return normalized;
}

function safeParseDB(value: string | null): DBShape {
	if (!value) return emptyDB;
	try {
		const parsed = JSON.parse(value) as DBShape;
		if (!parsed || typeof parsed !== "object" || !parsed.users) return emptyDB;
		return parsed;
	} catch {
		return emptyDB;
	}
}

function readDB(): DBShape {
	// If running on client, prefer server-backed user storage by username
	if (typeof window === "undefined") return emptyDB;
	return safeParseDB(window.localStorage.getItem(STORAGE_KEY));
}

function writeDB(db: DBShape) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getTelegramUsername(): string | undefined {
	if (typeof window === "undefined") return undefined;
	const tg = (window as {
		Telegram?: { WebApp?: { initDataUnsafe?: { user?: { username?: string; id?: number } } } };
	}).Telegram?.WebApp?.initDataUnsafe?.user;
	return tg?.username || tg?.id?.toString();
}

function getUsername(): string {
	if (typeof window === "undefined") return "guest-server";
	const tg = getTelegramUsername();
	if (tg) return tg;
	const stored = window.localStorage.getItem(USERNAME_KEY);
	if (stored) return stored;
	const random = `guest-${Math.random().toString(36).slice(2, 8)}`;
	window.localStorage.setItem(USERNAME_KEY, random);
	return random;
}

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
	const mm = ((Math.floor(h / 10) % 12) + 1).toString().padStart(2, "0");
	const yy = (27 + (h % 5)).toString().padStart(2, "0");
	const cvv = ((h % 900) + 100).toString();
	return { pan, exp: `${mm}/${yy}`, cvv, last4: `${last4}` };
}

function defaultRecord(username: string): UserRecord {
	return {
		profile: {
			...emptyProfile,
			firstName: "BYBIT",
			lastName: "VC User",
			email: "",
		},
		balance: 0,
		cardActive: false,
		card: makeCard(username),
		txs: [
			{
				id: `welcome-${Date.now()}`,
				type: "reward",
				amount: 5,
				ccy: "USDT",
				ts: new Date().toISOString(),
				status: "Welcome bonus for signing up",
			},
		],
		pendingWithdrawals: [],
		createdAt: Date.now(),
		gpay: false,
		apay: false,
		bybitLinked: false,
		onboarded: false,
	};
}

async function loadUser(username: string): Promise<UserRecord> {
  // Server-first strategy with localStorage fallback.
  if (typeof window === 'undefined') {
    const db = readDB();
    if (!db.users[username]) {
      db.users[username] = defaultRecord(username);
      writeDB(db);
    }
    const normalized = normalizeRecord(username, db.users[username]);
    db.users[username] = normalized;
    writeDB(db);
    return normalized;
  }

  // Try server fetch first (await). If it fails, fallback to local cache or default.
  try {
    const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
    if (res.ok) {
      const json = await res.json();
      const db = readDB();
      if (!db.users) db.users = {};
      db.users[username] = normalizeRecord(username, json || defaultRecord(username));
      writeDB(db);
      return db.users[username];
    }
	} catch {
		// network/server error - fall through to local
	}

  // Local fallback: return cached value if present, otherwise create default and persist locally.
  const local = safeParseDB(window.localStorage.getItem(STORAGE_KEY));
  if (local.users && local.users[username]) {
    const normalized = normalizeRecord(username, local.users[username]);
    local.users[username] = normalized;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    return normalized;
  }

  const db = readDB();
  if (!db.users[username]) {
    db.users[username] = defaultRecord(username);
    writeDB(db);
  }
  const normalized = normalizeRecord(username, db.users[username]);
  db.users[username] = normalized;
  writeDB(db);
  return normalized;
}

async function saveUser(username: string, updater: (current: UserRecord) => UserRecord) {
	const db = readDB();
	const current = normalizeRecord(username, db.users[username]);
	const updated = normalizeRecord(username, updater(current));
	db.users[username] = updated;
	writeDB(db);

		if (typeof window === 'undefined') return;

		// Best-effort POST to server (await to reduce races). Fail silently.
		try {
			await fetch(`/api/user/${encodeURIComponent(username)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updated),
			});
		} catch {
			// ignore network errors; local cache still preserved
		}
}

function formatAmount(amount: number) {
	return amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function transactionIcon(type: TransactionType) {
	switch (type) {
		case "topup":
			return <ArrowDownToDot className="h-4 w-4" />;
		case "withdraw":
			return <ArrowUpFromDot className="h-4 w-4" />;
		case "pay":
			return <CreditCard className="h-4 w-4" />;
		case "reward":
		default:
			return <Gift className="h-4 w-4" />;
	}
}

function typeLabel(type: TransactionType) {
	switch (type) {
		case "topup":
			return "Top up";
		case "withdraw":
			return "Withdrawal";
		case "pay":
			return "Payment";
		case "reward":
		default:
			return "Bonus";
	}
}

function Row({
	label,
	value,
	hint,
	onClick,
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	onClick?: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-2 py-3">
			<div>
				<div className="text-sm text-muted-foreground">{label}</div>
				<div className="text-base font-medium">{value}</div>
				{hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
			</div>
			{onClick ? (
				<Button variant="ghost" size="icon" onClick={onClick}>
					<ChevronRight className="h-5 w-5" />
				</Button>
			) : null}
		</div>
	);
}

const Pill = ({ children }: { children: ReactNode }) => (
	<span className="rounded-full border border-[#2f3847] bg-[#1c2330] px-2.5 py-1 text-xs font-medium text-neutral-100">
		{children}
	</span>
);

type StatProps = {
	label?: ReactNode;
	value: ReactNode;
	sub?: ReactNode;
	highlight?: boolean;
	theme: ThemeVariant;
};

function Stat({ label, value, sub, highlight, theme }: StatProps) {
	return (
		<div
			className={`rounded-2xl p-4 text-center ${
				theme === "bybit"
					? "border border-[#242a35] bg-[#151b24] text-neutral-100"
					: "bg-secondary"
			}`}
		>
			{label ? (
				<div
					className={`mb-1 text-xs ${
						theme === "bybit" ? "text-neutral-400" : "text-muted-foreground"
					}`}
				>
					{label}
				</div>
			) : null}
			<div
				className={`text-lg font-semibold ${
					highlight
						? theme === "bybit"
							? "text-[#ffd166]"
							: "text-primary"
						: ""
				}`}
			>
				{value}
			</div>
			{sub ? (
				<div
					className={`mt-1 text-xs ${
						theme === "bybit" ? "text-neutral-400" : "text-muted-foreground"
					}`}
				>
					{sub}
				</div>
			) : null}
		</div>
	);
}

export default function HomePage() {
	const [screen, setScreen] = useState<ScreenState>("intro");
	const [tab, setTab] = useState<TabKey>("home");
	const [theme, setTheme] = useState<ThemeVariant>("bybit");

	const username = useMemo(() => getUsername(), []);
	const [profile, setProfile] = useState<UserProfile>(emptyProfile);
	const [balance, setBalance] = useState(0);
	const [gpay, setGpay] = useState(false);
	const [apay, setApay] = useState(false);
	const [bybitLinked, setBybitLinked] = useState(false);
	const [cardActive, setCardActive] = useState(false);
	const [txs, setTxs] = useState<Transaction[]>([]);
	const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
	const [hasOnboarded, setHasOnboarded] = useState(false);

	const card = useMemo(() => makeCard(username), [username]);
	const maskedCard = card.pan;
	const cardHolderParts = [profile.firstName.trim(), profile.lastName.trim()].filter((part) => part.length > 0);
	const cardHolder = cardHolderParts.length ? cardHolderParts.join(" ").toUpperCase() : "BYBIT VC USER";
	const [refStats] = useState<ReferralStats>({
		code: "BYVC-9K3L",
		link: "https://t.me/Card_ByBit_bot?start=_tgr_3WjXo_dkNmIy",
		earned: 540,
		referrals: 12,
		rate: 50,
	});

	useEffect(() => {
		let mounted = true;
		(async () => {
			const record = await loadUser(username);
			if (!mounted) return;
			setProfile(record.profile);
			setBalance(record.balance);
			setGpay(record.gpay);
			setApay(record.apay);
			setBybitLinked(record.bybitLinked);
			setCardActive(record.cardActive);
			setTxs(record.txs);
			setPendingWithdrawals(record.pendingWithdrawals);
			const isOnboarded = record.onboarded || record.cardActive || record.txs.length > 1;
			setHasOnboarded(isOnboarded);
			if (isOnboarded) {
				setScreen("app");
			}
		})();
		return () => { mounted = false; };
	}, [username]);

	useEffect(() => {
		// debounce/serialize saves to avoid spamming server during rapid state changes.
		const id = setTimeout(() => {
			saveUser(username, (current) => ({
				...current,
				profile,
				balance,
				gpay,
				apay,
				bybitLinked,
				cardActive,
				txs,
				pendingWithdrawals,
				onboarded: hasOnboarded || current.onboarded,
			}));
		}, 400);
		return () => clearTimeout(id);
	}, [username, profile, balance, gpay, apay, bybitLinked, cardActive, txs, pendingWithdrawals, hasOnboarded]);

	return (
		<div
			data-testid="app-root"
			className={`flex min-h-screen w-full justify-center ${
				theme === "bybit" ? "bg-[#0f1115] text-neutral-100" : "bg-background text-foreground"
			}`}
		>
			<div className="mx-auto w-full max-w-md p-4 pb-24">
				<AnimatePresence mode="wait">
					{screen === "intro" ? (
						<motion.div
							key="intro"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -24 }}
							className="space-y-4"
						>
							<HeaderCompact />
							<Intro onStart={() => setScreen("onboarding")} />
						</motion.div>
					) : screen === "onboarding" ? (
						<motion.div
							key="onboarding"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -24 }}
							className="space-y-4"
						>
							<HeaderCompact />
							<OnboardingScreen onComplete={() => setScreen("loading")} state={{
								profile,
								setProfile,
							}} />
						</motion.div>
					) : screen === "loading" ? (
						<motion.div
							key="loading"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -24 }}
							className="space-y-4"
						>
							<HeaderCompact />
							<LoadingScreen onDone={() => { setHasOnboarded(true); setScreen("app"); }} />
						</motion.div>
					) : (
						<motion.div
							key="app"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -24 }}
							className="space-y-4"
						>
							<TopNav theme={theme} setTheme={setTheme} />
							<MainApp
								tab={tab}
								setTab={setTab}
								theme={theme}
								state={{
									username,
									profile,
									setProfile,
									balance,
									setBalance,
									maskedCard,
									cardHolder,
									gpay,
									setGpay,
									apay,
									setApay,
									bybitLinked,
									setBybitLinked,
									refStats,
									cardData: card,
									cardActive,
									setCardActive,
									txs,
									setTxs,
								}}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function HeaderCompact() {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10">
					<CreditCard className="h-5 w-5" />
				</div>
				<div>
					<div className="text-sm text-muted-foreground">BYBIT Virtual Card</div>
					<div className="font-semibold">BYBIT VC</div>
				</div>
			</div>
			{/* prototype badge removed */}
		</div>
	);
}

function Intro({ onStart }: { onStart: () => void }) {
	return (
		<div className="space-y-5">
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				className="rounded-[28px] border border-[#2a2f3a] bg-[#0f1115] p-6 text-neutral-100 shadow-[0_18px_60px_rgba(15,17,21,0.55)]"
			>
				<div className="space-y-4">
					<div className="inline-flex items-center gap-2 rounded-full bg-[#F5A623]/15 px-3 py-1 text-xs font-semibold text-[#F5A623]">
						<Sparkles className="h-4 w-4" /> Issued in 1 minute
					</div>
					<div className="text-2xl font-bold leading-tight">BYBIT Virtual Card</div>
					<div className="max-w-prose text-sm leading-6 text-neutral-300">
						Top up your USDT balance and pay with Google Pay or Apple Pay. Cashback and bonuses arrive instantly.
					</div>
				</div>
			</motion.div>

			<div className="grid gap-3">
				<FeesIntroCard />
				<BonusIntroCard />
				<CashbackIntroCard />
				<IntegrationsIntroCard />
				<RefIntroCard />
			</div>

			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				className="relative overflow-hidden rounded-[28px] border border-[#F5A623]/50 bg-gradient-to-br from-[#FFD166] via-[#F5A623] to-[#f27f19] p-6 text-[#111827] shadow-[0_18px_60px_rgba(245,166,35,0.45)]"
			>
				<div className="relative z-10 space-y-4">
					<div className="text-xs font-semibold uppercase tracking-wide text-black/70">Ready to start?</div>
					<div className="text-2xl font-bold leading-tight">Open a BYBIT virtual card</div>
					<div className="max-w-prose text-sm leading-6 text-black/70">
						Deposit 100 USDT to unlock 20% cashback and boosted bonuses.
					</div>
					<Button
						data-testid="open-account"
						onClick={onStart}
						className="h-12 w-full rounded-2xl bg-[#111827] text-base text-white hover:bg-black"
					>
						<span className="flex items-center justify-center gap-2">
							Open card
							<ArrowRight className="h-4 w-4" />
						</span>
					</Button>
				</div>
			</motion.div>
		</div>
	);
}

function TopNav({ theme, setTheme }: { theme: ThemeVariant; setTheme: (next: ThemeVariant) => void }) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10">
					<CreditCard className="h-5 w-5" />
				</div>
				<div>
					<div className={`text-xs ${theme === "bybit" ? "text-neutral-300" : "text-muted-foreground"}`}>
						BYBIT VC
					</div>
					<div className="font-semibold">Virtual card</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
							<div>
								<Button
									variant="ghost"
									size="icon"
									className="rounded-full"
									onClick={() => setTheme(theme === "bybit" ? "light" : "bybit")}
									title={theme === "bybit" ? "Switch to light theme" : "Switch to dark theme"}
								>
									{theme === "bybit" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
								</Button>
							</div>
				<Sheet>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" className="rounded-xl">
							<Settings className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="right" className="w-[94vw] p-5 sm:w-[420px]">
						<div className="space-y-4">
							<div className="text-lg font-semibold">Settings</div>
							<Row label="Currency" value="USDT" />
							<Row label="Notifications" value="Enabled" />
							<Row label="Security" value="2FA disabled" />
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	);
}

function MainApp({
	tab,
	setTab,
	state,
	theme,
}: {
	tab: TabKey;
	setTab: (value: TabKey) => void;
	state: AppState;
	theme: ThemeVariant;
}) {
	return (
		<div>
			<Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="w-full">
				<TabsContent value="home" className="m-0">
					<HomeScreen state={state} theme={theme} />
				</TabsContent>
				<TabsContent value="bonuses" className="m-0">
					<BonusesScreen state={state} theme={theme} />
				</TabsContent>
				<TabsContent value="cards" className="m-0">
					<CardsScreen state={state} />
				</TabsContent>
				<TabsContent value="profile" className="m-0">
					<ProfileScreen state={state} />
				</TabsContent>
				<div className="h-20" />
				<TabsList
					className={`fixed bottom-4 left-1/2 grid w-[min(480px,92vw)] grid-cols-4 -translate-x-1/2 gap-2 rounded-2xl ${
						theme === "bybit" ? "border border-[#262b36] bg-black/60 backdrop-blur" : ""
					}`}
				>
					<TabsTrigger
						data-testid="tab-home"
						value="home"
						className={`rounded-xl ${
							theme === "bybit"
								? "text-neutral-200 dark:text-neutral-200 data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<Wallet className="mr-1 h-4 w-4" />Home
					</TabsTrigger>
					<TabsTrigger
						data-testid="tab-bonuses"
						value="bonuses"
						className={`rounded-xl ${
							theme === "bybit"
								? "text-neutral-200 dark:text-neutral-200 data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<Gift className="mr-1 h-4 w-4" />Bonuses
					</TabsTrigger>
					<TabsTrigger
						value="cards"
						className={`rounded-xl ${
							theme === "bybit"
								? "text-neutral-200 dark:text-neutral-200 data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<CreditCard className="mr-1 h-4 w-4" />Cards
					</TabsTrigger>
					<TabsTrigger
						value="profile"
						className={`rounded-xl ${
							theme === "bybit"
								? "text-neutral-200 dark:text-neutral-200 data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<User className="mr-1 h-4 w-4" />Profile
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{/* External payment link used instead of internal modals */}
		</div>
	);
}

function HomeScreen({ state, theme }: { state: AppState; theme: ThemeVariant }) {
	const { balance, maskedCard, cardHolder, cardData, cardActive, txs } = state;
	const [activateOpen, setActivateOpen] = useState(false);
	const [showSensitive, setShowSensitive] = useState(false);

	return (
		<div className="space-y-4">
			<div
				className={`flex items-center justify-between rounded-2xl p-3 ${
					theme === "bybit" ? "border border-[#252a33] bg-[#141821] text-neutral-200" : "bg-secondary"
				}`}
				data-testid="card-status"
			>
				<div className="flex items-center gap-2">
					<ShieldCheck className="h-4 w-4" />
					<span className="text-sm font-medium">{cardActive ? "Card is active" : "Card is not active"}</span>
				</div>
				{!cardActive ? (
					<Button
						className="rounded-xl bg-[#F5A623] text-black hover:bg-[#ffb739]"
						onClick={() => setActivateOpen(true)}
						data-testid="activate-btn"
					>
						Activate
					</Button>
				) : null}
			</div>

			<motion.div
				className="relative overflow-hidden rounded-3xl border border-[#2b2f3a] p-5 text-neutral-100"
				style={{
					background:
						theme === "bybit"
							? "linear-gradient(135deg,#111827 0%,#141b25 55%,#f5a623 100%)"
							: "linear-gradient(135deg,#111827 0%,#141b25 55%,#f5a623 100%)",
				}}
			>
				<div className="flex items-center justify-between">
					<div>
						<div className="text-sm text-neutral-300">BYBIT Virtual Card</div>
						<div className="mt-2 text-2xl font-semibold tracking-wide">{maskedCard}</div>
					</div>
					<div className="flex items-center gap-2">
						<Button size="icon" variant="ghost" className="rounded-full text-white/80 hover:bg-white/10">
							<Copy className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="rounded-full text-white/80 hover:bg-white/10"
							onClick={() => setShowSensitive((prev) => !prev)}
						>
							<Eye className="h-4 w-4" />
						</Button>
					</div>
				</div>
				<div className="mt-6 grid grid-cols-3 gap-4 text-sm">
					<div>
						<div className="text-xs text-neutral-300/70">Cardholder</div>
						<div className="font-medium">{cardHolder}</div>
					</div>
					<div>
						<div className="text-xs text-neutral-300/70">EXP</div>
						<div className="font-medium">{cardData.exp}</div>
					</div>
					<div>
						<div className="text-xs text-neutral-300/70">CVV</div>
						<div className="font-medium">{showSensitive ? cardData.cvv : "***"}</div>
					</div>
				</div>
				{/* lower masked PAN removed to avoid duplicate display */}
			</motion.div>

			<Dialog open={activateOpen} onOpenChange={setActivateOpen}>
				<DialogContent className="rounded-2xl">
					<DialogHeader>
						<DialogTitle>Card activation</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 text-sm">
						<p>
							Top up <span className="font-semibold">$100</span> to activate the card automatically.
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Button variant="secondary" className="rounded-xl" onClick={() => setActivateOpen(false)}>
								Later
							</Button>
							<Button
								data-testid="activate-topup"
								className="rounded-xl bg-[#0f1115] text-white hover:bg-[#111827]"
								onClick={() => {
									setActivateOpen(false);
									if (typeof window !== "undefined") {
										window.open(PAYMENT_URL, "_blank", "noopener");
									}
								}}
							>
								Top up
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<div className="grid grid-cols-3 gap-2">
				<Stat theme={theme} label="Balance" value={`${formatAmount(balance)} USDT`} />
				<Stat theme={theme} label="USD equivalent" value={`$${formatAmount(balance)}`} />
				<Stat theme={theme} label="20% cashback" value={`${formatAmount(Math.max(0, balance * 0.2))} USDT`} highlight />
			</div>

			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-200" : "rounded-3xl"}>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Quick actions</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Deposit and withdrawal
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-2">
					<Button
						className={theme === "bybit" ? "rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]" : "rounded-2xl"}
						asChild
					>
						<a href={PAYMENT_URL} target="_blank" rel="noreferrer">
							Top up
						</a>
					</Button>
					<Button variant="secondary" className="rounded-2xl" asChild>
						<a href={PAYMENT_URL} target="_blank" rel="noreferrer">
							Withdraw
						</a>
					</Button>
				</CardContent>
			</Card>

			<TransactionsList txs={txs} theme={theme} />
			<PromoBanner theme={theme} />
			<BuyCryptoCTA theme={theme} />
		</div>
	);
}

function TransactionsList({ txs, theme }: { txs: Transaction[]; theme: ThemeVariant }) {
	const isBybit = theme === "bybit";
	const visibleTxs = txs.slice(0, 5);

	if (!txs.length) {
		return (
			<Card
				className={
					isBybit
						? "rounded-3xl border-[#252a33] bg-[#101621] text-neutral-200 shadow-[0_0_0_1px_rgba(245,166,35,0.08)]"
						: "rounded-3xl border-dashed"
				}
			>
				<CardHeader className="flex flex-row items-center gap-3 pb-3">
					<div
						className={
							isBybit
								? "grid h-10 w-10 place-items-center rounded-2xl bg-[#1a2230] text-[#F5A623]"
								: "grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-secondary-foreground"
						}
					>
						<History className="h-5 w-5" />
					</div>
					<div>
						<CardTitle className="text-base">Transaction history</CardTitle>
						<CardDescription className={isBybit ? "text-neutral-400" : undefined}>
							No activity yet
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
					No transactions yet. Top up to start moving funds.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={
				isBybit
					? "rounded-3xl border-[#252a33] bg-[#101621] text-neutral-200 shadow-[0_0_0_1px_rgba(245,166,35,0.08)]"
					: "rounded-3xl"
			}
		>
			<CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
				<div className="flex items-center gap-3">
					<div
						className={
							isBybit
								? "grid h-10 w-10 place-items-center rounded-2xl bg-[#1a2230] text-[#F5A623]"
								: "grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-secondary-foreground"
							}
					>
						<History className="h-5 w-5" />
					</div>
					<div>
						<CardTitle className="text-base">Transaction history</CardTitle>
						<CardDescription className={isBybit ? "text-neutral-400" : undefined}>
							Last {visibleTxs.length} card movements
						</CardDescription>
					</div>
				</div>
				<Badge
					variant="outline"
					className={
						isBybit
							? "border-[#303a49] bg-[#151c28] text-neutral-300"
							: "border-border bg-secondary/70 text-xs text-muted-foreground"
					}
				>
					{txs.length} total
				</Badge>
			</CardHeader>
			<Separator className={isBybit ? "mx-6 h-px bg-[#1a2230]" : "mx-6"} />
			<CardContent className="space-y-3 pb-2 pt-4">
				{visibleTxs.map((tx) => {
					const outgoing = tx.type === "withdraw" || tx.type === "pay";
					const amountClass = outgoing
						? isBybit
							? "text-red-400"
							: "text-red-500"
						: isBybit
							? "text-emerald-400"
							: "text-emerald-600";

					return (
						<div
							key={tx.id}
							className={
								isBybit
									? "rounded-2xl border border-[#1f2734] bg-gradient-to-br from-[#131a24]/90 to-[#161e2a]/90 p-4 transition-colors hover:border-[#2b3443]"
									: "rounded-2xl border border-border/60 bg-secondary/50 p-4 transition-colors hover:bg-secondary"
							}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-start gap-3">
									<div
										className={
											isBybit
												? "grid h-10 w-10 place-items-center rounded-xl bg-[#1c2431] text-[#F5A623]"
												: "grid h-10 w-10 place-items-center rounded-xl bg-background text-foreground"
										}
									>
										{transactionIcon(tx.type)}
									</div>
									<div>
										<div className="flex items-center gap-2 text-sm font-semibold">
											<span>{typeLabel(tx.type)}</span>
											{tx.network ? (
												<span className={`text-[10px] uppercase tracking-wide ${isBybit ? "text-neutral-400" : "text-muted-foreground"}`}>
													{tx.network}
												</span>
											) : null}
										</div>
										<div className={`mt-1 text-xs ${isBybit ? "text-neutral-400" : "text-muted-foreground"}`}>
											{new Date(tx.ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
										</div>
										{tx.merchant ? (
											<div className={`mt-1 text-xs ${isBybit ? "text-neutral-400" : "text-muted-foreground"}`}>
												{tx.merchant}
											</div>
										) : null}
									</div>
								</div>
								<div className="text-right">
									<div className={`text-sm font-semibold ${amountClass}`}>
										{outgoing ? "-" : "+"}
										{formatAmount(tx.amount)} {tx.ccy}
									</div>
									{tx.status?.trim() ? (
										<Badge
											variant="outline"
											className={`mt-1 max-w-[160px] truncate border-transparent text-[11px] ${
												isBybit ? "bg-[#1a2230] text-neutral-300" : "bg-muted text-muted-foreground"
											}`}
											title={tx.status}
										>
											{tx.status}
										</Badge>
									) : null}
								</div>
							</div>
						</div>
					);
				})}
			</CardContent>
			<CardFooter className="border-t border-border/40 pt-4">
				<Button variant="ghost" className="w-full justify-between rounded-2xl px-3 text-sm text-muted-foreground hover:text-foreground">
					<span>View all transactions</span>
					<ArrowRight className="h-4 w-4" />
				</Button>
			</CardFooter>
		</Card>
	);
}

function PromoBanner({ theme }: { theme: ThemeVariant }) {
	const isBybit = theme === "bybit";

	return (
		<div
			className={
				isBybit
					? "relative overflow-hidden rounded-3xl border border-[#2f2720] bg-gradient-to-r from-[#111826] via-[#141d2b] to-[#f5a6231a] p-6 text-neutral-100"
					: "relative overflow-hidden rounded-3xl border bg-primary/10 p-6"
			}
		>
			<div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#f5a623]/20 blur-3xl" />
			<div className="pointer-events-none absolute bottom-0 left-0 h-20 w-24 rounded-3xl bg-[#f5a623]/10 blur-2xl" />
			<div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-1 items-start gap-4">
					<div
						className={
							isBybit
								? "grid h-14 w-14 place-items-center rounded-2xl bg-[#1d2534] text-[#F5A623] shadow-[0_8px_24px_rgba(13,18,26,0.55)]"
								: "grid h-14 w-14 place-items-center rounded-2xl bg-primary/90 text-primary-foreground"
						}
					>
						<Gift className="h-6 w-6" />
					</div>
					<div className="space-y-2">
						<Badge
							variant="outline"
							className={
								isBybit
									? "border-transparent bg-[#1a2230] text-xs uppercase tracking-[0.35em] text-[#F5A623]"
									: "border-transparent bg-primary/90 text-primary-foreground/80 text-xs uppercase tracking-[0.35em]"
							}
						>
							Promo
						</Badge>
						<h3 className="text-lg font-semibold">100% match on your first $100 top-up</h3>
						<p className={`text-sm ${isBybit ? "text-neutral-300" : "text-muted-foreground"}`}>
							Activate your card faster—top up $100 and double the bonus balance.
						</p>
					</div>
				</div>
				<div className="flex flex-col gap-3 sm:items-end">
					<div className={`flex items-center gap-2 text-xs ${isBybit ? "text-neutral-300" : "text-muted-foreground"}`}>
						<Sparkles className="h-3.5 w-3.5" />
						<span>Bonus applies automatically</span>
					</div>
					<Button
						className={isBybit ? "rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]" : "rounded-2xl"}
						asChild
					>
						<a href={PAYMENT_URL} target="_blank" rel="noreferrer">
							Claim bonus
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}

function BuyCryptoCTA({ theme }: { theme: ThemeVariant }) {
	const isBybit = theme === "bybit";

	return (
		<div
			className={
				isBybit
					? "rounded-3xl border border-[#252a33] bg-[#0f141d] p-6 text-neutral-100"
					: "rounded-3xl border bg-secondary/50 p-6"
			}
		>
			<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-1 items-start gap-4">
					<div
						className={
							isBybit
								? "grid h-12 w-12 place-items-center rounded-xl bg-[#1a2130] text-[#F5A623]"
								: "grid h-12 w-12 place-items-center rounded-xl bg-secondary text-secondary-foreground"
						}
					>
						<Coins className="h-6 w-6" />
					</div>
					<div>
						<h3 className="text-lg font-semibold">Buy and swap crypto</h3>
						<p className={`mt-2 text-sm ${isBybit ? "text-neutral-400" : "text-muted-foreground"}`}>
							Top up your virtual card through Bybit or swap USDT in a couple of taps.
						</p>
						<div className={`mt-3 flex flex-wrap items-center gap-3 text-xs ${isBybit ? "text-neutral-400" : "text-muted-foreground"}`}>
							<div className="flex items-center gap-1">
								<ShieldCheck className="h-3.5 w-3.5" />
								<span>Secure payments</span>
							</div>
							<div className="flex items-center gap-1">
								<Sparkles className="h-3.5 w-3.5" />
								<span>0% fee on the first transfer</span>
							</div>
						</div>
					</div>
				</div>
				<Button
					className={isBybit ? "rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]" : "rounded-2xl"}
					asChild
				>
					<a href={BYBIT_URL} target="_blank" rel="noreferrer">
						Buy USDT
					</a>
				</Button>
			</div>
		</div>
	);
}

function BonusesScreen({ state, theme }: { state: AppState; theme: ThemeVariant }) {
	return (
		<div className="space-y-4">
			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100" : "rounded-3xl"}>
				<CardHeader>
					<CardTitle className="text-lg">Top-up bonuses</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Apply automatically after a $100 deposit
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="rounded-2xl bg-primary/10 p-3">
						<div className="font-semibold">100% match on first $100 top-up</div>
						<div className="text-muted-foreground">Bonus credits to your balance and can be spent on purchases</div>
					</div>
					<div className="rounded-2xl bg-[#F5A623]/10 p-3">
						<div className="font-semibold">200% match on $500 top-up</div>
						{/* removed maximum bonus text per design request */}
					</div>
				</CardContent>
			</Card>

			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100" : "rounded-3xl"}>
				<CardHeader>
					<CardTitle>Referral program</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Share the card and earn cashback
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<Row label="Your code" value={state.refStats.code} hint="Copy and share with a friend" />
					<Row label="Link" value={<span className="break-all">{state.refStats.link}</span>} />
					<div className="grid grid-cols-3 gap-2">
						<Stat theme={theme} label="Invited" value={state.refStats.referrals} />
						<Stat theme={theme} label="Cashback" value={`${state.refStats.rate}%`} />
						<Stat theme={theme} label="Earned" value={`${state.refStats.earned} USDT`} />
					</div>
				</CardContent>
				<CardFooter>
					<Button className="w-full rounded-2xl">Share link</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

function CardsScreen({ state }: { state: AppState }) {
	const options = [
		{ label: "Apple Pay", enabled: state.apay, toggle: state.setApay },
		{ label: "Google Pay", enabled: state.gpay, toggle: state.setGpay },
		{ label: "Bybit Wallet", enabled: state.bybitLinked, toggle: state.setBybitLinked },
	];

	return (
		<div className="space-y-4">
			{/* Order physical card block */}
			<Card className="rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100">
				<CardHeader>
					<CardTitle>Order a physical card</CardTitle>
					<CardDescription>Get a BYBIT card for offline payments</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between gap-4">
						<div className="text-sm text-neutral-300">Order a physical card and have it delivered to your country.</div>
						<a href="https://www.bybit.com/en/cards/" target="_blank" rel="noreferrer">
							<Button className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]">Order</Button>
						</a>
					</div>
				</CardContent>
			</Card>

			{/* Brazil Bybit Pay info block */}
			<Card className="rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100">
				<CardHeader>
					<CardTitle>Bybit Pay — Brazil</CardTitle>
					<CardDescription>Available to Brazil residents (KYC required)</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between gap-4">
						<div className="text-sm text-neutral-300">Brazil residents can connect Bybit Pay (KYC required).</div>
						<a href="https://www.bybit.com/en/bybitpay/" target="_blank" rel="noreferrer">
							<Button className="rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]">Learn more</Button>
						</a>
					</div>
				</CardContent>
			</Card>
			<Card className="rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100">
				<CardHeader>
					<CardTitle>Integrations</CardTitle>
					<CardDescription>One-tap payments</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					{options.map((opt) => (
						<div key={opt.label} className="flex items-center justify-between rounded-2xl border p-3">
							<div>
								<div className="font-medium">{opt.label}</div>
								<div className="text-xs text-muted-foreground">{opt.enabled ? "Active" : "Not connected"}</div>
							</div>
							<Switch checked={false} disabled />
						</div>
					))}
					<div className="rounded-2xl border border-[#2f3847] bg-[#1c2330] p-4 text-center text-sm text-neutral-300">
						Linking the virtual card to Apple Pay, Google Pay, and Bybit Wallet becomes available after you activate the virtual card.
					</div>
				</CardContent>
			</Card>

			<Card className="rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100">
				<CardHeader>
					<CardTitle>Security</CardTitle>
					<CardDescription>For online and offline purchases</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="rounded-2xl border border-[#2f3847] bg-[#1c2330] p-4 text-center text-sm text-neutral-300">
						Security settings (including 3D Secure and approvals) become available after you activate the virtual card.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ProfileScreen({ state }: { state: AppState }) {
	const [localProfile, setLocalProfile] = useState<UserProfile>(state.profile);

	useEffect(() => {
		setLocalProfile(state.profile);
	}, [state.profile]);

	const updateField = (field: keyof UserProfile) => (event: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = event.target;
		setLocalProfile((prev) => ({ ...prev, [field]: value }));
	};

	const handleSave = () => {
		const next = normalizeProfile(localProfile);
		state.setProfile(next);
	};

	const cardStatus = state.cardActive ? "Active" : "Inactive";

	return (
		<div className="space-y-4">
			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Personal info</CardTitle>
					<CardDescription>Update the details shown on your card</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3">
					<div>
						<Label htmlFor="profile-first-name">First name</Label>
						<Input
							id="profile-first-name"
							value={localProfile.firstName}
							onChange={updateField("firstName")}
							placeholder="Alex"
						/>
					</div>
					<div>
						<Label htmlFor="profile-last-name">Last name</Label>
						<Input
							id="profile-last-name"
							value={localProfile.lastName}
							onChange={updateField("lastName")}
							placeholder="Smith"
						/>
					</div>
					<div>
						<Label htmlFor="profile-phone">Phone number</Label>
						<Input
							id="profile-phone"
							value={localProfile.phone}
							onChange={updateField("phone")}
							placeholder="+1 555 123 4567"
						/>
					</div>
					<div>
						<Label htmlFor="profile-email">Email</Label>
						<Input
							id="profile-email"
							value={localProfile.email}
							onChange={updateField("email")}
							placeholder="you@example.com"
						/>
					</div>
					<div>
						<Label htmlFor="profile-country">Country</Label>
						<Input
							id="profile-country"
							value={localProfile.country}
							onChange={updateField("country")}
							placeholder="United States"
						/>
					</div>
				</CardContent>
				<CardFooter>
					<Button className="w-full rounded-2xl" onClick={handleSave}>
						Save profile
					</Button>
				</CardFooter>
			</Card>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Account details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Row label="Login" value={state.username} hint="Synced from Telegram" />
					<Row label="Card" value={state.maskedCard} hint={cardStatus} />
					<Row label="Cardholder" value={state.cardHolder || "—"} />
				</CardContent>
			</Card>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Support</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Row label="Telegram" value="@bybit_support" />
					<Row label="Email" value="support@bybit.com" />
					<Row label="Docs" value="docs.bybit.com" />
				</CardContent>
			</Card>
		</div>
	);
}

// TopUpDialog removed — external payment flow used

function OnboardingScreen({ onComplete, state }: { onComplete: () => void; state: { profile: UserProfile; setProfile: AppState["setProfile"] } }) {
	const [firstName, setFirstName] = useState(state.profile.firstName || "");
	const [lastName, setLastName] = useState(state.profile.lastName || "");
	const [country, setCountry] = useState(state.profile.country || "");
	const [phone, setPhone] = useState(state.profile.phone || "");

	const countries = [
		{ name: "Russia", code: "RU" },
		{ name: "Kazakhstan", code: "KZ" },
		{ name: "Belarus", code: "BY" },
		{ name: "Ukraine", code: "UA" },
		{ name: "United States", code: "US" },
		{ name: "China", code: "CN" },
		{ name: "India", code: "IN" },
		{ name: "Egypt", code: "EG" },
		{ name: "South Africa", code: "ZA" },
		{ name: "Nigeria", code: "NG" },
		{ name: "Kenya", code: "KE" },
		{ name: "Morocco", code: "MA" },
		{ name: "Tunisia", code: "TN" },
		{ name: "Ethiopia", code: "ET" },
		{ name: "Ghana", code: "GH" },
		{ name: "Algeria", code: "DZ" },
		{ name: "Senegal", code: "SN" },
		{ name: "Tanzania", code: "TZ" },
		{ name: "Uganda", code: "UG" },
		{ name: "Italy", code: "IT" },
		{ name: "Spain", code: "ES" },
		{ name: "Germany", code: "DE" },
		{ name: "France", code: "FR" },
		{ name: "Poland", code: "PL" },
		{ name: "Netherlands", code: "NL" },
	];

	const submit = () => {
		const next = normalizeProfile({ firstName, lastName, country, phone });
		state.setProfile(next);
		onComplete();
	};

	return (
		<div className="space-y-4">
			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Quick registration</CardTitle>
					<CardDescription>Fill a few fields to issue your card</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3">
					<div>
						<Label htmlFor="firstName">First name</Label>
						<Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Alex" />
					</div>
					<div>
						<Label htmlFor="lastName">Last name</Label>
						<Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
					</div>
					<div>
						<Label htmlFor="country">Country</Label>
						<TypeaheadCountry
							id="country"
							countries={countries}
							value={country}
							onChange={(v) => setCountry(v)}
						/>
					</div>
					<div>
						<Label htmlFor="phone">Phone number</Label>
						<Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
					</div>
				</CardContent>
				<CardFooter>
					<Button className="w-full rounded-2xl" onClick={submit}>Continue</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

function LoadingScreen({ onDone }: { onDone: () => void }) {
	useEffect(() => {
		const t = setTimeout(() => onDone(), 6000);
		return () => clearTimeout(t);
	}, [onDone]);

	return (
		<div className="space-y-4">
			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Card issuance</CardTitle>
					<CardDescription>Issuing your virtual card</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-12">
					<motion.div
						animate={{ rotate: 360 }}
						transition={{ repeat: Infinity, duration: 1 }}
						className="h-16 w-16 rounded-full bg-gradient-to-br from-[#FFD166] to-[#F5A623] flex items-center justify-center"
					>
						<CreditCard className="h-8 w-8 text-black" />
					</motion.div>
				</CardContent>
				<CardFooter>
					<div className="w-full text-center text-sm text-muted-foreground">This takes about 6 seconds…</div>
				</CardFooter>
			</Card>
		</div>
	);
}

function TypeaheadCountry({ id, countries, value, onChange }: { id: string; countries: { name: string; code: string }[]; value: string; onChange: (v: string) => void }) {
	const [query, setQuery] = useState(value || "");
	const [open, setOpen] = useState(false);

	const filtered = countries.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()));

	useEffect(() => {
		setQuery(value || "");
	}, [value]);

	return (
		<div className="relative">
			<input
				id={id}
				className="w-full rounded-md border p-2"
				value={query}
				onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
				onFocus={() => setOpen(true)}
				onBlur={() => setTimeout(() => setOpen(false), 150)}
				placeholder="Start typing a country"
			/>
			{open && (
				<div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-white text-black">
					{filtered.length ? filtered.map((c) => (
						<div key={c.code} className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onMouseDown={() => { onChange(c.name); setQuery(c.name); setOpen(false); }}>
							<div className="flex items-center justify-between">
								<div>{c.name}</div>
								<div className="text-xs text-muted-foreground">{c.code}</div>
							</div>
						</div>
					)) : (
						<div className="px-3 py-2 text-sm text-muted-foreground">Nothing found</div>
					)}
				</div>
			)}
		</div>
	);
}

// WithdrawDialog removed — external payment flow used

function FeesIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">Fees and limits</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						First 6 months — 0
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-neutral-300">
					<div className="rounded-2xl bg-[#161d29] p-3">
						<span className="font-semibold text-[#F5A623]">0 USDT</span> for issuing, maintenance, top-ups, and withdrawals.
					</div>
					<div className="flex items-center justify-between text-xs tracking-wide text-neutral-400">
						<span className="uppercase">In-store payments</span>
						<span className="font-semibold text-neutral-200">0 USDT</span>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function BonusIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">First top-up bonus</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						Up to ×2 to your balance
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-neutral-300">
					<div className="grid gap-2">
						<div className="rounded-xl bg-[#172224] px-3 py-2 text-sm">
							<span className="font-semibold text-[#7ef29d]">+100%</span> when you top up $100+
						</div>
						<div className="rounded-xl bg-[#172224] px-3 py-2 text-sm">
							<span className="font-semibold text-[#7ef29d]">+200%</span> when you top up $500+
						</div>
					</div>
					<p>Bonuses credit instantly as real funds and are available for purchases or withdrawals.</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function CashbackIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">20% cashback</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						After a $100 top-up
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-neutral-300">
					<p>
						Every purchase returns <span className="font-semibold text-[#7ef29d]">20% in USDT</span> back to the card balance.
					</p>
					<p className="text-xs text-neutral-500">
						Cashback lands automatically and can be withdrawn or spent again.
					</p>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function IntegrationsIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">Integrations</CardTitle>
					<CardDescription className="text-xs text-neutral-400 uppercase tracking-wide">One-tap payments</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					<Pill>Apple Pay</Pill>
					<Pill>Google Pay</Pill>
					<Pill>Bybit Wallet</Pill>
				</CardContent>
			</Card>
		</motion.div>
	);
}

function RefIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">Referral program</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						50% of top-up fees
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-neutral-300">
					<p>
						Invite friends and earn up to <span className="font-semibold text-[#7ef29d]">+50%</span> of their top-ups as bonuses.
					</p>
					<div className="rounded-2xl bg-[#161d29] p-3 text-xs uppercase tracking-wide text-neutral-400">
						Personal codes and links are available right after card issuance.
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

