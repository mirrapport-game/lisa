import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s['next'] === "string" ? s['next'] : undefined }),
  head: () => ({
    meta: [
      { title: "Вход — Бизнес-колода" },
      { name: "description", content: "Войдите, чтобы создать свою карту эксперта." },
      { property: "og:title", content: "Вход — Бизнес-колода" },
      { property: "og:description", content: "Войдите, чтобы создать свою карту эксперта." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/my");
const input = "min-h-12 w-full rounded-xl border border-input bg-secondary px-4 outline-none focus:border-gold";

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ href: safeNext(next) }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ href: safeNext(next) }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("Неверный email или пароль");
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + safeNext(next), data: { full_name: name } },
      });
      if (error) toast.error(error.message); else setSent(true);
    }
    setBusy(false);
  };

  const google = async () => {
    sessionStorage.setItem("after-auth", safeNext(next));
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Не удалось войти через Google");
  };
  useEffect(() => {
    const stored = sessionStorage.getItem("after-auth");
    if (!stored) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { sessionStorage.removeItem("after-auth"); navigate({ href: safeNext(stored) }); }
    });
  }, [navigate]);

  return (
    <main className="mx-auto max-w-md px-4 py-12 font-sans">
      <h1 className="text-3xl font-extrabold">{mode === "in" ? "Вход" : "Регистрация"}</h1>
      <p className="mt-1 text-muted-foreground">Чтобы создать и сохранить свою карту.</p>
      {sent ? (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-gold/10 p-5">Проверьте почту <b>{email}</b> и подтвердите адрес — после этого вы сразу попадёте в приложение.</div>
      ) : (
        <>
          <button onClick={google} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Continue with Google
          </button>
          <div className="my-5 text-center text-xs text-muted-foreground">или по email</div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && <input className={input} placeholder="Имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} />}
            <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={input} type="password" required minLength={6} placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button disabled={busy} className="min-h-12 w-full rounded-xl bg-gold font-bold text-deck disabled:opacity-50">{mode === "in" ? "Войти" : "Зарегистрироваться"}</button>
          </form>
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-gold underline">
            {mode === "in" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </>
      )}
    </main>
  );
}
