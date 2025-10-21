"use client";

import React, {
	useEffect,
	useMemo,
	useState,
	type ChangeEvent,
	type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	ArrowDownToDot,
	ArrowRight,
	ArrowUpFromDot,
	ChevronRight,
	Copy,
	CreditCard,
	Eye,
	Gift,
	Link as LinkIcon,
	Settings,
	ShieldCheck,
	Sparkles,
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

type UserProfile = {
	name: string;
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
	topUpOpen: boolean;
	setTopUpOpen: React.Dispatch<React.SetStateAction<boolean>>;
	wdOpen: boolean;
	setWdOpen: React.Dispatch<React.SetStateAction<boolean>>;
	refStats: ReferralStats;
	setScreen: React.Dispatch<React.SetStateAction<"intro" | "app">>;
	network: string;
	setNetwork: React.Dispatch<React.SetStateAction<string>>;
	amount: number;
	setAmount: React.Dispatch<React.SetStateAction<number>>;
	destination: string;
	setDestination: React.Dispatch<React.SetStateAction<string>>;
	cardData: CardData;
	cardActive: boolean;
	setCardActive: React.Dispatch<React.SetStateAction<boolean>>;
	txs: Transaction[];
	setTxs: React.Dispatch<React.SetStateAction<Transaction[]>>;
	pendingWithdrawals: PendingWithdrawal[];
	setPendingWithdrawals: React.Dispatch<React.SetStateAction<PendingWithdrawal[]>>;
};

const STORAGE_KEY = "byvc.db";
const USERNAME_KEY = "byvc.dev.username";

const emptyProfile: UserProfile = { name: "", phone: "", email: "", country: "" };

const networks = [
	{ code: "TRC20", fee: 1, eta: "~3-5 мин" },
	{ code: "BEP20", fee: 0.8, eta: "~1-3 мин" },
	{ code: "ERC20", fee: 5, eta: "~5-10 мин" },
	{ code: "SOL", fee: 0.2, eta: "< 1 мин" },
] as const;

type DBShape = { users: Record<string, UserRecord> };

const emptyDB: DBShape = { users: {} };

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
		profile: { ...emptyProfile, name: "BYBIT VC User" },
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
				status: "Welcome bonus за регистрацию",
			},
		],
		pendingWithdrawals: [],
		createdAt: Date.now(),
		gpay: false,
		apay: false,
		bybitLinked: false,
	};
}

function loadUser(username: string): UserRecord {
	const db = readDB();
	if (!db.users[username]) {
		db.users[username] = defaultRecord(username);
		writeDB(db);
	}
	return db.users[username];
}

function saveUser(username: string, updater: (current: UserRecord) => UserRecord) {
	const db = readDB();
	const current = db.users[username] || defaultRecord(username);
	db.users[username] = updater(current);
	writeDB(db);
}

