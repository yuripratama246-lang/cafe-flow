import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ScanLine, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk Kasir — Cafe Flow" },
      { name: "description", content: "Masuk ke dashboard Cafe Flow untuk mengelola penjualan, produk, dan pesanan." },
      { property: "og:title", content: "Masuk Kasir — Cafe Flow" },
      { property: "og:description", content: "Masuk ke dashboard Cafe Flow untuk mengelola penjualan dan pesanan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteModeResolved, setInviteModeResolved] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [inviteSession, setInviteSession] = useState(false);

  // Read browser-only URL state after hydration. Never touch window during SSR.
  useEffect(() => {
    setInviteMode(new URLSearchParams(window.location.search).get("invite") === "1");
    setInviteModeResolved(true);
  }, []);

  useEffect(() => {
    if (!inviteModeResolved) return;

    let active = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (inviteMode) {
        setInviteSession(Boolean(data.session));
        setEmail(data.session?.user.email ?? "");
        setCheckingSession(false);
        return;
      }

      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setCheckingSession(false);
    };

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (inviteMode) {
        setInviteSession(Boolean(session));
        if (session?.user.email) setEmail(session.user.email);
        setCheckingSession(false);
      } else if (session) {
        navigate({ to: "/dashboard", replace: true });
      }
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password berhasil dibuat. Selamat datang di Cafe Flow!");
      navigate({ to: "/dashboard", replace: true });
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
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "https://posdemovin.netlify.app/auth" },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Akun dibuat. Cek email Anda untuk konfirmasi.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: "https://posdemovin.netlify.app",
    });
    if (result.error) {
      toast.error("Gagal masuk dengan Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  if (checkingSession || !inviteModeResolved) {
    return (
      <div className="grid min-h-screen place-items-center bg-sidebar px-4">
        <div className="text-sm text-sidebar-foreground/70">Memuat Cafe Flow…</div>
      </div>
    );
  }

  if (inviteMode) {
    return (
      <div className="grid min-h-screen place-items-center bg-sidebar px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <Link to="/" className="flex items-center justify-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <ScanLine className="size-5" />
            </div>
            <span className="font-display text-xl font-semibold text-sidebar-foreground">Cafe Flow</span>
          </Link>

          <Card>
            <CardHeader>
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-6" />
              </div>
              <CardTitle className="text-center">Aktivasi akun staff</CardTitle>
              <CardDescription className="text-center">
                {inviteSession
                  ? "Undangan berhasil diterima. Buat password untuk akun kasir Anda."
                  : "Link undangan tidak aktif atau sudah kedaluwarsa. Minta owner mengirim undangan baru."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inviteSession ? (
                <form onSubmit={handleInvitePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email akun</Label>
                    <Input value={email} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Password baru</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Konfirmasi password</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Menyimpan…" : "Buat password & masuk"}
                  </Button>
                </form>
              ) : (
                <Button className="w-full" onClick={() => window.location.reload()}>
                  Coba lagi
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ScanLine className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold text-sidebar-foreground">Cafe Flow</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Masuk kasir" : "Buat akun kasir"}</CardTitle>
            <CardDescription>
              {mode === "signin" ? "Gunakan akun staff untuk membuka dashboard." : "Daftarkan akun staff baru untuk outlet Anda."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kasir@kafe.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Memproses…" : mode === "signin" ? "Masuk" : "Daftar"}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle}>Lanjutkan dengan Google</Button>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Daftar" : "Masuk"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
