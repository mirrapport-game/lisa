import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BusinessCard } from "@/components/BusinessCard";
import { recommendText, telegramUrl, type CardRow } from "@/lib/deck";

export const Route = createFileRoute("/c/$slug")({
  head: () => ({
    meta: [
      { title: "Карта эксперта — Бизнес-колода" },
      { name: "description", content: "Карта эксперта из Бизнес-колоды: совет, контакт и рекомендация." },
      { property: "og:title", content: "Карта эксперта — Бизнес-колода" },
      { property: "og:description", content: "Совет эксперта и контакт в Telegram." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicCard,
});

type Row = CardRow & { topics: { niche: string; subniche: string } | null; cities: { name: string } | null };

function PublicCard() {
  const { slug } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-card", slug],
    queryFn: async () => {
      const { data } = await supabase.from("cards").select("*, topics(niche, subniche), cities(name)").eq("slug", slug).eq("status", "active").maybeSingle();
      return data as Row | null;
    },
  });
  if (q.isLoading) return <main className="p-10 text-center text-muted-foreground">Загрузка…</main>;
  const c = q.data;
  if (!c) return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">Карта не найдена</h1>
      <p className="mt-2 text-muted-foreground">Возможно, она ещё на модерации или в архиве.</p>
      <Link to="/" className="mt-5 inline-block text-gold underline">На главную</Link>
    </main>
  );
  const data = { ...c, topicLabel: c.topics ? `${c.topics.niche} · ${c.topics.subniche}` : undefined, place: c.mode === "online" ? "Онлайн" : c.cities?.name };
  const link = window.location.href;
  const text = recommendText(c, link);
  const tg = telegramUrl(c.telegram);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans">
      <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">{data.topicLabel} · {data.place}</div>
      <h1 className="mt-2 text-4xl font-extrabold">{c.first_name} {c.last_name}</h1>
      <p className="mt-1 text-lg text-muted-foreground">{c.headline}</p>
      <div className="mt-6 flex flex-wrap gap-4"><BusinessCard card={data} variant="front" /><BusinessCard card={data} variant="back" /></div>
      <div className="mt-8 grid gap-5 md:grid-cols-[auto_1fr]">
        {c.qr_target_url && <div className="rounded-2xl bg-deck-foreground p-3 self-start"><QRCodeSVG value={c.qr_target_url} size={140} /></div>}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-bold">Порекомендовать</div>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => { navigator.clipboard.writeText(text); toast.success("Текст скопирован"); }} className="rounded-xl bg-gold px-5 py-3 font-bold text-deck">Скопировать рекомендацию</button>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-5 py-3 font-bold">Поделиться в Telegram</a>
            {tg && <a href={tg} target="_blank" rel="noreferrer" className="rounded-xl border border-gold/50 px-5 py-3 font-bold text-gold">Написать в Telegram</a>}
          </div>
        </div>
      </div>
    </main>
  );
}
