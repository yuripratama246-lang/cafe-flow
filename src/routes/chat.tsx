import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, RefreshCw, Trash2, TrainFront, Coffee, CircleHelp, Clock3, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Thread = { id: string; owner_id: string; table_id: string; table_code: string; table_name: string; customer_name: string; status: "open" | "closed"; last_message_at: string; created_at: string };
type ChatMessage = { id: string; sender_role: "customer" | "cashier"; body: string; created_at: string };
export const Route = createFileRoute("/chat")({ component: CashierChatPage });

function CashierChatPage() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const tableCode = params.get("table") ?? "";
  const isCustomer = Boolean(tableCode);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadThreads() {
    const { data, error } = await supabase.from("cashier_chat_threads").select("*").order("last_message_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data ?? []) as Thread[];
    setThreads(rows);
    if (!activeId && rows[0]) setActiveId(rows[0].id);
  }
  async function loadMessages(id: string) {
    const { data, error } = await supabase.from("cashier_chat_messages").select("id,sender_role,body,created_at").eq("thread_id", id).order("created_at").limit(300);
    if (error) throw error;
    setMessages((data ?? []) as ChatMessage[]);
  }

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        if (isCustomer) {
          const key = `km-chat:${tableCode}`;
          let saved: { token: string; threadId: string } | null = null;
          try { saved = JSON.parse(sessionStorage.getItem(key) ?? "null"); } catch { /* ignore stale session */ }
          if (saved?.token && saved.threadId) {
            setToken(saved.token); setActiveId(saved.threadId);
            const { data } = await supabase.rpc("read_public_cashier_chat", { p_access_token: saved.token });
            if (alive && data) setMessages(data as ChatMessage[]);
          } else {
            const { data, error } = await supabase.rpc("create_public_cashier_chat", { p_table_code: tableCode, p_customer_name: name.trim() || "Customer" });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row?.access_token || !row?.thread_id) throw new Error("Sesi chat gagal dibuat.");
            sessionStorage.setItem(key, JSON.stringify({ token: row.access_token, threadId: row.thread_id }));
            if (alive) { setToken(row.access_token); setActiveId(row.thread_id); }
          }
        } else {
          await loadThreads();
        }
      } catch (e) { if (alive) toast.error(e instanceof Error ? e.message : "Chat gagal dimuat"); }
      finally { if (alive) setLoading(false); }
    }
    void init();
    return () => { alive = false; };
  }, [tableCode]);

  useEffect(() => {
    if (isCustomer) {
      if (!token) return;
      const timer = window.setInterval(async () => {
        const { data } = await supabase.rpc("read_public_cashier_chat", { p_access_token: token });
        if (data) setMessages(data as ChatMessage[]);
      }, 2500);
      return () => window.clearInterval(timer);
    }
    const timer = window.setInterval(() => { void loadThreads().catch(() => undefined); if (activeId) void loadMessages(activeId).catch(() => undefined); }, 2500);
    const channel = supabase.channel("cashier-chat-live").on("postgres_changes", { event: "*", schema: "public", table: "cashier_chat_messages" }, () => { void loadThreads().catch(() => undefined); if (activeId) void loadMessages(activeId).catch(() => undefined); }).subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [isCustomer, token, activeId]);

  useEffect(() => { if (!isCustomer && activeId) { void loadMessages(activeId).catch(e => toast.error(e instanceof Error ? e.message : "Pesan gagal dimuat")); setThread(threads.find(t => t.id === activeId) ?? null); } }, [activeId, isCustomer, threads]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function deleteChat() {
    if (isCustomer || !activeId || sending) return;
    const selected = threads.find((item) => item.id === activeId);
    if (!selected) return;
    const confirmed = window.confirm(`Hapus chat ${selected.table_name} · QR ${selected.table_code}? Semua pesan dalam percakapan ini akan dihapus. Data pesanan tidak terpengaruh.`);
    if (!confirmed) return;
    setSending(true);
    try {
      const { error } = await supabase.from("cashier_chat_threads").delete().eq("id", activeId);
      if (error) throw error;
      const remaining = threads.filter((item) => item.id !== activeId);
      setThreads(remaining);
      setActiveId(remaining[0]?.id ?? "");
      setThread(null);
      setMessages([]);
      toast.success("Chat lama berhasil dihapus.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat gagal dihapus");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending) return;
    if (isCustomer && !token) { toast.error("Sesi chat belum siap. Muat ulang halaman lalu coba lagi."); return; }
    if (!isCustomer && !activeId) { toast.error("Pilih percakapan meja terlebih dahulu."); return; }
    setSending(true);
    try {
      const { data: sentId, error } = isCustomer
        ? await supabase.rpc("send_public_cashier_chat", { p_access_token: token, p_body: body })
        : await supabase.rpc("send_cashier_chat", { p_thread_id: activeId, p_body: body });
      if (error) throw error;
      if (!sentId) throw new Error("Pesan belum tersimpan. Coba kirim lagi.");
      setDraft("");
      if (isCustomer) {
        const { data, error: readError } = await supabase.rpc("read_public_cashier_chat", { p_access_token: token });
        if (readError) throw readError;
        if (data) setMessages(data as ChatMessage[]);
      } else {
        await Promise.all([loadMessages(activeId), loadThreads()]);
      }
      toast.success("Pesan terkirim ke kasir.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pesan gagal dikirim");
    } finally {
      setSending(false);
    }
  }

  if (isCustomer) return <main className="qr-customer-chat min-h-screen">
    <div className="qr-chat-shell mx-auto flex min-h-screen w-full max-w-xl flex-col">
      <header className="qr-chat-header">
        <div className="flex items-center gap-3">
          <span className="qr-chat-brand-icon"><TrainFront className="size-6" /></span>
          <div className="min-w-0 flex-1"><p className="qr-chat-kicker">KERETA MALAM CAFE</p><h1 className="text-lg font-bold">Chat dengan Kasir</h1><p className="qr-chat-subtitle">QR Meja {tableCode} <span className="mx-1.5 opacity-40">•</span> Tanya atau minta bantuan</p></div>
          <span className="qr-chat-live-pill"><span className="qr-chat-live-dot" />Chat aktif</span>
        </div>
      </header>
      <div className="qr-chat-notice"><span className="qr-chat-notice-icon"><Coffee className="size-4" /></span><div><p className="font-semibold">Ada yang bisa kami bantu?</p><p className="mt-0.5 text-xs leading-5">Tanyakan menu, ketersediaan makanan, atau sampaikan permintaan khusus. Kasir akan membalas di ruang chat ini.</p></div></div>
      <section className="qr-chat-messages flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Percakapan dengan kasir">
        {messages.length===0&&!loading&&<div className="qr-chat-empty"><span className="qr-chat-empty-icon"><MessageCircle className="size-6" /></span><h2 className="mt-3 font-semibold">Mulai percakapan</h2><p className="mt-1 max-w-[250px] text-sm leading-6">Pesan kamu akan langsung masuk ke ruang chat kasir.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" className="qr-chat-suggestion" onClick={()=>setDraft("Menu ini masih tersedia?")}>Cek ketersediaan menu</button><button type="button" className="qr-chat-suggestion" onClick={()=>setDraft("Boleh minta bantuan kasir?")}>Minta bantuan</button><button type="button" className="qr-chat-suggestion" onClick={()=>setDraft("Saya ingin mengubah pesanan.")}>Ubah pesanan</button></div></div>}
        {loading&&messages.length===0&&<div className="qr-chat-loading"><span className="qr-chat-loading-dot"/><span className="qr-chat-loading-dot"/><span className="qr-chat-loading-dot"/><p className="mt-3 text-sm">Menyiapkan ruang chat...</p></div>}
        {messages.map(m=><div key={m.id} className={`flex items-end gap-2 ${m.sender_role==="customer"?"justify-end":"justify-start"}`}>
          {m.sender_role!=="customer"&&<span className="qr-chat-avatar cashier"><Coffee className="size-4" /></span>}
          <div className={`qr-chat-bubble ${m.sender_role==="customer"?"customer":"cashier"}`}><p className="qr-chat-sender">{m.sender_role==="customer"?"Kamu":"Kasir Kereta Malam"}</p><p className="whitespace-pre-wrap break-words leading-6">{m.body}</p><div className="qr-chat-message-meta"><span>{new Date(m.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span>{m.sender_role==="customer"&&<CheckCheck className="size-3.5" />}</div></div>
          {m.sender_role==="customer"&&<span className="qr-chat-avatar customer-avatar">K</span>}
        </div>)}
        <div ref={bottomRef} />
      </section>
      <footer className="qr-chat-composer-wrap">
        <form className="qr-chat-composer" onSubmit={e=>{e.preventDefault();void sendMessage();}}>
          <Input className="qr-chat-input" type="text" enterKeyHint="send" autoComplete="off" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Tulis pesan kamu..." maxLength={2000} disabled={sending||loading} aria-label="Tulis pesan ke kasir" />
          <Button className="qr-chat-send" type="submit" disabled={sending||!draft.trim()||loading} aria-label="Kirim pesan">{sending?<Clock3 className="size-5 animate-pulse"/>:<Send className="size-5"/>}</Button>
        </form>
        <p className="qr-chat-footnote"><CircleHelp className="mr-1 inline size-3.5" />Jangan kirim data pembayaran atau informasi pribadi sensitif.</p>
      </footer>
    </div>
  </main>;

  return <AppShell title="Chat Customer" description="Percakapan langsung pelanggan dan kasir">
    <div className="grid min-h-[65vh] gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Meja / percakapan</h2><Button variant="ghost" size="icon" onClick={() => void loadThreads()}><RefreshCw className="size-4" /></Button></div>
      {loading ? <p className="p-3 text-sm text-muted-foreground">Memuat chat...</p> : threads.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Belum ada pesan masuk.</p> : <div className="space-y-1">{threads.map(t => <button key={t.id} onClick={() => setActiveId(t.id)} className={`w-full rounded-lg border p-3 text-left ${activeId === t.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}><div className="flex justify-between gap-2"><strong className="text-sm">{t.table_name} · QR {t.table_code}</strong><span className="text-[10px] text-muted-foreground">{new Date(t.last_message_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span></div><p className="text-xs text-muted-foreground">{t.customer_name} · {t.status === "open" ? "Aktif" : "Ditutup"}</p></button>)}</div>}
      </aside>
      <section className="flex min-h-[55vh] flex-col rounded-xl border p-3">
        <header className="flex items-start justify-between gap-3 border-b pb-3"><div><h2 className="font-semibold">{thread?.table_name ?? threads.find(t => t.id === activeId)?.table_name ?? "Pilih percakapan"}</h2><p className="text-sm text-muted-foreground">{thread?.table_code ?? threads.find(t => t.id === activeId)?.table_code ? `Nomor QR: ${thread?.table_code ?? threads.find(t => t.id === activeId)?.table_code}` : "Setiap pesan menampilkan nomor meja dan QR"}</p></div><Button type="button" variant="destructive" size="sm" disabled={!activeId || sending} onClick={() => void deleteChat()}><Trash2 className="mr-2 size-4" />Hapus chat</Button></header>
        <div className="flex-1 space-y-3 overflow-y-auto py-4">{messages.map(m => <div key={m.id} className={`flex ${m.sender_role === "cashier" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_role === "cashier" ? "bg-primary text-primary-foreground" : "bg-muted"}`}><p className="mb-1 text-[10px] opacity-70">{m.sender_role === "cashier" ? "Kasir" : "Customer"} · QR {threads.find(t => t.id === activeId)?.table_code ?? "—"}</p>{m.body}<p className="mt-1 text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p></div></div>)}<div ref={bottomRef} /></div>
        <form className="flex gap-2 border-t pt-3" onSubmit={e => { e.preventDefault(); void sendMessage(); }}><Input type="text" enterKeyHint="send" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Balas pesan pelanggan..." maxLength={2000} disabled={!activeId || sending} /><Button type="submit" disabled={!activeId || sending || !draft.trim()}><Send className="mr-2 size-4" />{sending ? "Mengirim..." : "Balas"}</Button></form>
      </section>
    </div>
  </AppShell>;
}