function formatAmount(amount: number) {
	return amount.toLocaleString("ru-RU", {
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
			return "Пополнение";
		case "withdraw":
			return "Вывод";
		case "pay":
			return "Оплата";
		case "reward":
		default:
			return "Бонус";
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
	const [screen, setScreen] = useState<"intro" | "app">("intro");
	const [tab, setTab] = useState<TabKey>("home");
	const [theme, setTheme] = useState<ThemeVariant>("bybit");
	const [topUpOpen, setTopUpOpen] = useState(false);
	const [wdOpen, setWdOpen] = useState(false);

	const username = useMemo(() => getUsername(), []);
	const [profile, setProfile] = useState<UserProfile>(emptyProfile);
	const [balance, setBalance] = useState(0);
	const [gpay, setGpay] = useState(false);
	const [apay, setApay] = useState(false);
	const [bybitLinked, setBybitLinked] = useState(false);
	const [network, setNetwork] = useState<string>(networks[0].code);
	const [amount, setAmount] = useState(100);
	const [destination, setDestination] = useState("");
	const [cardActive, setCardActive] = useState(false);
	const [txs, setTxs] = useState<Transaction[]>([]);
	const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);

	const card = useMemo(() => makeCard(username), [username]);
	const maskedCard = `**** **** **** ${card.last4}`;
	const cardHolder = profile.name ? profile.name.toUpperCase() : "BYBIT VC USER";
	const [refStats] = useState<ReferralStats>({
		code: "BYVC-9K3L",
		link: "https://bybit-vc.app/r/BYVC-9K3L",
		earned: 540,
		referrals: 12,
		rate: 50,
	});

	useEffect(() => {
		const record = loadUser(username);
		setProfile(record.profile);
		setBalance(record.balance);
		setGpay(record.gpay);
		setApay(record.apay);
		setBybitLinked(record.bybitLinked);
		setCardActive(record.cardActive);
		setTxs(record.txs);
		setPendingWithdrawals(record.pendingWithdrawals);
	}, [username]);

	useEffect(() => {
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
		}));
	}, [username, profile, balance, gpay, apay, bybitLinked, cardActive, txs, pendingWithdrawals]);

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
							<Intro onStart={() => setScreen("app")} />
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
									topUpOpen,
									setTopUpOpen,
									wdOpen,
									setWdOpen,
									refStats,
									setScreen,
									network,
									setNetwork,
									amount,
									setAmount,
									destination,
									setDestination,
									cardData: card,
									cardActive,
									setCardActive,
									txs,
									setTxs,
									pendingWithdrawals,
									setPendingWithdrawals,
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
			<Badge variant="outline" className="rounded-full">
				Prototype
			</Badge>
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
						<Sparkles className="h-4 w-4" /> Выпуск за 1 минуту
					</div>
					<div className="text-2xl font-bold leading-tight">Виртуальная карта BYBIT</div>
					<div className="max-w-prose text-sm leading-6 text-neutral-300">
						Пополните баланс в USDT и оплачивайте покупки через Google Pay и Apple Pay. Кэшбэк и бонусы начисляются мгновенно.
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
					<div className="text-xs font-semibold uppercase tracking-wide text-black/70">Готовы начать?</div>
					<div className="text-2xl font-bold leading-tight">Открой виртуальную карту BYBIT</div>
					<div className="max-w-prose text-sm leading-6 text-black/70">
						Пополните от 100 USDT и активируйте полный доступ к кэшбэку 20% и повышенным бонусам.
					</div>
					<Button
						data-testid="open-account"
						onClick={onStart}
						className="h-12 w-full rounded-2xl bg-[#111827] text-base text-white hover:bg-black"
					>
						<span className="flex items-center justify-center gap-2">
							Открыть карту
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
					<div className="font-semibold">Виртуальная карта</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<div className="flex rounded-full bg-secondary p-1">
					<Button
						size="sm"
						className={`rounded-full px-3 ${theme === "light" ? "" : "opacity-70"}`}
						variant={theme === "light" ? "default" : "ghost"}
						onClick={() => setTheme("light")}
					>
						День
					</Button>
					<Button
						size="sm"
						className={`rounded-full px-3 ${
							theme === "bybit" ? "bg-[#F5A623] text-black hover:bg-[#ffb739]" : "opacity-70"
						}`}
						variant={theme === "bybit" ? "default" : "ghost"}
						onClick={() => setTheme("bybit")}
					>
						Ночь
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
							<div className="text-lg font-semibold">Настройки</div>
							<Row label="Валюта" value="USDT" />
							<Row label="Уведомления" value="Включены" />
							<Row label="Безопасность" value="2FA активна" />
							<Separator />
							<div className="text-xs text-muted-foreground">
								Прототип. Реальные настройки появятся после подключения бэкенда.
							</div>
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
								? "data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<Wallet className="mr-1 h-4 w-4" />Главная
					</TabsTrigger>
					<TabsTrigger
						data-testid="tab-bonuses"
						value="bonuses"
						className={`rounded-xl ${
							theme === "bybit"
								? "data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<Gift className="mr-1 h-4 w-4" />Бонусы
					</TabsTrigger>
					<TabsTrigger
						value="cards"
						className={`rounded-xl ${
							theme === "bybit"
								? "data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<CreditCard className="mr-1 h-4 w-4" />Карты
					</TabsTrigger>
					<TabsTrigger
						value="profile"
						className={`rounded-xl ${
							theme === "bybit"
								? "data-[state=active]:border data-[state=active]:border-[#2a2f3a] data-[state=active]:bg-[#1b2029] data-[state=active]:text-[#F5A623] data-[state=active]:ring-1 data-[state=active]:ring-[#F5A623]/40"
								: ""
						}`}
					>
						<User className="mr-1 h-4 w-4" />Профиль
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<div className="mt-4 grid grid-cols-2 gap-3">
				<Button
					className="h-12 rounded-2xl bg-[#0f1115] text-white hover:bg-[#111827]"
					onClick={() => state.setTopUpOpen(true)}
				>
					<ArrowDownToDot className="mr-2 h-4 w-4" />Пополнить
				</Button>
				<Button
					className="h-12 rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]"
					onClick={() => state.setWdOpen(true)}
				>
					<ArrowUpFromDot className="mr-2 h-4 w-4" />Вывести
				</Button>
			</div>

			<TopUpDialog state={state} />
			<WithdrawDialog state={state} />
		</div>
	);
}

