import { ALL_CARDS as CARDS, CARD_MAP, CHAIN_POINTS, RESOURCES, type Role } from "./data";

export type Player = {
  id: string; name: string; role: Role; cards: string[]; resources: string[];
  out: boolean; robbed: boolean;
};
export type Chain = { id: string; cardIds: string[]; owners: string[]; points: number; destroyed: boolean };
export type NightStep = { playerId: string; kind: "raider" | "broker" | "tax" };
export type Phase = "setup" | "reveal" | "day" | "vote" | "voteResult" | "night" | "nightResults" | "over";

export type Game = {
  phase: Phase; round: number; players: Player[]; deck: string[]; discard: string[];
  chains: Chain[]; revealIdx: number; voteIdx: number; votes: Record<string, string>;
  voteResult: { targetId: string | null; lostCard?: string; resolved: boolean } | null;
  nightSteps: NightStep[]; nightIdx: number; nightLog: string[]; burned: number;
  stolen: number; taxUsed: boolean; taxFound: boolean; timer: number; paused: boolean;
};

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
};
const randRes = () => RESOURCES[Math.floor(Math.random() * RESOURCES.length)]!.key;

export function raiderCount(n: number) { return Math.min(3, Math.floor(n / 3)); }

export function newGame(names: string[], broker: boolean, tax: boolean): Game {
  const n = names.length;
  const roles: Role[] = Array(raiderCount(n)).fill("raider");
  if (broker) roles.push("broker");
  if (tax) roles.push("tax");
  while (roles.length < n) roles.push("civil");
  const sr = shuffle(roles);
  let deck = shuffle(CARDS.map((c) => c.id));
  const players: Player[] = names.map((name, i) => {
    const cards = deck.slice(0, 3); deck = deck.slice(3);
    return { id: `p${i}`, name: name.trim() || `Игрок ${i + 1}`, role: sr[i]!, cards, resources: [randRes(), randRes()], out: false, robbed: false };
  });
  return {
    phase: "reveal", round: 1, players, deck, discard: [], chains: [], revealIdx: 0, voteIdx: 0, votes: {},
    voteResult: null, nightSteps: [], nightIdx: 0, nightLog: [], burned: 0, stolen: 0,
    taxUsed: false, taxFound: false, timer: 600, paused: false,
  };
}

export const linked = (a: string, b: string) => {
  const A = CARD_MAP[a]!, B = CARD_MAP[b]!;
  return B.needsTag === A.givesTag || A.needsTag === B.givesTag;
};
export function validateChain(ids: string[]): string | null {
  if (ids.length < 2 || ids.length > 5) return "Цепочка должна содержать от 2 до 5 карт.";
  if (new Set(ids).size !== ids.length) return "Карту нельзя использовать дважды.";
  for (let i = 0; i < ids.length - 1; i++)
    if (!linked(ids[i]!, ids[i + 1]!)) return `«${CARD_MAP[ids[i]!]!.name}» и «${CARD_MAP[ids[i + 1]!]!.name}» не связаны.`;
  return null;
}
export function chainPoints(ids: string[], owners: string[]) {
  return (CHAIN_POINTS[ids.length] ?? 0) + (new Set(owners).size >= 3 ? 2 : 0);
}

const ownerOf = (g: Game, cardId: string) => g.players.find((p) => p.cards.includes(cardId));

export function createChain(g: Game, ids: string[]): Game | string {
  const err = validateChain(ids);
  if (err) return err;
  const owners = ids.map((id) => ownerOf(g, id)?.id);
  if (owners.some((o) => !o)) return "Карта уже используется.";
  const players = g.players.map((p) => ({ ...p, cards: p.cards.filter((c) => !ids.includes(c)) }));
  const chain: Chain = { id: `ch${Date.now()}`, cardIds: ids, owners: owners as string[], points: chainPoints(ids, owners as string[]), destroyed: false };
  return { ...g, players, chains: [...g.chains, chain] };
}

