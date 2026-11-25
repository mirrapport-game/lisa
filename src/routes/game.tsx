import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { CARD_MAP, RES_MAP, ROLES, RULES_TEXT, CHAIN_POINTS, type Role } from "@/game/data";
import * as E from "@/game/engine";
import type { Game, Player, TradeItem } from "@/game/engine";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "Игра «Бизнес-Мафия» — Бизнес-колода" },
      { name: "description", content: "Настольная игра для 6–12 игроков на одном устройстве: собирайте бизнес-цепочки и вычисляйте рейдеров." },
      { property: "og:title", content: "Бизнес-Мафия: Обмен и Цепочки" },
      { property: "og:description", content: "Собирайте бизнес-цепочки днём, ловите рейдеров ночью." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const KEY = "biz-mafia-v1";

/* ---------- UI primitives ---------- */
type BV = "primary" | "ghost" | "danger" | "amber";
const bv: Record<BV, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
  danger: "bg-raider text-destructive-foreground hover:opacity-90",
  amber: "bg-accent text-accent-foreground hover:opacity-90",
};
function Btn({ v = "primary", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { v?: BV }) {
  return <button {...p} className={`min-h-12 rounded-xl px-5 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${bv[v]} ${className}`} />;
}
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}
function Help({ text }: { text: string }) {
  const [o, setO] = useState(false);
  return (
    <span className="relative inline-block">
      <button onClick={() => setO(!o)} className="ml-2 h-7 w-7 rounded-full border border-border bg-secondary text-sm font-bold text-muted-foreground" aria-label="Правило">?</button>
      {o && <span onClick={() => setO(false)} className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-popover p-3 text-left text-sm font-normal text-popover-foreground shadow-xl">{text}</span>}
    </span>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-secondary text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function BizCard({ id, small, selected, onClick, badge }: { id: string; small?: boolean; selected?: boolean; onClick?: () => void; badge?: ReactNode }) {
  const c = CARD_MAP[id]!;
  return (
    <div onClick={onClick} className={`relative rounded-xl border-2 bg-secondary ${small ? "w-36 p-2 text-xs" : "w-44 p-3 text-sm"} ${selected ? "border-primary ring-2 ring-primary" : "border-border"} ${onClick ? "cursor-pointer hover:border-primary" : ""}`}>
      {badge && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{badge}</span>}
      {c.person && (
        <div className="mb-2 flex items-center gap-2">
          {c.photo ? <img src={c.photo} alt={c.person} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <Avatar name={c.person} />}
          <div className="min-w-0">
            <div className="truncate font-bold">{c.person}</div>
            {c.telegram && <a href={`https://t.me/${c.telegram}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary underline">@{c.telegram}</a>}
          </div>
        </div>
      )}
      <div className={`mb-2 font-extrabold ${small ? "text-sm" : "text-base"}`}>{c.name}</div>
      <div className="mb-1 rounded-md bg-gives/15 px-2 py-1 text-gives"><b>Даёт:</b> {c.gives} <span className="opacity-70">#{c.givesTag}</span></div>
      <div className="rounded-md bg-needs/15 px-2 py-1 text-needs"><b>Нужно:</b> {c.needs} <span className="opacity-70">#{c.needsTag}</span></div>
    </div>
  );
}
function ResPills({ res, onPick, picked }: { res: string[]; onPick?: (k: string) => void; picked?: string | undefined }) {
  const counts: Record<string, number> = {};
  res.forEach((r) => (counts[r] = (counts[r] ?? 0) + 1));
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(counts).map(([k, n]) => (
        <button key={k} disabled={!onPick} onClick={() => onPick?.(k)} className={`rounded-full border px-3 py-1 text-xs font-bold ${picked === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted"}`}>
          {RES_MAP[k]?.icon} {RES_MAP[k]?.name} ×{n}
        </button>
      ))}
      {!res.length && <span className="text-xs text-muted-foreground">нет ресурсов</span>}
    </div>
  );
}
const roleColor = (r: Role) => (r === "raider" ? "text-raider" : r === "civil" ? "text-primary" : "text-accent");
function Avatar({ name }: { name: string }) {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-extrabold text-primary">{name[0]?.toUpperCase()}</div>;
}
function Shell({ children, title, sub }: { children: ReactNode; title: string; sub?: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 font-sans">
      <header className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Бизнес-Мафия</div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <div className="mt-1 text-muted-foreground">{sub}</div>}
      </header>
      {children}
    </main>
  );
}
function Err({ msg }: { msg: string | null }) {
  return msg ? <div className="mt-3 rounded-xl border border-raider bg-raider/15 p-3 text-sm text-raider">{msg}</div> : null;
}

/* ---------- App ---------- */
function App() {
  const [g, setG] = useState<Game | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setG(JSON.parse(s)); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { if (g) localStorage.setItem(KEY, JSON.stringify(g)); else localStorage.removeItem(KEY); } }, [g, loaded]);
  if (!loaded) return <Shell title="Загрузка…"><div /></Shell>;
  if (!g || g.phase === "setup") return <Setup onStart={setG} />;
  const set = (n: Game) => setG(n);
  switch (g.phase) {
    case "reveal": return <Reveal g={g} set={set} />;
    case "day": return <Day g={g} set={set} setG={setG} />;
    case "vote": return <Vote g={g} set={set} />;
    case "voteResult": return <VoteResult g={g} set={set} />;
    case "night": return <Night g={g} set={set} />;
    case "nightResults": return <NightResults g={g} set={set} />;
    case "over": return <Over g={g} reset={() => setG(null)} />;
  }
}

/* ---------- Setup ---------- */
function Setup({ onStart }: { onStart: (g: Game) => void }) {
  const [n, setN] = useState(6);
  const [names, setNames] = useState<string[]>(Array.from({ length: 12 }, () => ""));
  const [broker, setBroker] = useState(false);
  const [tax, setTax] = useState(false);
  return (
    <Shell title="Обмен и Цепочки" sub="Настольная игра для 6–12 предпринимателей на одном устройстве">
      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <label className="font-bold">Игроков: <span className="text-primary">{n}</span> · рейдеров: <span className="text-raider">{E.raiderCount(n)}</span></label>
          <input type="range" min={6} max={12} value={n} onChange={(e) => setN(+e.target.value)} className="mt-3 w-full accent-primary" />
          <div className="mt-5 space-y-3">
            <Toggle checked={broker} onChange={setBroker} label="Бартер-маклер" hint={ROLES.broker.desc} />
            <Toggle checked={tax} onChange={setTax} label="Налоговая" hint={ROLES.tax.desc} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Btn onClick={() => onStart(E.newGame(names.slice(0, n), broker, tax))}>Начать игру</Btn>
            <Btn v="ghost" onClick={exportRules}>Экспорт правил в PDF</Btn>
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 font-bold">Имена игроков</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: n }, (_, i) => (
              <input key={i} value={names[i]} placeholder={`Игрок ${i + 1}`} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-12 rounded-xl border border-input bg-secondary px-4 outline-none focus:border-primary" />
            ))}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-accent" />
      <div><div className="font-bold text-accent">{label}</div><div className="text-sm text-muted-foreground">{hint}</div></div>
    </label>
  );
}
function exportRules() {
  const w = window.open("", "_blank");
  if (!w) return;
  const pts = Object.entries(CHAIN_POINTS).map(([k, v]) => `${k} карты — ${v}`).join(", ");
  w.document.write(`<html lang="ru"><head><title>Правила — Бизнес-Мафия</title><style>body{font-family:Manrope,Arial,sans-serif;max-width:720px;margin:40px auto;line-height:1.5}h1{margin-bottom:4px}li{margin:6px 0}</style></head><body>
  <h1>Бизнес-Мафия: Обмен и Цепочки</h1><p>Краткая инструкция</p><h2>Роли</h2><ul>${Object.values(ROLES).map((r) => `<li><b>${r.name}</b> — ${r.desc} ${r.goal}</li>`).join("")}</ul>
  <h2>Правила</h2><ol>${RULES_TEXT.map((t) => `<li>${t}</li>`).join("")}</ol><p><b>Очки цепочек:</b> ${pts}.</p>
  <h2>Ресурсы</h2><p>${Object.values(RES_MAP).map((r) => r.name).join(", ")}</p><script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

/* ---------- Reveal ---------- */
function Reveal({ g, set }: { g: Game; set: (g: Game) => void }) {
  const [open, setOpen] = useState(false);
  const p = g.players[g.revealIdx]!;
  const role = ROLES[p.role];
  const others = g.players.filter((x) => x.role === "raider" && x.id !== p.id);
  const next = () => {
    setOpen(false);
    setTimeout(() => set(g.revealIdx + 1 >= g.players.length ? { ...g, phase: "day" } : { ...g, revealIdx: g.revealIdx + 1 }), 350);
  };
  return (
    <Shell title="Раздача ролей" sub={`${g.revealIdx + 1} из ${g.players.length}`}>
      <div className="flip mx-auto h-[420px] max-w-sm">
        <div className={`flip-inner h-full ${open ? "flipped" : ""}`}>
          <button onClick={() => setOpen(true)} className="flip-face flex flex-col items-center justify-center rounded-3xl border-2 border-border bg-card p-6 text-center">
            <div className="text-5xl">🂠</div>
            <div className="mt-4 text-lg text-muted-foreground">Передайте устройство игроку</div>
            <div className="mt-1 text-3xl font-extrabold">{p.name}</div>
            <div className="mt-6 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Нажмите, чтобы увидеть роль</div>
          </button>
          <div className="flip-face flip-back flex flex-col justify-between rounded-3xl border-2 border-border bg-card p-6">
            <div>
              <div className="text-sm text-muted-foreground">{p.name}, твоя роль:</div>
              <div className={`mt-2 text-3xl font-extrabold ${roleColor(p.role)}`}>{role.name}</div>
              <p className="mt-4">{role.desc}</p>
              <p className="mt-2 font-bold">{role.goal}</p>
              {p.role === "raider" && <p className="mt-4 rounded-xl bg-raider/15 p-3 text-sm text-raider">Другие рейдеры: {others.map((o) => o.name).join(", ") || "ты один"}</p>}
            </div>
            <Btn onClick={next}>Скрыть и передать дальше</Btn>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- Day ---------- */
function PlayerRow({ p, children }: { p: Player; children?: ReactNode }) {
  const status = p.out ? "выбыл" : p.cards.length === 0 ? "банкрот" : "активен";
  return (
    <Panel className={p.out ? "opacity-50" : ""}>
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={p.name} />
        <div className="flex-1"><div className="font-extrabold">{p.name}</div><div className={`text-xs ${p.out ? "text-raider" : "text-muted-foreground"}`}>{status} · карт: {p.cards.length}</div></div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{p.cards.map((c) => <div key={c} className="shrink-0"><BizCard id={c} small /></div>)}</div>
      <ResPills res={p.resources} />
      {children}
    </Panel>
  );
}
function Day({ g, set, setG }: { g: Game; set: (g: Game) => void; setG: React.Dispatch<React.SetStateAction<Game | null>> }) {
  const [modal, setModal] = useState<"trade" | "chain" | null>(null);
  useEffect(() => {
    if (g.paused) return;
    const t = setInterval(() => setG((x) => (x && x.phase === "day" && !x.paused && x.timer > 0 ? { ...x, timer: x.timer - 1 } : x)), 1000);
    return () => clearInterval(t);
  }, [g.paused, setG]);
  const mm = String(Math.floor(g.timer / 60)).padStart(2, "0"), ss = String(g.timer % 60).padStart(2, "0");
  return (
    <Shell title={`День · раунд ${g.round}/3`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className={`rounded-xl bg-card px-4 py-2 font-mono text-2xl font-bold ${g.timer === 0 ? "text-raider" : ""}`}>{mm}:{ss}</div>
        <Btn v="ghost" onClick={() => set({ ...g, paused: !g.paused })}>{g.paused ? "▶ Продолжить" : "⏸ Пауза"}</Btn>
        <div className="flex-1" />
        <span className="flex items-center"><Btn onClick={() => setModal("trade")}>Обменять карты</Btn><Help text="Выберите двух игроков и по карте/ресурсу от каждого (можно и только от одного). Карты в цепочках не обмениваются." /></span>
        <span className="flex items-center"><Btn onClick={() => setModal("chain")}>Создать цепочку</Btn><Help text="2–5 карт по порядку: соседние должны быть связаны (одна даёт то, что нужно другой). Очки: 2=1, 3=3, 4=6, 5=10, +2 за 3+ игроков." /></span>
        <span className="flex items-center"><Btn v="amber" onClick={() => set({ ...g, phase: "vote", voteIdx: 0, votes: {} })}>Голосовать</Btn><Help text="Каждый активный игрок тайно голосует. Самый подозрительный раскрывает роль. Ничья — никто не выбывает." /></span>
      </div>
      <Chains g={g} />
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{g.players.map((p) => <PlayerRow key={p.id} p={p} />)}</div>
      {modal === "trade" && <TradeModal g={g} onClose={() => setModal(null)} onDone={(n) => { set(n); setModal(null); }} />}
      {modal === "chain" && <ChainModal g={g} onClose={() => setModal(null)} onDone={(n) => { set(n); setModal(null); }} />}
    </Shell>
  );
}
function Chains({ g }: { g: Game }) {
  return (
    <Panel>
      <div className="mb-3 font-extrabold">Цепочки <span className="text-muted-foreground">({g.chains.filter((c) => !c.destroyed).length} целых)</span></div>
      {!g.chains.length && <div className="text-sm text-muted-foreground">Пока нет цепочек.</div>}
      <div className="space-y-3">
        {g.chains.map((c) => (
          <div key={c.id} className={`rounded-xl border p-3 ${c.destroyed ? "border-raider/50 opacity-60" : "border-border"}`}>
            <div className="mb-2 text-sm font-bold">{c.destroyed ? <span className="text-raider">Разрушена · очки сгорели</span> : <span className="text-primary">+{c.points} очк.</span>}</div>
            <div className="flex gap-2 overflow-x-auto">{c.cardIds.map((id) => <div key={id} className="shrink-0"><BizCard id={id} small /></div>)}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function PlayerSelect({ g, value, onChange, exclude = [], label }: { g: Game; value: string; onChange: (v: string) => void; exclude?: string[]; label: string }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-input bg-secondary px-3">
        <option value="">— выберите —</option>
        {E.activePlayers(g).filter((p) => !exclude.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}
function ItemPicker({ p, item, setItem }: { p: Player; item: TradeItem; setItem: (i: TradeItem) => void }) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {p.cards.map((c) => <BizCard key={c} id={c} small selected={item?.type === "card" && item.value === c} onClick={() => setItem(item?.value === c ? null : { type: "card", value: c })} />)}
      </div>
      <div className="mt-2"><ResPills res={p.resources} picked={item?.type === "res" ? item.value : undefined} onPick={(k) => setItem(item?.value === k ? null : { type: "res", value: k })} /></div>
    </div>
  );
}
function TradeModal({ g, onClose, onDone }: { g: Game; onClose: () => void; onDone: (g: Game) => void }) {
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [ia, setIa] = useState<TradeItem>(null), [ib, setIb] = useState<TradeItem>(null);
  const [err, setErr] = useState<string | null>(null);
  const pa = g.players.find((p) => p.id === a), pb = g.players.find((p) => p.id === b);
  return (
    <Modal title="Обмен" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><PlayerSelect g={g} label="Игрок 1" value={a} onChange={(v) => { setA(v); setIa(null); }} exclude={[b]} />{pa && <ItemPicker p={pa} item={ia} setItem={setIa} />}</div>
        <div><PlayerSelect g={g} label="Игрок 2" value={b} onChange={(v) => { setB(v); setIb(null); }} exclude={[a]} />{pb && <ItemPicker p={pb} item={ib} setItem={setIb} />}</div>
      </div>
      <Err msg={err} />
      <Btn className="mt-4 w-full" disabled={!a || !b} onClick={() => { const r = E.trade(g, a, ia, b, ib); typeof r === "string" ? setErr(r) : onDone(r); }}>Подтвердить обмен</Btn>
    </Modal>
  );
}
function ChainModal({ g, onClose, onDone }: { g: Game; onClose: () => void; onDone: (g: Game) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => { setErr(null); setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 5 ? [...sel, id] : sel); };
  const v = sel.length >= 2 ? E.validateChain(sel) : null;
  const owners = sel.map((id) => g.players.find((p) => p.cards.includes(id))!.id);
  return (
    <Modal title="Создать цепочку" onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">Выбирайте карты по порядку цепочки (от 2 до 5).</p>
      {sel.length > 0 && (
        <div className="mb-4 rounded-xl bg-secondary p-3">
          <div className="flex flex-wrap items-center gap-2">{sel.map((id, i) => <span key={id} className="flex items-center gap-2">{i > 0 && <span className={E.linked(sel[i - 1]!, id) ? "text-gives" : "text-raider"}>→</span>}<b>{CARD_MAP[id]!.name}</b></span>)}</div>
          {sel.length >= 2 && (v ? <div className="mt-2 text-sm text-raider">{v}</div> : <div className="mt-2 text-sm text-gives">Валидно: +{E.chainPoints(sel, owners)} очк.</div>)}
        </div>
      )}
      <div className="space-y-4">
        {E.activePlayers(g).filter((p) => p.cards.length).map((p) => (
          <div key={p.id}><div className="mb-2 font-bold">{p.name}</div>
            <div className="flex flex-wrap gap-2">{p.cards.map((c) => <BizCard key={c} id={c} small selected={sel.includes(c)} badge={sel.includes(c) ? sel.indexOf(c) + 1 : undefined} onClick={() => toggle(c)} />)}</div>
          </div>
        ))}
      </div>
      <Err msg={err} />
      <Btn className="mt-4 w-full" disabled={sel.length < 2} onClick={() => { const r = E.createChain(g, sel); typeof r === "string" ? setErr(r) : onDone(r); }}>Выложить цепочку</Btn>
    </Modal>
  );
}

/* ---------- Voting ---------- */
function Vote({ g, set }: { g: Game; set: (g: Game) => void }) {
  const act = E.activePlayers(g);
  const voter = act[g.voteIdx]!;
  const [ready, setReady] = useState(false);
  const cast = (t: string) => {
    const votes = { ...g.votes, [voter.id]: t };
    setReady(false);
    const n = { ...g, votes, voteIdx: g.voteIdx + 1 };
    set(n.voteIdx >= act.length ? E.applyVote(n) : n);
  };
  return (
    <Shell title="Голосование" sub={`Голос ${g.voteIdx + 1} из ${act.length}`}>
      <Panel className="mx-auto max-w-lg text-center">
        {!ready ? (
          <><div className="text-muted-foreground">Передайте устройство</div><div className="my-3 text-3xl font-extrabold">{voter.name}</div><Btn onClick={() => setReady(true)}>Я готов голосовать</Btn></>
        ) : (
          <><div className="mb-4 text-xl font-bold">{voter.name}, за кого голосуешь?</div>
            <div className="grid gap-2">{act.filter((p) => p.id !== voter.id).map((p) => <Btn key={p.id} v="ghost" onClick={() => cast(p.id)}>{p.name}</Btn>)}</div></>
        )}
      </Panel>
    </Shell>
  );
}
function VoteResult({ g, set }: { g: Game; set: (g: Game) => void }) {
  const r = g.voteResult!;
  const t = r.targetId ? g.players.find((p) => p.id === r.targetId)! : null;
  const counts: Record<string, number> = {};
  Object.values(g.votes).forEach((x) => (counts[x] = (counts[x] ?? 0) + 1));
  return (
    <Shell title="Итоги голосования">
      <Panel className="mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap gap-2">{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => <span key={id} className="rounded-full bg-secondary px-3 py-1 text-sm">{g.players.find((p) => p.id === id)!.name}: <b>{n}</b></span>)}</div>
        {!t && <div className="text-2xl font-extrabold">Ничья — никто не выбывает.</div>}
        {t && t.role === "raider" && <div className="text-2xl font-extrabold text-raider">{t.name} оказался РЕЙДЕРОМ!</div>}
        {t && t.role !== "raider" && (
          <>
            <div className="text-2xl font-extrabold text-primary">{t.name} оказался мирным.</div>
            {r.lostCard ? <p className="mt-2">Он теряет карту «{CARD_MAP[r.lostCard]!.name}».</p>
              : !r.resolved ? (<><p className="mt-2 text-muted-foreground">{t.name}, выбери карту, которую сбросишь:</p>
                <div className="mt-3 flex flex-wrap gap-2">{t.cards.map((c) => <BizCard key={c} id={c} small onClick={() => set(E.loseCard(g, c))} />)}</div></>)
              : <p className="mt-2 text-muted-foreground">У него нет карт для потери.</p>}
          </>
        )}
        <Btn className="mt-6 w-full" disabled={!r.resolved} onClick={() => set(E.startNight(g))}>Перейти к ночи</Btn>
      </Panel>
    </Shell>
  );
}

/* ---------- Night ---------- */
function Night({ g, set }: { g: Game; set: (g: Game) => void }) {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const step = g.nightSteps[g.nightIdx]!;
  const advance = () => {
    setShown(false); setDone(false);
    if (g.nightIdx + 1 >= g.nightSteps.length) set(E.finishNight(g));
    else set({ ...g, nightIdx: g.nightIdx + 1 });
  };
  if (g.nightIdx === -1)
    return (
      <Shell title={`Ночь · раунд ${g.round}/3`}>
        <Panel className="mx-auto max-w-lg text-center"><div className="text-5xl">🌙</div><p className="my-4 text-xl font-bold">Город засыпает. Передайте устройство рейдерам.</p><Btn onClick={advance}>Начать ночь</Btn></Panel>
      </Shell>
    );
  const p = g.players.find((x) => x.id === step.playerId)!;
  return (
    <Shell title={`Ночь · раунд ${g.round}/3`} sub={`Ход ${g.nightIdx + 1} из ${g.nightSteps.length}`}>
      {!shown ? (
        <Panel className="mx-auto max-w-lg text-center"><p className="text-muted-foreground">Передайте устройство</p><div className="my-3 text-3xl font-extrabold">{p.name}</div><Btn onClick={() => setShown(true)}>Это я</Btn></Panel>
      ) : done ? (
        <Panel className="mx-auto max-w-lg text-center"><p className="mb-4 text-lg">Действие выполнено.</p><Btn onClick={advance}>Я закончил, передать устройство</Btn></Panel>
      ) : step.kind === "raider" ? <RaiderTurn g={g} me={p} set={(n) => { set(n); setDone(true); }} skip={() => setDone(true)} />
        : step.kind === "broker" ? <BrokerTurn g={g} set={(n) => { set(n); setDone(true); }} skip={() => setDone(true)} />
          : <TaxTurn g={g} me={p} set={set} finish={() => setDone(true)} />}
    </Shell>
  );
}
function RaiderTurn({ g, me, set, skip }: { g: Game; me: Player; set: (g: Game) => void; skip: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const victims = E.activePlayers(g).filter((p) => p.role !== "raider" && p.id !== me.id && p.cards.length > 0);
  const chains = g.chains.filter((c) => !c.destroyed);
  const run = (r: Game | string) => (typeof r === "string" ? setErr(r) : set(r));
  return (
    <Panel>
      <div className="mb-1 text-xl font-extrabold text-raider">{me.name}, выбери, что украсть</div>
      <p className="mb-4 text-sm text-muted-foreground">Одна карта: из руки игрока или из цепочки (цепочка будет разрушена).</p>
      <Err msg={err} />
      <div className="space-y-4">
        {victims.map((v) => (<div key={v.id}><div className="mb-2 font-bold">{v.name}</div><div className="flex flex-wrap gap-2">{v.cards.map((c) => <BizCard key={c} id={c} small onClick={() => run(E.stealFromHand(g, me.id, v.id, c))} />)}</div></div>))}
        {chains.map((ch, i) => (<div key={ch.id}><div className="mb-2 font-bold text-raider">Цепочка #{i + 1} ({ch.points} очк.)</div><div className="flex flex-wrap gap-2">{ch.cardIds.map((c) => <BizCard key={c} id={c} small onClick={() => run(E.stealFromChain(g, me.id, ch.id, c))} />)}</div></div>))}
        {!victims.length && !chains.length && <p>Красть нечего.</p>}
      </div>
      <Btn v="ghost" className="mt-4" onClick={skip}>Пропустить</Btn>
    </Panel>
  );
}
function BrokerTurn({ g, set, skip }: { g: Game; set: (g: Game) => void; skip: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel className="mx-auto max-w-lg">
      <div className="mb-4 text-xl font-extrabold text-accent">Маклер: поменяй случайные карты двух игроков</div>
      <div className="grid gap-3"><PlayerSelect g={g} label="Игрок 1" value={a} onChange={setA} exclude={[b]} /><PlayerSelect g={g} label="Игрок 2" value={b} onChange={setB} exclude={[a]} /></div>
      <Err msg={err} />
      <div className="mt-4 flex gap-2"><Btn v="amber" disabled={!a || !b} onClick={() => { const r = E.brokerSwap(g, a, b); typeof r === "string" ? setErr(r) : set(r); }}>Поменять</Btn><Btn v="ghost" onClick={skip}>Пропустить</Btn></div>
    </Panel>
  );
}
function TaxTurn({ g, me, set, finish }: { g: Game; me: Player; set: (g: Game) => void; finish: () => void }) {
  const [t, setT] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const target = g.players.find((p) => p.id === checked);
  const isRaider = target?.role === "raider";
  return (
    <Panel className="mx-auto max-w-2xl">
      <div className="mb-4 text-xl font-extrabold text-accent">Налоговая: проверь одного игрока</div>
      {!checked ? (
        <><PlayerSelect g={g} label="Кого проверить" value={t} onChange={setT} exclude={[me.id]} />
          <Btn v="amber" className="mt-4" disabled={!t} onClick={() => { setChecked(t); if (g.players.find((p) => p.id === t)!.role === "raider") set({ ...g, taxFound: true }); }}>Проверить</Btn></>
      ) : (
        <>
          <div className={`rounded-xl p-4 text-2xl font-extrabold ${isRaider ? "bg-raider/15 text-raider" : "bg-primary/15 text-primary"}`}>{target!.name}: {isRaider ? "Рейдер" : "Не рейдер"}</div>
          {isRaider && !g.taxUsed && target!.cards.length > 0 && (
            <><p className="mt-4 text-sm text-muted-foreground">Оштрафовать (один раз за игру): выбери карту в сброс.</p>
              <div className="mt-2 flex flex-wrap gap-2">{target!.cards.map((c) => <BizCard key={c} id={c} small onClick={() => { set(E.taxFine(g, target!.id, c)); finish(); }} />)}</div></>
          )}
          <Btn v="ghost" className="mt-4" onClick={finish}>Готово</Btn>
        </>
      )}
    </Panel>
  );
}
function NightResults({ g, set }: { g: Game; set: (g: Game) => void }) {
  return (
    <Shell title="Итоги ночи" sub={`Раунд ${g.round}/3`}>
      <Panel className="mx-auto max-w-2xl">
        {g.nightLog.length ? <ul className="space-y-2">{g.nightLog.map((l, i) => <li key={i} className="rounded-xl bg-secondary p-3">{l}</li>)}</ul> : <p>Ночь прошла спокойно.</p>}
        <p className="mt-4 text-sm text-muted-foreground">Всего сгорело очков за игру: <b className="text-raider">{g.burned}</b>. Каждый активный игрок получил +1 карту и +1 ресурс.</p>
        <Btn className="mt-6 w-full" onClick={() => set(E.nextDay(g))}>{g.round >= 3 ? "Финальный подсчёт" : "Следующий день"}</Btn>
      </Panel>
    </Shell>
  );
}

/* ---------- Game Over ---------- */
function Over({ g, reset }: { g: Game; reset: () => void }) {
  const s = E.score(g);
  const [copied, setCopied] = useState(false);
  const verdict = s.winner === "civil" ? "Победили мирные!" : s.winner === "raider" ? "Победили рейдеры!" : "Ничья!";
  const share = () => {
    const txt = `Бизнес-Мафия: ${verdict}\nМирные: ${s.civil} · Рейдеры: ${s.raiders}\n` + g.players.map((p) => `${p.name} — ${ROLES[p.role].name}${p.out ? " (раскрыт)" : ""}`).join("\n");
    navigator.clipboard.writeText(txt).then(() => setCopied(true));
  };
  return (
    <Shell title={verdict}>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel><div className="text-sm text-muted-foreground">Мирные</div><div className="text-5xl font-extrabold text-primary">{s.civil}</div>
          <p className="mt-2 text-sm">Цепочки: {s.chainSum} · Маклер: +{s.brokerBonus} · Налоговая: +{s.taxBonus} · Сгорело: {s.burned}</p></Panel>
        <Panel><div className="text-sm text-muted-foreground">Рейдеры</div><div className="text-5xl font-extrabold text-raider">{s.raiders}</div>
          <p className="mt-2 text-sm">Украдено карт: {g.stolen} · Нераскрытых рейдеров: {s.hidden} (×3)</p></Panel>
      </div>
      <Panel className="mt-4">
        <table className="w-full text-left">
          <thead><tr className="text-sm text-muted-foreground"><th className="py-2">Игрок</th><th>Роль</th><th>Статус</th></tr></thead>
          <tbody>{g.players.map((p) => <tr key={p.id} className="border-t border-border"><td className="py-2 font-bold">{p.name}</td><td className={roleColor(p.role)}>{ROLES[p.role].name}</td><td className="text-sm text-muted-foreground">{p.out ? "раскрыт" : "в игре"}</td></tr>)}</tbody>
        </table>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-3"><Btn onClick={reset}>Играть снова</Btn><Btn v="ghost" onClick={share}>{copied ? "Скопировано!" : "Поделиться результатом"}</Btn><Btn v="ghost" onClick={exportRules}>Экспорт правил в PDF</Btn></div>
    </Shell>
  );
}
