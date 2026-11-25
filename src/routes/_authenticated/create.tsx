import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BusinessCard, type CardData } from "@/components/BusinessCard";
import { LIMITS, slugify, telegramUrl, useCities, useTopics } from "@/lib/deck";

export const Route = createFileRoute("/_authenticated/create")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s['id'] === "string" ? s['id'] : undefined }),
  head: () => ({
    meta: [
      { title: "Создать карту — Бизнес-колода" },
      { name: "description", content: "Пошаговый конструктор карты эксперта." },
      { property: "og:title", content: "Создать карту — Бизнес-колода" },
      { property: "og:description", content: "Пошаговый конструктор карты эксперта." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wizard,
});

type Form = {
  niche: string; topic_id: string; mode: "online" | "city"; city_id: string;
  first_name: string; last_name: string; photo_url: string; headline: string; telegram: string; qr_target_url: string;
  advice_title: string; advice_text: string; cta: string;
};
const EMPTY: Form = { niche: "", topic_id: "", mode: "online", city_id: "", first_name: "", last_name: "", photo_url: "", headline: "", telegram: "", qr_target_url: "", advice_title: "", advice_text: "", cta: "" };
const DRAFT_KEY = "deck-card-draft";
const field = "min-h-12 w-full rounded-xl border border-input bg-secondary px-4 outline-none focus:border-gold";
const STEPS = ["Тема", "Лицо", "Оборот", "Превью"];

function Wizard() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const topics = useTopics();
  const cities = useCities();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [cardId, setCardId] = useState<string | undefined>(id);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  // Load existing card or local autosave
  useEffect(() => {
    if (id) {
      supabase.from("cards").select("*, topics(niche)").eq("id", id).single().then(({ data }) => {
        if (!data) return;
        set({
          niche: (data.topics as { niche: string } | null)?.niche ?? "", topic_id: data.topic_id ?? "", mode: data.mode, city_id: data.city_id ?? "",
          first_name: data.first_name, last_name: data.last_name, photo_url: data.photo_url ?? "", headline: data.headline,
          telegram: data.telegram ?? "", qr_target_url: data.qr_target_url ?? "", advice_title: data.advice_title, advice_text: data.advice_text, cta: data.cta,
        });
      });
    } else {
      try { const s = localStorage.getItem(DRAFT_KEY); if (s) setF({ ...EMPTY, ...JSON.parse(s) }); } catch { /* ignore */ }
    }
  }, [id]);
  useEffect(() => { if (!id) localStorage.setItem(DRAFT_KEY, JSON.stringify(f)); }, [f, id]);

  const niches = useMemo(() => [...new Set((topics.data ?? []).map((t) => t.niche))], [topics.data]);
  const subs = (topics.data ?? []).filter((t) => t.niche === f.niche);
  const topic = topics.data?.find((t) => t.id === f.topic_id);
  const city = cities.data?.find((c) => c.id === f.city_id);
  const cityId = f.mode === "city" ? f.city_id || null : null;

  const occ = useQuery({
    queryKey: ["occupant", f.topic_id, f.mode, cityId, cardId],
    enabled: !!f.topic_id && (f.mode === "online" || !!f.city_id),
    queryFn: async () => {
      const { data } = await supabase.rpc("topic_occupant", { _topic: f.topic_id, _mode: f.mode, _city: cityId as string, _exclude: cardId as string });
      return data?.[0] ?? null;
    },
  });
  const busyAll = useQuery({
    queryKey: ["busy-topics"],
    queryFn: async () => (await supabase.rpc("busy_topics")).data ?? [],
  });
  const isFree = (tid: string) => !(busyAll.data ?? []).some((b) => b.topic_id === tid && b.mode === f.mode && (b.city_id ?? null) === cityId);
  const alternatives = occ.data ? subs.filter((t) => t.id !== f.topic_id && isFree(t.id)) : [];

  const step0ok = !!f.topic_id && (f.mode === "online" || !!f.city_id) && occ.isSuccess && !occ.data;
  const step1ok = !!f.first_name.trim() && !!f.last_name.trim() && !!f.photo_url && !!f.headline.trim() && f.headline.length <= LIMITS.headline && !!f.qr_target_url.trim();
  const step2ok = !!f.advice_title.trim() && !!f.advice_text.trim() && f.advice_text.length <= LIMITS.advice && !!f.cta.trim() && f.cta.length <= LIMITS.cta;
  const canNext = [step0ok, step1ok, step2ok, true][step];

  const upload = async (file: File) => {
    if (!/image\/(jpeg|png)/.test(file.type)) { toast.error("Только JPG или PNG"); return; }
    if (file.size > LIMITS.photoMb * 1024 * 1024) { toast.error("Фото больше 5 МБ"); return; }
    const { data: u } = await supabase.auth.getUser();
    const path = `${u.user!.id}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
    setPreview(URL.createObjectURL(file));
    const { error } = await supabase.storage.from("card-photos").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Не удалось загрузить фото"); return; }
    set({ photo_url: path });
  };

  const save = async (status: "draft" | "pending") => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      user_id: u.user!.id, status, first_name: f.first_name.trim(), last_name: f.last_name.trim(), photo_url: f.photo_url || null,
      topic_id: f.topic_id || null, subtopic: topic?.subniche ?? null, mode: f.mode, city_id: cityId, headline: f.headline.trim(),
      telegram: f.telegram.trim().replace(/^@/, "") || null, qr_target_url: f.qr_target_url.trim() || null,
      advice_title: f.advice_title.trim(), advice_text: f.advice_text.trim(), cta: f.cta.trim(), reject_reason: null,
    };
    let error;
    if (cardId) {
      ({ error } = await supabase.from("cards").update(payload).eq("id", cardId));
    } else {
      const base = slugify(f.first_name, f.last_name, topic?.subniche ?? "") || "card";
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const r = await supabase.from("cards").insert({ ...payload, slug }).select("id").single();
      error = r.error;
      if (r.data) setCardId(r.data.id);
    }
    setBusy(false);
    if (error) {
      if (error.code === "23505") { toast.error("Эта тема уже занята другим экспертом. Выберите свободную."); setStep(0); occ.refetch(); busyAll.refetch(); }
      else toast.error("Не удалось сохранить: " + error.message);
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    qc.invalidateQueries({ queryKey: ["my-cards"] });
    toast.success(status === "pending" ? "Карта отправлена на модерацию" : "Черновик сохранён");
    navigate({ to: "/my" });
  };

  const previewCard: CardData = {
    ...f, photo_url: f.photo_url || null, qr_target_url: f.qr_target_url || null, deck_issue: null,
    ...(topic ? { topicLabel: `${topic.niche} · ${topic.subniche}` } : {}), place: f.mode === "online" ? "Онлайн" : city?.name ?? "",
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 font-sans">
      <h1 className="text-3xl font-extrabold">{cardId ? "Редактирование карты" : "Новая карта"}</h1>
      <div className="mt-4 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-gold" : "bg-secondary"}`} />
            <div className={`mt-1 text-xs ${i === step ? "font-bold text-gold" : "text-muted-foreground"}`}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto]">
        <section className="space-y-4">
          {step === 0 && (
            <>
              <Label t="Ниша">
                <select className={field} value={f.niche} onChange={(e) => set({ niche: e.target.value, topic_id: "" })}>
                  <option value="">— выберите —</option>
                  {niches.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Label>
              {f.niche && (
                <Label t="Подниша">
                  <div className="flex flex-wrap gap-2">
                    {subs.map((t) => (
                      <button key={t.id} onClick={() => set({ topic_id: t.id })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${f.topic_id === t.id ? "border-gold bg-gold text-deck" : "border-border bg-secondary"}`}>
                        {t.subniche} {!isFree(t.id) && <span className="ml-1 opacity-70">· занято</span>}
                      </button>
                    ))}
                  </div>
                </Label>
              )}
              <Label t="Режим">
                <div className="flex gap-2">
                  {(["online", "city"] as const).map((m) => (
                    <button key={m} onClick={() => set({ mode: m })} className={`flex-1 rounded-xl border px-4 py-3 font-bold ${f.mode === m ? "border-gold bg-gold/15 text-gold" : "border-border bg-secondary"}`}>{m === "online" ? "Онлайн" : "Город"}</button>
                  ))}
                </div>
              </Label>
              {f.mode === "city" && (
                <Label t="Город">
                  <select className={field} value={f.city_id} onChange={(e) => set({ city_id: e.target.value })}>
                    <option value="">— выберите —</option>
                    {cities.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Label>
              )}
              {occ.isSuccess && (occ.data ? (
                <div className="rounded-xl border border-raider bg-raider/10 p-4">
                  <b className="text-raider">Занято: {occ.data.holder}</b>{occ.data.status === "pending" && " (на модерации)"}
                  <p className="mt-1 text-sm">Одна тема — один эксперт. {alternatives.length ? "Свободно в этой нише:" : "Попробуйте другой режим или город."}</p>
                  <div className="mt-2 flex flex-wrap gap-2">{alternatives.map((t) => <button key={t.id} onClick={() => set({ topic_id: t.id })} className="rounded-full bg-secondary px-3 py-1 text-sm">{t.subniche}</button>)}</div>
                </div>
              ) : <div className="rounded-xl border border-gives/50 bg-gives/10 p-3 font-bold text-gives">Свободно — тема ваша</div>)}
            </>
          )}
          {step === 1 && (
            <>
              <Label t="Фото (JPG/PNG, до 5 МБ)">
                <input type="file" accept="image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-2 file:font-bold file:text-deck" />
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label t="Имя"><input className={field} value={f.first_name} onChange={(e) => set({ first_name: e.target.value })} /></Label>
                <Label t="Фамилия"><input className={field} value={f.last_name} onChange={(e) => set({ last_name: e.target.value })} /></Label>
              </div>
              <Label t={`Ниша / деятельность (${f.headline.length}/${LIMITS.headline})`}><input maxLength={LIMITS.headline} className={field} placeholder="Подбор персонала для малого бизнеса" value={f.headline} onChange={(e) => set({ headline: e.target.value })} /></Label>
              <Label t="Telegram">
                <input className={field} placeholder="@username" value={f.telegram} onChange={(e) => { const v = e.target.value; set({ telegram: v, qr_target_url: !f.qr_target_url || f.qr_target_url === telegramUrl(f.telegram) ? telegramUrl(v) ?? "" : f.qr_target_url }); }} />
              </Label>
              <Label t="Ссылка для QR (Telegram / сайт / лендинг)"><input className={field} placeholder="https://t.me/username" value={f.qr_target_url} onChange={(e) => set({ qr_target_url: e.target.value })} /></Label>
            </>
          )}
          {step === 2 && (
            <>
              <Label t="Заголовок совета"><input className={field} value={f.advice_title} onChange={(e) => set({ advice_title: e.target.value })} /></Label>
              <Label t={`Совет — 15 секунд вслух (${f.advice_text.length}/${LIMITS.advice})`}>
                <textarea maxLength={LIMITS.advice} rows={5} className={`${field} py-3`} value={f.advice_text} onChange={(e) => set({ advice_text: e.target.value })} />
              </Label>
              <Label t={`Призыв (${f.cta.length}/${LIMITS.cta})`}><input maxLength={LIMITS.cta} className={field} placeholder="Спроси меня про подбор персонала" value={f.cta} onChange={(e) => set({ cta: e.target.value })} /></Label>
            </>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-muted-foreground">Проверьте карту. После модерации она станет активной и закрепит за вами тему.</p>
              <div className="flex flex-wrap gap-3">
                <button disabled={busy} onClick={() => save("draft")} className="min-h-12 rounded-xl border border-border px-5 font-bold disabled:opacity-50">Сохранить черновик</button>
                <button disabled={busy || !step0ok || !step1ok || !step2ok} onClick={() => save("pending")} className="min-h-12 rounded-xl bg-gold px-5 font-bold text-deck disabled:opacity-50">Отправить на модерацию</button>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            {step > 0 && <button onClick={() => setStep(step - 1)} className="min-h-12 rounded-xl border border-border px-5 font-bold">Назад</button>}
            {step < 3 && <button disabled={!canNext} onClick={() => setStep(step + 1)} className="min-h-12 rounded-xl bg-gold px-6 font-bold text-deck disabled:opacity-40">Далее</button>}
          </div>
        </section>
        <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-20 lg:self-start">
          <BusinessCard card={previewCard} variant="front" photoOverride={preview} />
          <BusinessCard card={previewCard} variant="back" />
        </aside>
      </div>
    </main>
  );
}

function Label({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{t}</span>{children}</label>;
}