export type TradeItem = { type: "card" | "res"; value: string } | null;
export function trade(g: Game, aId: string, a: TradeItem, bId: string, b: TradeItem): Game | string {
  if (aId === bId) return "Выберите двух разных игроков.";
  if (!a && !b) return "Выберите хотя бы один предмет.";
  const players = g.players.map((p) => ({ ...p, cards: [...p.cards], resources: [...p.resources] }));
  const A = players.find((p) => p.id === aId)!, B = players.find((p) => p.id === bId)!;
  if (A.out || B.out) return "Выбывшие игроки не обмениваются.";
  const move = (from: Player, to: Player, it: TradeItem) => {
    if (!it) return true;
    const arr = it.type === "card" ? from.cards : from.resources;
    const i = arr.indexOf(it.value); if (i < 0) return false;
    arr.splice(i, 1); (it.type === "card" ? to.cards : to.resources).push(it.value); return true;
  };
  if (!move(A, B, a) || !move(B, A, b)) return "Предмет недоступен для обмена.";
  return { ...g, players };
}

export const activePlayers = (g: Game) => g.players.filter((p) => !p.out);

export function tallyVotes(g: Game): string | null {
  const c: Record<string, number> = {};
  Object.values(g.votes).forEach((t) => (c[t] = (c[t] ?? 0) + 1));
  const max = Math.max(0, ...Object.values(c));
  const top = Object.keys(c).filter((k) => c[k] === max);
  return top.length === 1 ? top[0]! : null;
}

export function applyVote(g: Game): Game {
  const targetId = tallyVotes(g);
  let players = g.players, discard = g.discard;
  if (targetId) {
    const t = g.players.find((p) => p.id === targetId)!;
    if (t.role === "raider") {
      discard = [...discard, ...t.cards];
      players = g.players.map((p) => (p.id === targetId ? { ...p, out: true, cards: [] } : p));
    }
  }
  return { ...g, players, discard, phase: "voteResult", voteResult: { targetId, resolved: !targetId || g.players.find((p) => p.id === targetId)!.role === "raider" || g.players.find((p) => p.id === targetId)!.cards.length === 0 } };
}

export function loseCard(g: Game, cardId: string): Game {
  const tid = g.voteResult!.targetId!;
  return {
    ...g, discard: [...g.discard, cardId],
    players: g.players.map((p) => (p.id === tid ? { ...p, cards: p.cards.filter((c) => c !== cardId) } : p)),
    voteResult: { ...g.voteResult!, lostCard: cardId, resolved: true },
  };
}

export function startNight(g: Game): Game {
  const act = activePlayers(g);
  const steps: NightStep[] = [
    ...act.filter((p) => p.role === "raider").map((p) => ({ playerId: p.id, kind: "raider" as const })),
    ...act.filter((p) => p.role === "broker").map((p) => ({ playerId: p.id, kind: "broker" as const })),
    ...act.filter((p) => p.role === "tax").map((p) => ({ playerId: p.id, kind: "tax" as const })),
  ];
  return { ...g, phase: "night", nightSteps: steps, nightIdx: -1, nightLog: [] };
}

export function stealFromHand(g: Game, raiderId: string, victimId: string, cardId: string): Game | string {
  const v = g.players.find((p) => p.id === victimId)!;
  if (v.role === "raider") return "Нельзя.";
  if (v.cards.length === 0) return "Нельзя красть у банкрота.";
  if (!v.cards.includes(cardId)) return "Карта недоступна.";
  return {
    ...g, stolen: g.stolen + 1,
    nightLog: [...g.nightLog, `Украдена карта «${CARD_MAP[cardId]!.name}» у ${v.name}.`],
    players: g.players.map((p) =>
      p.id === victimId ? { ...p, robbed: true, cards: p.cards.filter((c) => c !== cardId) }
        : p.id === raiderId ? { ...p, cards: [...p.cards, cardId] } : p),
  };
}

