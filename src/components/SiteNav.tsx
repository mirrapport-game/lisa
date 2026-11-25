import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/deck";

const linkCls = "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground";
const activeCls = { className: "rounded-lg px-3 py-2 text-sm font-semibold bg-secondary text-foreground" };

export function SiteNav() {
  const { data } = useUser();
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2">
        <Link to="/" className="mr-3 shrink-0 font-extrabold text-gold">♠ Бизнес-колода</Link>
        <Link to="/" className={linkCls} activeProps={activeCls} activeOptions={{ exact: true }}>Главная</Link>
        <Link to="/my" className={linkCls} activeProps={activeCls}>Мои карты</Link>
        <Link to="/game" className={linkCls} activeProps={activeCls}>Игра</Link>
        {data?.isAdmin && <Link to="/admin" className={linkCls} activeProps={activeCls}>Модерация</Link>}
        <div className="flex-1" />
        {data ? (
          <button className={linkCls} onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Выйти</button>
        ) : (
          <Link to="/auth" search={{ next: undefined }} className={linkCls}>Войти</Link>
        )}
      </div>
    </nav>
  );
}
