import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CardRow = Tables<"cards">;
export type Topic = Tables<"topics">;
export type City = Tables<"cities">;

export const LIMITS = { headline: 60, advice: 280, cta: 80, photoMb: 5 };

export const STATUS_LABEL: Record<CardRow["status"], string> = {
  draft: "Черновик",
  pending: "На модерации",
  active: "Активна",
  archived: "В архиве",
  rejected: "Отклонена",
};

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ä: "a", ö: "o", ü: "u", ß: "ss",
};
export function slugify(...parts: string[]) {
  return parts
    .join(" ")
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function telegramUrl(handle?: string | null) {
  if (!handle) return null;
  const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  return h ? `https://t.me/${h}` : null;
}

export function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("*").order("niche").order("subniche");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

/** Photos live in a private bucket; resolve a short-lived URL for display. */
export function usePhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:")) return setUrl(path);
    let alive = true;
    supabase.storage.from("card-photos").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}

export function useUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      return { user: data.user, isAdmin: !!roles?.some((r) => r.role === "admin") };
    },
  });
}

export function recommendText(card: Pick<CardRow, "first_name" | "last_name" | "headline" | "advice_title" | "cta">, link: string) {
  const name = `${card.first_name} ${card.last_name}`.trim();
  return `Если вам нужно ${card.headline.toLowerCase() || "надёжного эксперта"}, то ${name} справится лучше всех, потому что делится реальным опытом — например, про «${card.advice_title}». ${card.cta ? card.cta + "." : ""}\n${link}`;
}
