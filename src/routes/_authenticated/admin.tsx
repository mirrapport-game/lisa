import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BusinessCard } from "@/components/BusinessCard";
import { useUser, type CardRow } from "@/lib/deck";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Модерация — Бизнес-колода" },
      { name: "description", content: "Модерация карт экспертов." },
      { property: "og:title", content: "Модерация — Бизнес-колода" },
      { property: "og:description", content: "Модерация карт экспертов." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Row = CardRow & { topics: { niche: string; subniche: string } | null; cities: { name: string } | null };

function Admin() {
  const me = useUser();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["pending-cards"],
    enabled: !!me.data?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*, topics(niche, subniche), cities(name)").eq("status", "pending").order("created_at");
      if (error) throw error;
      return data as Row[];
    },
  });
  if (me.isLoading) return null;
  if (!me.data?.isAdmin) return <main className="mx-auto max-w-xl px-4 py-12 text-center">Раздел доступен только модераторам.</main>;

  const decide = async (id: string, ok: boolean, reason?: string) => {
    const { error } = await supabase.from("cards").update(ok ? { status: "active", reject_reason: null } : { status: "rejected", reject_reason: reason ?? "" }).eq("id", id);
    if (error) { toast.error(error.code === "23505" ? "Тема уже занята активной картой" : error.message); return; }
    toast.success(ok ? "Карта одобрена" : "Карта отклонена");
    qc.invalidateQueries({ queryKey: ["pending-cards"] });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 font-sans">
      <h1 className="text-3xl font-extrabold">Модерация</h1>
      <p className="mt-1 text-muted-foreground">Карт на проверке: {q.data?.length ?? 0}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">{q.data?.map((c) => <Item key={c.id} c={c} decide={decide} />)}</div>
    </main>
  );
}

function Item({ c, decide }: { c: Row; decide: (id: string, ok: boolean, reason?: string) => void }) {
  const [reason, setReason] = useState("");
  const data = { ...c, topicLabel: c.topics ? `${c.topics.niche} · ${c.topics.subniche}` : undefined, place: c.mode === "online" ? "Онлайн" : c.cities?.name };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 text-sm text-muted-foreground">{data.topicLabel} · {data.place} {c.telegram && `· @${c.telegram}`}</div>
      <div className="flex gap-3 overflow-x-auto pb-2"><BusinessCard card={data} variant="front" /><BusinessCard card={data} variant="back" /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => decide(c.id, true)} className="rounded-lg bg-gives px-4 py-2 font-bold text-deck">Одобрить</button>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина отказа" className="min-w-0 flex-1 rounded-lg border border-input bg-secondary px-3" />
        <button disabled={!reason.trim()} onClick={() => decide(c.id, false, reason)} className="rounded-lg bg-raider px-4 py-2 font-bold text-destructive-foreground disabled:opacity-40">Отклонить</button>
      </div>
    </div>
  );
}
