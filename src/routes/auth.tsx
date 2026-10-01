import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Coffee, Eye, LockKeyhole, Mail, MailCheck, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Masuk — Cafe Flow" },
    { name: "description", content: "Masuk ke Cafe Flow menggunakan akun yang telah dibuat oleh administrator atau owner." },
    { property: "og:title", content: "Masuk — Cafe Flow" },
    { property: "og:description", content: "Masuk ke dashboard Cafe Flow." },
    { property: "og:type", content: "website" },
  ] }),
  component: AuthPage,
});

function isAccountInvite(user: { user_metadata?: Record<string, unknown> } | null) {
  return user?.user_metadata?.staff_invite === "true" || user?.user_metadata?.account_invite === "true";
}
function isOwnerInvite(user: { user_metadata?: Record<string, unknown> } | null) {
  return user?.user_metadata?.assigned_role === "owner";
}

function AnimatedBarista() {
  return (
    <div className="relative mx-auto mt-3 w-full max-w-[560px]">
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-3xl" />
      <svg viewBox="0 0 560 500" className="relative z-10 w-full overflow-visible" aria-label="Animated barista" role="img">
        <defs>
          <linearGradient id="cfSkin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6c9a5"/><stop offset="1" stopColor="#c77d58"/></linearGradient>
          <linearGradient id="cfApron" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#96613d"/><stop offset="1" stopColor="#4a2b1c"/></linearGradient>
        </defs>
        <g className="cf-person">
          <ellipse cx="280" cy="465" rx="170" ry="20" fill="#000" opacity=".4"/>
          <path d="M145 470c8-105 40-174 135-174s127 69 135 174H145Z" fill="#171717"/>
          <path d="M195 305h170l28 165H167l28-165Z" fill="url(#cfApron)"/>
          <path d="M235 284h90l12 43h-114l12-43Z" fill="url(#cfSkin)"/>
          <ellipse cx="280" cy="205" rx="93" ry="103" fill="url(#cfSkin)"/>
          <path d="M191 195c-6-92 49-123 103-112 65 13 91 58 76 118-27-37-53-52-89-48-36 4-62 22-90 42Z" fill="#1b1716"/>
          <path d="M206 152c30-62 103-75 150-27-44-13-63 20-93 27-24 6-42 7-57 0Z" fill="#30231e"/>
          <g className="cf-blink"><ellipse cx="248" cy="210" rx="7" ry="5" fill="#3a241d"/><ellipse cx="313" cy="210" rx="7" ry="5" fill="#3a241d"/></g>
          <path d="M238 194q11-8 23 0M302 194q11-8 23 0" fill="none" stroke="#5c3327" strokeWidth="5" strokeLinecap="round"/>
          <path d="M260 245q20 14 40 0" fill="none" stroke="#9c4d42" strokeWidth="4" strokeLinecap="round"/>
          <path d="M157 333c-42 24-47 82-4 105 24 13 50 1 65-28l39-67-31-27-30 40-18-23Z" fill="url(#cfSkin)"/>
          <g className="cf-arm">
            <path d="M366 332c49-11 81 22 78 65-3 34-30 48-56 30l-50-48 28-47Z" fill="url(#cfSkin)"/>
            <ellipse cx="429" cy="392" rx="27" ry="18" fill="url(#cfSkin)"/>
            <g transform="translate(397 315)">
              <path d="M0 12q43-28 77 2l-19 55q-38 15-64-14Z" fill="#292929" stroke="#d6a06b" strokeWidth="4"/>
              <path d="M67 19q30-2 40 18" fill="none" stroke="#d6a06b" strokeWidth="7" strokeLinecap="round"/>
              <path d="M12 18q-17-37 4-49" fill="none" stroke="#d6a06b" strokeWidth="7" strokeLinecap="round"/>
            </g>
          </g>
          <path d="M237 405h88l-9 60h-70l-9-60Z" fill="#eee7df"/>
          <path d="M247 401h68l-14 29h-40l-14-29Z" fill="#4b3021"/>
          <g fill="none" stroke="#fff" strokeLinecap="round" opacity=".5">
            <path d="M266 401q-20-28 0-50t0-45" strokeWidth="6" className="cf-steam"/>
            <path d="M293 399q22-28 2-51t2-44" strokeWidth="5" className="cf-steam cf-delay"/>
          </g>
        </g>
      </svg>
      <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs text-white/60 backdrop-blur-xl">
        <Sparkles className="size-3.5 text-amber-300" /> Built for better coffee businesses
      </div>
    </div>
  );
}

