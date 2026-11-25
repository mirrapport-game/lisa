import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BusinessCard, type CardData } from "@/components/BusinessCard";
import { STATUS_LABEL, type CardRow } from "@/lib/deck";
import { exportCardPdf, exportCardPng } from "@/lib/export-card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({
    meta: [
      { title: "Мои карты — Бизнес-колода" },
      { name: "description", content: "Ваши карты эксперта: статусы, скачивание и публичные ссылки." },
      { property: "og:title", content: "Мои карты — Бизнес-колода" },
      { property: "og:description", content: "Ваши карты эксперта." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCards,
});

type Row = CardRow & { topics: { niche: string; subniche: string } | null; cities: { name: string } | null };
const statusCls: Record<CardRow["status"], string> = {
  draft: "bg-secondary text-muted-foreground", pending: "bg-accent/20 text-accent", active: "bg-gives/20 text-gives",
  archived: "bg-secondary text-muted-foreground", rejected: "bg-raider/20 text-raider",
};

function MyCards() {
  const q = useQuery({
    queryKey: ["my-cards"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("cards").select("*, topics(niche, subniche), cities(name)").eq("user_id", u.user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Мои карты</h1>
        <Link to="/create" search={{ id: undefined }} className="rounded-xl bg-gold px-5 py-3 font-bold text-deck">+ Новая карта</Link>
      </div>
      {q.isLoading && <div className="mt-6 grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
      {q.data?.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-gold/40 p-10 text-center">
          <div className="text-xl font-bold">У вас пока нет карт</div>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Темы эксклюзивны: одна ниша в городе или онлайн — один эксперт. Займите свою, пока свободна.</p>
          <Link to="/create" search={{ id: undefined }} className="mt-5 inline-block rounded-xl bg-gold px-6 py-3 font-bold text-deck">Создать первую карту</Link>
        </div>
      )}
      <div className="mt-6 grid gap-5 md:grid-cols-2">{q.data?.map((c) => <CardItem key={c.id} c={c} />)}</div>
    </main>
  );
}

function CardItem({ c }: { c: Row }) {
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const data: CardData = { ...c, topicLabel: c.topics ? `${c.topics.niche} · ${c.topics.subniche}` : undefined, place: c.mode === "online" ? "Онлайн" : c.cities?.name };
  const name = `${c.first_name}-${c.last_name}`.trim() || "card";
  const link = typeof window !== "undefined" && c.slug ? `${window.location.origin}/c/${c.slug}` : "";

  const run = async (fn: () => Promise<void>) => {
    setExporting(true);
    try { await new Promise((r) => setTimeout(r, 300)); await fn(); } catch { toast.error("Не удалось скачать файл"); }
    setExporting(false);
  };
  const duplicate = async () => {
    const { id: _id, created_at: _c, updated_at: _u, topics: _t, cities: _ci, slug, status: _s, reject_reason: _r, ...rest } = c;
    const { data: row, error } = await supabase.from("cards").insert({ ...rest, topic_id: null, subtopic: null, city_id: null, status: "draft", slug: `${slug ?? "card"}-${Math.random().toString(36).slice(2, 5)}` }).select("id").single();
    if (error || !row) { toast.error("Не удалось дублировать"); return; }
    qc.invalidateQueries({ queryKey: ["my-cards"] });
    toast.success("Копия создана — выберите для неё другую тему");
    navigate({ to: "/create", search: { id: row.id } });
  };
  const archive = async () => {
    const { error } = await supabase.from("cards").update({ status: "archived" }).eq("id", c.id);
    if (error) toast.error("Ошибка"); else { toast.success("Карта в архиве, тема освобождена"); qc.invalidateQueries({ queryKey: ["my-cards"] }); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm text-muted-foreground">{data.topicLabel ?? "Тема не выбрана"} · {data.place ?? "—"}</div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusCls[c.status]}`}>{STATUS_LABEL[c.status]}</span>
      </div>
      {c.status === "rejected" && c.reject_reason && <p className="mb-3 rounded-lg bg-raider/10 p-2 text-sm text-raider">Причина: {c.reject_reason}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2"><BusinessCard card={data} variant="front" /><BusinessCard card={data} variant="back" /></div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Btn disabled={exporting} onClick={() => run(() => exportCardPdf(front.current!, back.current!, name))}>Скачать PDF</Btn>
        <Btn disabled={exporting} onClick={() => run(() => exportCardPng(front.current!, name))}>Скачать PNG</Btn>
        {c.status === "active" && c.slug && <Btn onClick={() => { navigator.clipboard.writeText(link); toast.success("Ссылка скопирована"); }}>Публичная ссылка</Btn>}
        <Link to="/create" search={{ id: c.id }} className="rounded-lg border border-border px-3 py-2 font-semibold">Редактировать</Link>
        <Btn onClick={duplicate}>Дублировать</Btn>
        {c.status !== "archived" && <Btn onClick={archive}>В архив</Btn>}
      </div>
      {exporting && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
          <BusinessCard ref={front} card={data} variant="front" size="print" />
          <BusinessCard ref={back} card={data} variant="back" size="print" />
        </div>
      )}
    </div>
  );
}
function Btn(p: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50" />;
}