function HomeScreen({ state, theme }: { state: AppState; theme: ThemeVariant }) {
	const { balance, maskedCard, cardHolder, cardData, cardActive, setTopUpOpen, txs } = state;
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
					<span className="text-sm font-medium">{cardActive ? "Карта активна" : "Карта не активна"}</span>
				</div>
				{!cardActive ? (
					<Button
						className="rounded-xl bg-[#F5A623] text-black hover:bg-[#ffb739]"
						onClick={() => setActivateOpen(true)}
						data-testid="activate-btn"
					>
						Активировать
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
						<div className="text-xs text-neutral-300/70">Владелец</div>
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
				<div className="mt-4 rounded-2xl bg-white/10 p-3 text-xs text-white/80">
					<span className="font-mono text-base tracking-wide">{showSensitive ? cardData.pan : maskedCard}</span>
				</div>
			</motion.div>

			<Dialog open={activateOpen} onOpenChange={setActivateOpen}>
				<DialogContent className="rounded-2xl">
					<DialogHeader>
						<DialogTitle>Активация карты</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 text-sm">
						<p>
							Для активации карты пополните депозит на <span className="font-semibold">$100</span>. После этого карта станет активной автоматически.
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Button variant="secondary" className="rounded-xl" onClick={() => setActivateOpen(false)}>
								Позже
							</Button>
							<Button
								data-testid="activate-topup"
								className="rounded-xl bg-[#0f1115] text-white hover:bg-[#111827]"
								onClick={() => {
									setActivateOpen(false);
									setTopUpOpen(true);
								}}
							>
								Пополнить
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<div className="grid grid-cols-3 gap-2">
				<Stat theme={theme} label="Баланс" value={`${formatAmount(balance)} USDT`} />
				<Stat theme={theme} label="Эквивалент" value={`$${formatAmount(balance)}`} />
				<Stat theme={theme} label="Кэшбэк 20%" value={`${formatAmount(Math.max(0, balance * 0.2))} USDT`} highlight />
			</div>

			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-200" : "rounded-3xl"}>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Быстрые действия</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Пополнение и вывод
					</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-2">
					<Button
						onClick={() => setTopUpOpen(true)}
						className={theme === "bybit" ? "rounded-2xl bg-[#F5A623] text-black hover:bg-[#ffb739]" : "rounded-2xl"}
					>
						Пополнить
					</Button>
					<Button variant="secondary" onClick={() => state.setWdOpen(true)} className="rounded-2xl">
						Вывести
					</Button>
				</CardContent>
			</Card>

			<TransactionsList txs={txs} theme={theme} />
		</div>
	);
}

function TransactionsList({ txs, theme }: { txs: Transaction[]; theme: ThemeVariant }) {
	if (!txs.length) {
		return (
			<Card className="rounded-3xl border-dashed">
				<CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
					Нет операций. Пополните баланс, чтобы увидеть историю.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-200" : "rounded-3xl"}>
			<CardHeader className="pb-2">
				<CardTitle className="text-base">Последние операции</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{txs.slice(0, 5).map((tx) => (
					<div key={tx.id} className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary/40">
								{transactionIcon(tx.type)}
							</div>
							<div>
								<div className="text-sm font-medium">{typeLabel(tx.type)}</div>
								<div className="text-xs text-muted-foreground">{new Date(tx.ts).toLocaleString("ru-RU")}</div>
							</div>
						</div>
						<div className="text-right text-sm font-semibold">
							{tx.type === "withdraw" || tx.type === "pay" ? "-" : "+"}
							{formatAmount(tx.amount)} {tx.ccy}
						</div>
					</div>
				))}
			</CardContent>
			<CardFooter>
				<Button variant="ghost" className="w-full rounded-2xl">
					Смотреть все операции
				</Button>
			</CardFooter>
		</Card>
	);
}

function BonusesScreen({ state, theme }: { state: AppState; theme: ThemeVariant }) {
	return (
		<div className="space-y-4">
			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100" : "rounded-3xl"}>
				<CardHeader>
					<CardTitle className="text-lg">Бонусы за пополнение</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Активируются автоматически после пополнения от $100
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="rounded-2xl bg-primary/10 p-3">
						<div className="font-semibold">+100% к первому пополнению от $100</div>
						<div className="text-muted-foreground">Бонус начисляется на баланс и может быть потрачен на покупки</div>
					</div>
					<div className="rounded-2xl bg-[#F5A623]/10 p-3">
						<div className="font-semibold">+200% к пополнению от $500</div>
						<div className="text-muted-foreground">Максимум $1000 бонусных USDT</div>
					</div>
				</CardContent>
			</Card>

			<Card className={theme === "bybit" ? "rounded-3xl border-[#252a33] bg-[#141821] text-neutral-100" : "rounded-3xl"}>
				<CardHeader>
					<CardTitle>Реферальная программа</CardTitle>
					<CardDescription className={theme === "bybit" ? "text-neutral-400" : ""}>
						Делись картой и получай кэшбэк
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<Row label="Твой код" value={state.refStats.code} hint="Скопируй и отправь другу" />
					<Row label="Ссылка" value={<span className="break-all">{state.refStats.link}</span>} />
					<div className="grid grid-cols-3 gap-2">
						<Stat theme={theme} label="Приглашено" value={state.refStats.referrals} />
						<Stat theme={theme} label="Кэшбэк" value={`${state.refStats.rate}%`} />
						<Stat theme={theme} label="Заработано" value={`${state.refStats.earned} USDT`} />
					</div>
				</CardContent>
				<CardFooter>
					<Button className="w-full rounded-2xl">Поделиться ссылкой</Button>
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
			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Интеграции</CardTitle>
					<CardDescription>Оплата в одно касание</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{options.map((opt) => (
						<div key={opt.label} className="flex items-center justify-between rounded-2xl border p-3">
							<div>
								<div className="font-medium">{opt.label}</div>
								<div className="text-xs text-muted-foreground">{opt.enabled ? "Активно" : "Не подключено"}</div>
							</div>
							<Switch checked={opt.enabled} onCheckedChange={opt.toggle} />
						</div>
					))}
				</CardContent>
			</Card>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Безопасность</CardTitle>
					<CardDescription>Для онлайн и офлайн покупок</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex items-start gap-3 rounded-2xl bg-secondary/50 p-3">
						<AlertTriangle className="mt-1 h-5 w-5 text-amber-500" />
						<div>
							<div className="font-semibold">Включите 3D-Secure</div>
							<div className="text-muted-foreground">Добавьте карту в приложение Bybit и активируйте подтверждения по SMS/Email.</div>
						</div>
					</div>
					<Button variant="secondary" className="w-full rounded-2xl">
						Настроить безопасность
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

function ProfileScreen({ state }: { state: AppState }) {
	const [localProfile, setLocalProfile] = useState(state.profile);

	useEffect(() => {
		setLocalProfile(state.profile);
	}, [state.profile]);

	const updateField = (key: keyof UserProfile) =>
		(event: ChangeEvent<HTMLInputElement>) =>
			setLocalProfile((prev) => ({ ...prev, [key]: event.target.value }));

	const handleSave = () => {
		state.setProfile(localProfile);
	};

	return (
		<div className="space-y-4">
			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Профиль</CardTitle>
					<CardDescription>Заполни данные, чтобы быстрее пройти KYC</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3">
					<div>
						<Label htmlFor="name">Имя</Label>
						<Input id="name" value={localProfile.name} onChange={updateField("name")} placeholder="Иван Иванов" />
					</div>
					<div>
						<Label htmlFor="phone">Телефон</Label>
						<Input id="phone" value={localProfile.phone} onChange={updateField("phone")} placeholder="+7" />
					</div>
					<div>
						<Label htmlFor="email">Email</Label>
						<Input id="email" value={localProfile.email} onChange={updateField("email")} placeholder="you@example.com" />
					</div>
					<div>
						<Label htmlFor="country">Страна</Label>
						<Input id="country" value={localProfile.country} onChange={updateField("country")} placeholder="Россия" />
					</div>
				</CardContent>
				<CardFooter>
					<Button className="w-full rounded-2xl" onClick={handleSave}>
						Сохранить профиль
					</Button>
				</CardFooter>
			</Card>

			<Card className="rounded-3xl">
				<CardHeader>
					<CardTitle>Поддержка</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Row label="Телеграм" value="@bybit_support" />
					<Row label="Email" value="support@bybit.com" />
					<Row label="Документация" value={<span className="flex items-center gap-1">docs.bybit.com<LinkIcon className="h-4 w-4" /></span>} />
				</CardContent>
			</Card>
		</div>
	);
}

function TopUpDialog({ state }: { state: AppState }) {
	const { topUpOpen, setTopUpOpen, amount, setAmount, network, setNetwork, setBalance, setTxs } = state;

	const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
		setAmount(Number(event.target.value || 0));
	};

	const submitTopUp = () => {
		if (amount <= 0) return;
		const net = networks.find((n) => n.code === network) ?? networks[0];
		const fee = net.fee;
		const credited = Math.max(0, amount - fee);
		setBalance((prev) => prev + credited);
		setTxs((prev) => [
			{
				id: `topup-${Date.now()}`,
				type: "topup",
				amount: credited,
				ccy: "USDT",
				ts: new Date().toISOString(),
				status: `Пополнение через ${net.code}. Комиссия ${fee} USDT`,
				network: net.code,
			},
			...prev,
		]);
		setTopUpOpen(false);
	};

	return (
		<Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
			<DialogContent className="rounded-2xl">
				<DialogHeader>
					<DialogTitle>Пополнить карту</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 text-sm">
					<div>
						<Label htmlFor="amount">Сумма (USDT)</Label>
						<Input id="amount" type="number" min={0} value={amount} onChange={handleAmountChange} />
					</div>
					<div>
						<Label>Сеть перевода</Label>
						<div className="mt-2 grid grid-cols-2 gap-2">
							{networks.map((net) => (
								<Button
									key={net.code}
									variant={net.code === network ? "default" : "outline"}
									className="rounded-xl"
									onClick={() => setNetwork(net.code)}
								>
									<div className="flex flex-col text-left">
										<span className="font-semibold">{net.code}</span>
										<span className="text-xs text-muted-foreground">Комиссия {net.fee} • {net.eta}</span>
									</div>
								</Button>
							))}
						</div>
					</div>
					<Button className="w-full rounded-xl" onClick={submitTopUp}>
						Перейти к пополнению
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function WithdrawDialog({ state }: { state: AppState }) {
	const { wdOpen, setWdOpen, setPendingWithdrawals, setBalance, amount, setAmount } = state;

	const handleSubmit = () => {
		if (amount <= 0) return;
		setBalance((prev) => Math.max(0, prev - amount));
		setPendingWithdrawals((prev) => [
			{
				id: `wd-${Date.now()}`,
				amount,
				ccy: "USDT",
				ts: new Date().toISOString(),
				status: "В обработке",
			},
			...prev,
		]);
		setWdOpen(false);
	};

	return (
		<Dialog open={wdOpen} onOpenChange={setWdOpen}>
			<DialogContent className="rounded-2xl">
				<DialogHeader>
					<DialogTitle>Вывести средства</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 text-sm">
					<div>
						<Label htmlFor="wd-amount">Сумма (USDT)</Label>
						<Input id="wd-amount" type="number" min={0} value={amount} onChange={(event) => setAmount(Number(event.target.value || 0))} />
					</div>
					<div>
						<Label htmlFor="wd-dest">Кошелек для вывода</Label>
						<Input id="wd-dest" placeholder="TRC20 адрес" onChange={(event) => state.setDestination(event.target.value)} />
					</div>
					<Button className="w-full rounded-xl" onClick={handleSubmit}>
						Отправить заявку
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function FeesIntroCard() {
	return (
		<motion.div whileHover={{ y: -2 }}>
			<Card className="rounded-3xl border border-[#2a2f3a] bg-[#111827] text-neutral-200">
				<CardHeader className="pb-2">
					<CardTitle className="text-base text-white">Комиссии и лимиты</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						Первые 6 месяцев — 0
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-neutral-300">
					<div className="rounded-2xl bg-[#161d29] p-3">
						<span className="font-semibold text-[#F5A623]">0 USDT</span> на выпуск, обслуживание, пополнение и выводы.
					</div>
					<div className="flex items-center justify-between text-xs tracking-wide text-neutral-400">
						<span className="uppercase">Оплата в магазинах</span>
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
					<CardTitle className="text-base text-white">Бонус за первое пополнение</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						До ×2 на баланс
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm text-neutral-300">
					<div className="grid gap-2">
						<div className="rounded-xl bg-[#172224] px-3 py-2 text-sm">
							<span className="font-semibold text-[#7ef29d]">+100%</span> при пополнении от $100
						</div>
						<div className="rounded-xl bg-[#172224] px-3 py-2 text-sm">
							<span className="font-semibold text-[#7ef29d]">+200%</span> при пополнении от $500
						</div>
					</div>
					<p>Бонусы начисляются мгновенно и доступны для оплаты любых покупок.</p>
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
					<CardTitle className="text-base text-white">Кэшбэк 20%</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						После пополнения от $100
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-neutral-300">
					<p>
						Каждая покупка возвращает <span className="font-semibold text-[#7ef29d]">20% в USDT</span> на баланс карты.
					</p>
					<p className="text-xs text-neutral-500">
						Кэшбэк приходит автоматически и может быть выведен или потрачен повторно.
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
					<CardTitle className="text-base text-white">Интеграции</CardTitle>
					<CardDescription className="text-xs text-neutral-400 uppercase tracking-wide">Оплата в одно касание</CardDescription>
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
					<CardTitle className="text-base text-white">Реферальная программа</CardTitle>
					<CardDescription className="text-xs font-semibold uppercase tracking-wide text-[#F5A623]">
						50% от комиссии пополнения
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-neutral-300">
					<p>
						Приглашай друзей и получай до <span className="font-semibold text-[#7ef29d]">+50%</span> от их пополнений в виде бонусов.
					</p>
					<div className="rounded-2xl bg-[#161d29] p-3 text-xs uppercase tracking-wide text-neutral-400">
						Персональные коды и ссылки доступны сразу после выпуска карты.
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