function LoginCard({ email, password, loading, setEmail, setPassword, onSubmit }: {
  email: string; password: string; loading: boolean; setEmail: (v: string) => void; setPassword: (v: string) => void; onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Card className="cf-login-card border-white/10 bg-black/45 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <CardHeader className="space-y-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-amber-300 text-neutral-950"><Coffee className="size-5"/></div>
          <div><div className="font-display text-lg font-semibold text-white">Coffee Flow</div><div className="text-xs text-white/40">POS & QR Ordering</div></div>
        </div>
        <div><CardTitle className="text-3xl font-semibold tracking-tight text-white">Welcome back.</CardTitle><CardDescription className="mt-2 text-sm leading-6 text-white/55">Masuk untuk mengelola bisnis coffee shop kamu.</CardDescription></div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="email" className="text-white/75">Email</Label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35"/><Input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@cafe.com" className="h-12 border-white/10 bg-white/[0.045] pl-10 text-white placeholder:text-white/25 focus-visible:border-amber-300/60 focus-visible:ring-amber-300/15"/></div></div>
          <div className="space-y-2"><Label htmlFor="password" className="text-white/75">Kata sandi</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35"/><Input id="password" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="h-12 border-white/10 bg-white/[0.045] pl-10 pr-10 text-white placeholder:text-white/25 focus-visible:border-amber-300/60 focus-visible:ring-amber-300/15"/><Eye className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/25"/></div></div>
          <Button type="submit" className="group h-12 w-full rounded-xl bg-amber-300 font-semibold text-neutral-950 shadow-lg shadow-amber-300/10 hover:bg-amber-200" disabled={loading}>{loading?"Memproses…":"Masuk"}{!loading&&<ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1"/>}</Button>
          <p className="text-center text-xs leading-5 text-white/35">Gunakan akun yang sudah dibuat oleh administrator atau owner.</p>
        </form>
      </CardContent>
    </Card>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [inviteMode,setInviteMode]=useState(false), [inviteModeResolved,setInviteModeResolved]=useState(false);
  const [email,setEmail]=useState(""), [password,setPassword]=useState(""), [confirmPassword,setConfirmPassword]=useState("");
  const [loading,setLoading]=useState(false), [checkingSession,setCheckingSession]=useState(true), [inviteSession,setInviteSession]=useState(false), [ownerInvite,setOwnerInvite]=useState(false);

  useEffect(()=>{setInviteMode(new URLSearchParams(window.location.search).get("invite")==="1");setInviteModeResolved(true)},[]);
  useEffect(()=>{
    if(!inviteModeResolved)return; let active=true;
    const handleSession=async(session:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{
      if(!active)return;
      const accountInvite=isAccountInvite(session?.user??null), shouldActivate=inviteMode||accountInvite;
      if(shouldActivate){const owner=isOwnerInvite(session?.user??null);setInviteMode(true);setInviteSession(Boolean(session));setOwnerInvite(owner);setEmail(session?.user.email??"");setCheckingSession(false);return}
      if(session){const {data:profile}=await supabase.from("staff_profiles").select("role").eq("user_id",session.user.id).maybeSingle();navigate({to:profile?.role==="super_admin"?"/admin":"/dashboard",replace:true});return}
      setCheckingSession(false);
    };
    void supabase.auth.getSession().then(({data})=>handleSession(data.session));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{void handleSession(session)});
    return()=>{active=false;listener.subscription.unsubscribe()};
  },[inviteMode,inviteModeResolved,navigate]);

  async function handleInvitePassword(e:FormEvent){e.preventDefault();if(password.length<8)return toast.error("Password minimal 8 karakter");if(password!==confirmPassword)return toast.error("Konfirmasi password tidak sama");setLoading(true);try{const {error}=await supabase.auth.updateUser({password,data:{staff_invite:"false",account_invite:"false"}});if(error)throw error;toast.success(`${ownerInvite?"Akun owner":"Akun staff"} berhasil diaktifkan. Silakan masuk ke Cafe Flow.`);await supabase.auth.signOut();navigate({to:"/auth",replace:true})}catch(err){toast.error(err instanceof Error?err.message:"Gagal membuat password")}finally{setLoading(false)}}
  async function handleSubmit(e:FormEvent){e.preventDefault();setLoading(true);try{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(data.user){const {data:profile}=await supabase.from("staff_profiles").select("owner_id").eq("user_id",data.user.id).maybeSingle();await supabase.from("audit_logs").insert({owner_id:profile?.owner_id??data.user.id,actor_user_id:data.user.id,action:"auth.login",entity_type:"auth",entity_id:data.user.id,details:{method:"password"}})}toast.success("Berhasil masuk")}catch(err){toast.error(err instanceof Error?err.message:"Email atau password salah")}finally{setLoading(false)}}

  if(checkingSession||!inviteModeResolved)return <div className="grid min-h-screen place-items-center bg-[#090909] text-white"><div className="cf-loader text-sm text-white/55">Memuat Cafe Flow…</div></div>;

  if(inviteMode)return <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090909] px-4 py-10 text-white"><style>{authAnimationCss}</style><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.12),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(120,53,15,.12),transparent_35%)]"/><div className="relative z-10 w-full max-w-sm"><Link to="/" className="mb-6 flex items-center justify-center gap-2.5"><div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-neutral-950"><ScanLine className="size-5"/></div><span className="font-display text-xl font-semibold">Cafe Flow</span></Link><Card className="border-white/10 bg-black/50 text-white shadow-2xl backdrop-blur-2xl"><CardHeader><div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-amber-300/10 text-amber-300"><MailCheck className="size-6"/></div><CardTitle className="text-center text-white">Aktivasi akun {ownerInvite?"owner":"staff"}</CardTitle><CardDescription className="text-center text-white/50">{inviteSession?`Undangan berhasil diterima. Buat password ${ownerInvite?"owner":"staff"} terlebih dahulu sebelum login.`:"Link undangan tidak aktif atau sudah kedaluwarsa. Minta administrator mengirim undangan baru."}</CardDescription></CardHeader><CardContent>{inviteSession?<form onSubmit={handleInvitePassword} className="space-y-4"><div className="space-y-2"><Label>Email akun</Label><Input value={email} readOnly className="border-white/10 bg-white/[0.04] text-white"/></div><div className="space-y-2"><Label>Password baru</Label><Input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter" className="border-white/10 bg-white/[0.04] text-white"/></div><div className="space-y-2"><Label>Konfirmasi password</Label><Input type="password" required minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Ulangi password" className="border-white/10 bg-white/[0.04] text-white"/></div><Button type="submit" className="w-full bg-amber-300 text-neutral-950 hover:bg-amber-200" disabled={loading}>{loading?"Menyimpan…":"Buat password"}</Button></form>:<Button className="w-full bg-amber-300 text-neutral-950 hover:bg-amber-200" onClick={()=>window.location.reload()}>Coba lagi</Button>}</CardContent></Card></div></div>;

  return <div className="relative min-h-screen overflow-hidden bg-[#090909] text-white"><style>{authAnimationCss}</style><div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_35%,rgba(245,158,11,.12),transparent_28%),radial-gradient(circle_at_82%_65%,rgba(120,53,15,.1),transparent_32%)]"/><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:56px_56px]"/><div className="relative z-10 mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden min-h-screen flex-col justify-center px-8 py-12 lg:flex xl:px-16"><div className="absolute left-10 top-10 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-amber-300 text-neutral-950"><ScanLine className="size-5"/></div><div><div className="font-display text-xl font-semibold">Coffee Flow</div><div className="text-xs text-white/40">Better Coffee. Smoother Business.</div></div></div><div className="mx-auto w-full max-w-2xl"><div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.28em] text-amber-300/75"><span className="size-1.5 rounded-full bg-amber-300 cf-pulse"/>Your coffee business, in flow</div><h1 className="max-w-xl font-display text-4xl font-semibold leading-tight tracking-tight text-white xl:text-6xl">Run the cafe.<br/><span className="text-amber-200">Not the chaos.</span></h1><p className="mt-5 max-w-lg text-base leading-7 text-white/45">POS, QR Ordering, inventory, reports, and everything your coffee business needs.</p><AnimatedBarista/></div><div className="absolute bottom-10 left-10 right-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/35 xl:left-16 xl:right-16"><span>POS</span><span>QR Ordering</span><span>Insight & Reports</span><span>© Cafe Flow</span></div></section>
    <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-20"><div className="w-full max-w-md"><div className="mb-7 lg:hidden"><Link to="/" className="flex items-center gap-2.5"><div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-neutral-950"><ScanLine className="size-5"/></div><div><div className="font-display text-lg font-semibold">Coffee Flow</div><div className="text-[11px] text-white/35">POS & QR Ordering</div></div></Link></div><LoginCard email={email} password={password} loading={loading} setEmail={setEmail} setPassword={setPassword} onSubmit={handleSubmit}/><Link to="/demo" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 text-sm font-semibold text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-300/15">Coba Versi Demo (Tanpa Login)</Link><p className="mt-6 text-center text-xs text-white/25">Secure access · Cafe Flow</p></div></section>
  </div></div>;
}

