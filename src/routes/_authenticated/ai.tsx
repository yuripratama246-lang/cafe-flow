import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Clock3, MoreHorizontal, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai")({ component: AiPage });

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };
type AiResponse = { message?: string; error?: string };

const STORAGE_KEY = "coffee-flow-ai-chats-v2";
const STARTERS = [
  "Siapa presiden Indonesia sekarang?",
  "Analisa penjualan hari ini",
  "Jelasin kenapa langit berwarna biru",
  "Bantu gue bikin strategi promo cafe",
];

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g);
  return parts.map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={`${keyPrefix}-b${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${keyPrefix}-c${index}`} className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) return <a key={`${keyPrefix}-l${index}`} href={link[2]} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{link[1]}</a>;
    return <span key={`${keyPrefix}-t${index}`}>{part}</span>;
  });
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let list: { ordered: boolean; text: string }[] = [];
  const flushList = () => {
    if (!list.length) return;
    const ordered = list[0].ordered;
    const ListTag = ordered ? "ol" : "ul";
    nodes.push(<ListTag key={`list-${nodes.length}`} className={ordered ? "my-2 list-decimal space-y-1 pl-5" : "my-2 list-disc space-y-1 pl-5"}>{list.map((item, i) => <li key={i}>{renderInline(item.text, `li-${i}`)}</li>)}</ListTag>);
    list = [];
  };
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^(?:[-*•–—])\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) { list.push({ ordered: false, text: bullet[1] }); return; }
    if (numbered) { list.push({ ordered: true, text: numbered[1] }); return; }
    if (!trimmed) { flushList(); nodes.push(<div key={`sp-${i}`} className="h-2" />); return; }
    flushList();
    if (/^###\s+/.test(trimmed)) nodes.push(<h4 key={i} className="mt-3 font-semibold">{renderInline(trimmed.replace(/^###\s+/, ""), `h3-${i}`)}</h4>);
    else if (/^##\s+/.test(trimmed)) nodes.push(<h3 key={i} className="mt-3 text-base font-semibold">{renderInline(trimmed.replace(/^##\s+/, ""), `h2-${i}`)}</h3>);
    else if (/^#\s+/.test(trimmed)) nodes.push(<h2 key={i} className="mt-3 text-lg font-bold">{renderInline(trimmed.replace(/^#\s+/, ""), `h1-${i}`)}</h2>);
    else nodes.push(<p key={i}>{renderInline(line, `p-${i}`)}</p>);
  });
  flushList();
  return <div className="space-y-1">{nodes}</div>;
}

function makeChat(title = "Chat baru"): ChatSession {
  return { id: crypto.randomUUID(), title, messages: [], updatedAt: Date.now() };
}

