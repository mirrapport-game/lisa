import { describe, expect, it } from "vitest";
import { chainPoints, raiderCount, validateChain, newGame } from "./engine";

describe("правила игры", () => {
  it("число рейдеров: 6–8 → 2, 9–12 → 3", () => {
    expect(raiderCount(6)).toBe(2);
    expect(raiderCount(8)).toBe(2);
    expect(raiderCount(9)).toBe(3);
    expect(raiderCount(12)).toBe(3);
  });
  it("Пекарня → Упаковщик — валидная цепочка, Пекарня → Юрист — нет", () => {
    expect(validateChain(["c1", "c2"])).toBeNull();
    expect(validateChain(["c1", "c6"])).not.toBeNull();
  });
  it("очки: 2=1, 3=3, 4=6, 5=10, +2 за 3+ игроков", () => {
    expect(chainPoints(["a", "b"], ["p1", "p1"])).toBe(1);
    expect(chainPoints(["a", "b", "c"], ["p1", "p2", "p2"])).toBe(3);
    expect(chainPoints(["a", "b", "c", "d"], ["p1", "p2", "p3", "p1"])).toBe(8);
    expect(chainPoints(["a", "b", "c", "d", "e"], ["p1", "p1", "p1", "p1", "p1"])).toBe(10);
  });
  it("старт: 3 карты и 2 ресурса каждому", () => {
    const g = newGame(Array(7).fill(""), true, true);
    g.players.forEach((p) => { expect(p.cards).toHaveLength(3); expect(p.resources).toHaveLength(2); });
    expect(g.players.filter((p) => p.role === "raider")).toHaveLength(2);
  });
});
