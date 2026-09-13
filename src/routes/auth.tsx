import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ScanLine, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PRODUCTION_AUTH_URL = "https://posdemovin.netlify.app/auth?invite=1";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Masuk — Cafe Flow" },
      { name: "description", content: "Masuk ke Cafe Flow menggunakan akun yang telah dibuat oleh administrator atau owner." },
      { property: "og:title", content: "Masuk — Cafe Flow" },
      { property: "og:description", content: "Masuk ke dashboard Cafe Flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function isAccountInvite(user: { user_metadata?: Record<string, unknown> } | null) {
  return user?.user_metadata?.staff_invite === "true" || user?.user_metadata?.account_invite === "true";
}

function isOwnerInvite(user: { user_metadata?: Record<string, unknown> } | null) {
  return user?.user_metadata?.assigned_role === "owner";
}

function AuthPage() {
  const navigate = useNavigate();
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteModeResolved, setInviteModeResolved] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [inviteSession, setInviteSession] = useState(false);
  const [ownerInvite, setOwnerInvite] = useState(false);

  useEffect(() => {
    setInviteMode(new URLSearchParams(window.location.search).get("invite") === "1");
    setInviteModeResolved(true);
  }, []);

  useEffect(() => {
    if (!inviteModeResolved) return;
    let active = true;

    const handleSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active) return;
      const accountInvite = isAccountInvite(session?.user ?? null);
      const shouldActivate = inviteMode || accountInvite;

      if (shouldActivate) {
        const owner = isOwnerInvite(session?.user ?? null);
        setInviteMode(true);
        setInviteSession(Boolean(session));
        setOwnerInvite(owner);
        setEmail(session?.user.email ?? "");
        setCheckingSession(false);
        return;
      }

      if (session) {
        const { data: profile } = await supabase
          .from("staff_profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        navigate({ to: profile?.role === "super_admin" ? "/pegawai" : "/dashboard", replace: true });
        return;
      }
      setCheckingSession(false);
    };

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      await handleSession(data.session);
    };
    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleSession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [inviteMode, inviteModeResolved, navigate]);

  async function handleInvitePassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password minimal 8 karakter");
    if (password !== confirmPassword) return toast.error("Konfirmasi password tidak sama");

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { staff_invite: "false", account_invite: "false" },
      });
      if (error) throw error;
      toast.success(`${ownerInvite ? "Akun owner" : "Akun staff"} berhasil diaktifkan. Silakan masuk ke Cafe Flow.`);
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Berhasil masuk");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email atau password salah");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession || !inviteModeResolved) {
    return <div className="grid min-h-screen place-items-center bg-sidebar px-4"><div className="text-sm text-sidebar-foreground/70">Memuat Cafe Flow…</div></div>;
  }

  if (inviteMode) {
    return (
      <div className="grid min-h-screen place-items-center bg-sidebar px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <Link to="/" className="flex items-center justify-center gap-2.5"><div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ScanLine className="size-5" /></div><span className="font-display text-xl font-semibold text-sidebar-foreground">Cafe Flow</span></Link>
          <Card>
            <CardHeader>
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><MailCheck className="size-6" /></div>
              <CardTitle className="text-center">Aktivasi akun {ownerInvite ? "owner" : "staff"}</CardTitle>
              <CardDescription className="text-center">{inviteSession ? `Undangan berhasil diterima. Buat password ${ownerInvite ? "owner" : "staff"} terlebih dahulu sebelum login.` : "Link undangan tidak aktif atau sudah kedaluwarsa. Minta administrator mengirim undangan baru."}</CardDescription>
            </CardHeader>
            <CardContent>
              {inviteSession ? (
                <form onSubmit={handleInvitePassword} className="space-y-4">
                  <div className="space-y-2"><Label>Email akun</Label><Input value={email} readOnly /></div>
                  <div className="space-y-2"><Label>Password baru</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" /></div>
                  <div className="space-y-2"><Label>Konfirmasi password</Label><Input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "Menyimpan…" : "Buat password"}</Button>
                </form>
              ) : <Button className="w-full" onClick={() => window.location.reload()}>Coba lagi</Button>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2.5"><div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ScanLine className="size-5" /></div><span className="font-display text-xl font-semibold text-sidebar-foreground">Cafe Flow</span></Link>
        <Card>
          <CardHeader><CardTitle>Masuk ke Cafe Flow</CardTitle><CardDescription>Gunakan akun yang sudah dibuat oleh administrator atau owner.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@cafe.com" /></div>
              <div className="space-y-2"><Label htmlFor="password">Kata sandi</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Memproses…" : "Masuk"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