export function stealFromChain(g: Game, raiderId: string, chainId: string, cardId: string): Game | string {
  const ch = g.chains.find((c) => c.id === chainId);
  if (!ch || ch.destroyed) return "Цепочка недоступна.";
  return {
    ...g, stolen: g.stolen + 1, burned: g.burned + ch.points,
    nightLog: [...g.nightLog, `Из цепочки украдена «${CARD_MAP[cardId]!.name}». Цепочка разрушена, сгорело ${ch.points} очк.`],
    chains: g.chains.map((c) => (c.id === chainId ? { ...c, destroyed: true, cardIds: c.cardIds.filter((x) => x !== cardId) } : c)),
    players: g.players.map((p) => {
      if (p.id === raiderId) return { ...p, cards: [...p.cards, cardId] };
      if (ch.owners.includes(p.id)) return { ...p, robbed: true };
      return p;
    }),
  };
}

export function brokerSwap(g: Game, aId: string, bId: string): Game | string {
  const A = g.players.find((p) => p.id === aId)!, B = g.players.find((p) => p.id === bId)!;
  if (aId === bId) return "Выберите двух разных игроков.";
  if (!A.cards.length || !B.cards.length) return "У одного из игроков нет карт.";
  const ca = A.cards[Math.floor(Math.random() * A.cards.length)]!;
  const cb = B.cards[Math.floor(Math.random() * B.cards.length)]!;
  return {
    ...g, nightLog: [...g.nightLog, `Маклер поменял карты двух игроков.`],
    players: g.players.map((p) =>
      p.id === aId ? { ...p, cards: p.cards.map((c) => (c === ca ? cb : c)) }
        : p.id === bId ? { ...p, cards: p.cards.map((c) => (c === cb ? ca : c)) } : p),
  };
}

export function taxFine(g: Game, targetId: string, cardId: string): Game {
  return {
    ...g, taxUsed: true, taxFound: true, discard: [...g.discard, cardId],
    nightLog: [...g.nightLog, `Налоговая оштрафовала одного из игроков — карта ушла в сброс.`],
    players: g.players.map((p) => (p.id === targetId ? { ...p, cards: p.cards.filter((c) => c !== cardId) } : p)),
  };
}

export function finishNight(g: Game): Game {
  let deck = g.deck.length ? [...g.deck] : shuffle(g.discard);
  let discard = g.deck.length ? g.discard : [];
  const players = g.players.map((p) => {
    if (p.out) return p;
    if (!deck.length) { deck = shuffle(discard); discard = []; }
    const c = deck.shift();
    return { ...p, cards: c ? [...p.cards, c] : p.cards, resources: [...p.resources, randRes()] };
  });
  return { ...g, players, deck, discard, phase: "nightResults" };
}

export function nextDay(g: Game): Game {
  if (g.round >= 3) return { ...g, phase: "over" };
  return { ...g, round: g.round + 1, phase: "day", timer: 600, paused: false, votes: {}, voteIdx: 0, voteResult: null };
}

export function score(g: Game) {
  const chainSum = g.chains.filter((c) => !c.destroyed).reduce((s, c) => s + c.points, 0);
  const broker = g.players.find((p) => p.role === "broker");
  const tax = g.players.find((p) => p.role === "tax");
  const brokerBonus = broker && !broker.robbed ? 5 : 0;
  const taxBonus = tax && (g.taxFound || g.players.some((p) => p.role === "raider" && p.out)) && g.taxFound ? 4 : 0;
  const hidden = g.players.filter((p) => p.role === "raider" && !p.out).length;
  const civil = chainSum + brokerBonus + taxBonus;
  const raiders = g.stolen + hidden * 3;
  return { chainSum, brokerBonus, taxBonus, hidden, civil, raiders, burned: g.burned, winner: civil > raiders ? "civil" : civil < raiders ? "raider" : "draw" };
}