const authAnimationCss=`
@keyframes cf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes cf-arm{0%,100%{transform:rotate(0deg);transform-origin:380px 350px}50%{transform:rotate(-4deg);transform-origin:380px 350px}}
@keyframes cf-blink{0%,45%,49%,100%{transform:scaleY(1)}47%{transform:scaleY(.08)}}
@keyframes cf-steam{0%{opacity:0;transform:translateY(7px)}25%{opacity:.5}70%{opacity:.15}100%{opacity:0;transform:translateY(-22px)}}
@keyframes cf-card{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes cf-pulse{0%,100%{opacity:.4;box-shadow:0 0 0 0 rgba(252,211,77,.1)}50%{opacity:1;box-shadow:0 0 0 7px rgba(252,211,77,0)}}
@keyframes cf-loader{0%,100%{opacity:.4}50%{opacity:1}}
.cf-person{animation:cf-float 5s ease-in-out infinite;transform-origin:280px 300px}
.cf-arm{animation:cf-arm 4s ease-in-out infinite}
.cf-blink{animation:cf-blink 5.2s ease-in-out infinite;transform-origin:center}
.cf-steam{animation:cf-steam 2.7s ease-in-out infinite;transform-origin:center bottom}
.cf-delay{animation-delay:1.05s}
.cf-login-card{animation:cf-card .7s cubic-bezier(.22,1,.36,1) both}
.cf-pulse{animation:cf-pulse 2.4s ease-in-out infinite}
.cf-loader{animation:cf-loader 1.2s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.cf-person,.cf-arm,.cf-blink,.cf-steam,.cf-login-card,.cf-pulse,.cf-loader{animation:none!important}}
`;