function AiPage() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ChatSession[];
      if (saved.length) { setChats(saved); setActiveId(saved[0].id); }
      else { const fresh = makeChat(); setChats([fresh]); setActiveId(fresh.id); }
    } catch {
      const fresh = makeChat(); setChats([fresh]); setActiveId(fresh.id);
    }
  }, []);

  useEffect(() => { if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 30))); }, [chats]);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeId) ?? chats[0] ?? null, [chats, activeId]);
  const messages = activeChat?.messages ?? [];

  const ask = useMutation({
    mutationFn: async (nextMessages: ChatMessage[]) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30000);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Session login tidak ditemukan. Silakan login ulang.");
        const { data, error } = await supabase.functions.invoke("ai-assistant", { body: { messages: nextMessages }, headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
        if (error) throw new Error(error.message || "Gagal menghubungi AI Assistant");
        const result = data as AiResponse;
        if (result.error) throw new Error(result.error);
        return result.message ?? "AI tidak mengembalikan jawaban.";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw new Error("AI terlalu lama merespons. Coba kirim lagi.");
        throw error;
      } finally { window.clearTimeout(timeout); }
    },
    onSuccess: (reply) => setChats((current) => current.map((chat) => chat.id === activeId ? { ...chat, messages: [...chat.messages, { role: "assistant", content: reply }], updatedAt: Date.now() } : chat)),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghubungi AI Assistant"),
  });

  function newChat() {
    const fresh = makeChat();
    setChats((current) => [fresh, ...current].slice(0, 30));
    setActiveId(fresh.id); setInput(""); setShowHistory(false);
  }

  function deleteChat(id: string) {
    setChats((current) => {
      const next = current.filter((chat) => chat.id !== id);
      if (!next.length) { const fresh = makeChat(); setActiveId(fresh.id); return [fresh]; }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function selectChat(id: string) { setActiveId(id); setShowHistory(false); }

  function send(text = input) {
    const value = text.trim();
    if (!value || ask.isPending || !activeChat) return;
    const nextMessages = [...activeChat.messages, { role: "user" as const, content: value }].slice(-14);
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, title: chat.messages.length ? chat.title : value.slice(0, 42), messages: nextMessages, updatedAt: Date.now() } : chat));
    setInput(""); ask.mutate(nextMessages);
  }

  return (
    <AppShell title="AI Assistant" description="AI general-purpose yang juga memahami data Coffee Flow">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="hidden h-[calc(100vh-150px)] min-h-[520px] flex-col overflow-hidden lg:flex">
          <CardHeader className="border-b px-3 py-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-sm">Riwayat chat</CardTitle><Button size="icon" variant="ghost" className="size-8" onClick={newChat} title="Chat baru"><Plus className="size-4" /></Button></div></CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2"><div className="space-y-1">{chats.map((chat) => <div key={chat.id} className={`group flex items-center gap-1 rounded-lg p-1 ${chat.id === activeId ? "bg-muted" : "hover:bg-muted/60"}`}><button type="button" onClick={() => selectChat(chat.id)} className="min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-xs"><span className="block truncate">{chat.title}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{new Date(chat.updatedAt).toLocaleDateString("id-ID")}</span></button><Button size="icon" variant="ghost" className="size-7 opacity-0 transition group-hover:opacity-100" onClick={() => deleteChat(chat.id)} title="Hapus chat"><Trash2 className="size-3.5" /></Button></div>)}</div></CardContent>
        </Card>

        <Card className="flex min-h-[calc(100vh-150px)] flex-col overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div><div><p>Coffee Flow AI</p><p className="text-xs font-normal text-muted-foreground">Powered by Groq • Web Search • General AI</p></div></CardTitle>
              <div className="flex items-center gap-1"><Button variant="outline" size="sm" className="lg:hidden" onClick={newChat}><Plus className="mr-1.5 size-4" />Chat baru</Button><Button variant={showHistory ? "secondary" : "ghost"} size="icon" className="lg:hidden" title="Riwayat chat" onClick={() => setShowHistory((value) => !value)}><Clock3 className="size-4" /></Button><Button variant="ghost" size="icon" className="hidden sm:inline-flex" title="Opsi"><MoreHorizontal className="size-4" /></Button></div>
            </div>
            {showHistory && <div className="mt-3 rounded-xl border bg-background p-2 lg:hidden"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-semibold">Riwayat chat</span><Button size="sm" variant="ghost" onClick={newChat}><Plus className="mr-1 size-3.5" />Baru</Button></div><div className="max-h-56 space-y-1 overflow-y-auto">{chats.map((chat) => <div key={chat.id} className={`flex items-center gap-1 rounded-lg ${chat.id === activeId ? "bg-muted" : "hover:bg-muted/60"}`}><button type="button" onClick={() => selectChat(chat.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs"><span className="block truncate">{chat.title}</span><span className="text-[10px] text-muted-foreground">{new Date(chat.updatedAt).toLocaleDateString("id-ID")}</span></button><Button size="icon" variant="ghost" className="size-7" onClick={() => deleteChat(chat.id)} title="Hapus chat"><Trash2 className="size-3.5" /></Button></div>)}</div></div>}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {!messages.length ? <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center"><div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-8" /></div><h2 className="mt-5 text-xl font-semibold">Halo 👋</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Tanya apa saja. Untuk fakta terbaru, Coffee Flow AI bisa melakukan web search sebelum menjawab.</p><div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">{STARTERS.map((starter) => <button key={starter} type="button" onClick={() => send(starter)} className="rounded-xl border bg-background p-3 text-left text-sm transition hover:bg-muted">{starter}</button>)}</div></div> : messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "assistant" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div>}<div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "border bg-muted/40"}`}>{message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}</div>{message.role === "user" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><User className="size-4" /></div>}</div>)}
              {ask.isPending && <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div><div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Berpikir cepat…</div></div>}
            </div>
            <div className="border-t p-3 md:p-4"><div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm"><Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message Coffee Flow AI…" className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0" /><Button size="icon" className="size-11 shrink-0 rounded-xl" disabled={!input.trim() || ask.isPending} onClick={() => send()}><Send className="size-4" /></Button></div><p className="mt-2 px-1 text-[11px] text-muted-foreground">Enter untuk kirim • Shift+Enter untuk baris baru • Chat tersimpan di browser ini.</p></div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
