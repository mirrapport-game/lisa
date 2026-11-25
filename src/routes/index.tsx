import { createFileRoute, Link } from "@tanstack/react-router";
import { BusinessCard } from "@/components/BusinessCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Бизнес-колода — персональные карты экспертов" },
      { name: "description", content: "Создайте свою карту-визитку эксперта за 5 минут: лицо, совет, QR. Одна тема — один эксперт." },
      { property: "og:title", content: "Бизнес-колода — набор для создания личного комьюнити" },
      { property: "og:description", content: "Карты экспертов для бизнес-завтраков и игры с кросс-рекомендациями." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const sample = {
  first_name: "Анна", last_name: "Шмидт", photo_url: null, headline: "Подбор персонала для малого бизнеса",
  advice_title: "Нанимайте на испытательную задачу", advice_text: "Перед оффером дайте кандидату оплачиваемое задание на 2 часа. Так вы увидите реальную работу, а не умение проходить интервью.",
  cta: "Спроси меня про подбор персонала", qr_target_url: "https://t.me/", deck_issue: 1, topicLabel: "HR · Подбор персонала", place: "Берлин",
};

function Landing() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 font-sans">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Бизнес-колода</div>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">Набор для создания личного комьюнити</h1>
          <p className="mt-4 text-lg text-muted-foreground">Создайте свою карту эксперта за 5 минут: фото, ниша, совет на 15 секунд и QR на ваш Telegram. Карты собираются в выпуски для бизнес-завтраков и игры.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/create" search={{ id: undefined }} className="rounded-xl bg-gold px-6 py-3 font-bold text-deck">Создать карту</Link>
            <Link to="/auth" search={{ next: undefined }} className="rounded-xl border border-border px-6 py-3 font-bold">Войти</Link>
          </div>
          <p className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm"><b className="text-gold">Одна тема — один эксперт.</b> Ниша + подниша + онлайн/город — занять может только один человек.</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="-rotate-3"><BusinessCard card={sample} variant="front" /></div>
          <div className="rotate-2"><BusinessCard card={sample} variant="back" /></div>
        </div>
      </section>
      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[["1", "Выберите тему", "Видно сразу, свободна ли ниша в вашем городе или онлайн."], ["2", "Оформите карту", "Фото, имя, ниша, совет и призыв — с живым превью."], ["3", "Делитесь", "PDF для печати, PNG и публичная ссылка с кнопкой «Порекомендовать»."]].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-3xl font-extrabold text-gold">{n}</div>
            <div className="mt-2 font-bold">{t}</div>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
