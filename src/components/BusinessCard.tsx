import { QRCodeSVG } from "qrcode.react";
import { forwardRef } from "react";
import { usePhotoUrl, type CardRow } from "@/lib/deck";

export type CardData = Pick<
  CardRow,
  "first_name" | "last_name" | "photo_url" | "headline" | "advice_title" | "advice_text" | "cta" | "qr_target_url" | "deck_issue"
> & { topicLabel?: string | undefined; place?: string | undefined };

type Props = { card: CardData; variant: "front" | "back"; size?: "preview" | "print"; photoOverride?: string | null };

/** 85×55 mm business-card format. Same component for preview, public profile and export. */
export const BusinessCard = forwardRef<HTMLDivElement, Props>(function BusinessCard({ card, variant, size = "preview", photoOverride }, ref) {
  const signed = usePhotoUrl(card.photo_url);
  const photo = photoOverride ?? signed;
  const w = size === "print" ? 1004 : 340; // 85mm @ 300dpi ≈ 1004px
  const scale = w / 340;
  const name = `${card.first_name} ${card.last_name}`.trim() || "Имя Фамилия";
  const issue = card.deck_issue ? `Выпуск №${card.deck_issue}` : "Бизнес-колода";
  return (
    <div ref={ref} style={{ width: w, height: (w * 55) / 85 }} className="relative shrink-0 overflow-hidden rounded-[14px] bg-deck text-deck-foreground shadow-card">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 340, height: 220 }} className="relative p-4">
        <div className="pointer-events-none absolute inset-0 bg-deck-glow" />
        {variant === "front" ? (
          <div className="relative flex h-full gap-3">
            <div className="h-full w-[118px] shrink-0 overflow-hidden rounded-[10px] bg-deck-muted">
              {photo ? <img src={photo} alt={name} crossOrigin="anonymous" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl text-gold">{name[0]}</div>}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-gold">{issue}</div>
              <div className="mt-2 text-[19px] font-extrabold leading-tight">{name}</div>
              <div className="mt-1.5 text-[12px] font-semibold leading-snug text-gold">{card.headline || "Ваша ниша"}</div>
              {(card.topicLabel || card.place) && <div className="mt-1 text-[9px] text-deck-soft">{[card.topicLabel, card.place].filter(Boolean).join(" · ")}</div>}
              <div className="mt-auto flex items-end justify-between">
                <span className="text-[8px] text-deck-soft">Одна тема — один эксперт</span>
                {card.qr_target_url && <div className="rounded-md bg-deck-foreground p-1"><QRCodeSVG value={card.qr_target_url} size={46} /></div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex h-full flex-col">
            <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-gold">Совет за 15 секунд</div>
            <div className="mt-1.5 text-[14px] font-extrabold leading-tight">{card.advice_title || "Заголовок совета"}</div>
            <p className="mt-1.5 text-[9.5px] leading-snug text-deck-soft">{card.advice_text || "Текст совета до 280 символов."}</p>
            <div className="mt-auto flex items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-gold">{card.cta || "Спроси меня про…"}</div>
                <div className="mt-1 text-[8px] text-deck-soft">{issue} · #бизнесколода</div>
              </div>
              {card.qr_target_url && <div className="rounded bg-deck-foreground p-0.5"><QRCodeSVG value={card.qr_target_url} size={30} /></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
