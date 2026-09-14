import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai")({ component: AiPage });

type ChatMessage = { role: "user" | "assistant"; content: string };
type AiResponse = { message?: string; error?: string };

const STARTERS = [
  "Analisa penjualan hari ini",
  "Jelasin kenapa langit berwarna biru",
  "Bantu gue bikin strategi promo cafe",
  "Ada stok yang hampir habis?",
];

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${keyPrefix}-b${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={`${keyPrefix}-c${index}`} className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (link) return <a key={`${keyPrefix}-l${index}`} href={link[2]} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{link[1]}</a>;
    return <span key={`${keyPrefix}-t${index}`}>{part}</span>;
  });
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    nodes.push(<ul key={`ul-${nodes.length}`} className="my-2 list-disc space-y-1 pl-5">{list.map((item, i) => <li key={i}>{renderInline(item, `li-${i}`)}</li>)}</ul>);
    list = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); nodes.push(<div key={`sp-${i}`} className="h-2" />); return; }
    if (/^[-*]\s+/.test(trimmed)) { list.push(trimmed.replace(/^[-*]\s+/, "")); return; }
    flushList();
    if (/^###\s+/.test(trimmed)) nodes.push(<h4 key={i} className="mt-3 font-semibold">{renderInline(trimmed.replace(/^###\s+/, ""), `h3-${i}`)}</h4>);
    else if (/^##\s+/.test(trimmed)) nodes.push(<h3 key={i} className="mt-3 text-base font-semibold">{renderInline(trimmed.replace(/^##\s+/, ""), `h2-${i}`)}</h3>);
    else if (/^#\s+/.test(trimmed)) nodes.push(<h2 key={i} className="mt-3 text-lg font-bold">{renderInline(trimmed.replace(/^#\s+/, ""), `h1-${i}`)}</h2>);
    else nodes.push(<p key={i}>{renderInline(line, `p-${i}`)}</p>);
  });
  flushList();
  return <div className="space-y-1">{nodes}</div>;
}

function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const ask = useMutation({
    mutationFn: async (nextMessages: ChatMessage[]) => {
      const { data, error } = await supabase.functions.invoke("ai-assistant", { body: { messages: nextMessages } });
      if (error) throw new Error(error.message || "Gagal menghubungi AI Assistant");
      const result = data as AiResponse;
      if (result.error) throw new Error(result.error);
      return result.message ?? "AI tidak mengembalikan jawaban.";
    },
    onSuccess: (reply) => setMessages((current) => [...current, { role: "assistant", content: reply }]),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal menghubungi AI Assistant"),
  });

  function send(text = input) {
    const value = text.trim();
    if (!value || ask.isPending) return;
    const next = [...messages, { role: "user" as const, content: value }];
    setMessages(next);
    setInput("");
    ask.mutate(next);
  }

  return (
    <AppShell title="AI Assistant" description="AI general-purpose yang juga memahami data Coffee Flow">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="flex min-h-[calc(100vh-150px)] flex-col overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
              <div><p>Coffee Flow AI</p><p className="text-xs font-normal text-muted-foreground">Powered by Groq • General AI</p></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {!messages.length ? (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-8" /></div>
                  <h2 className="mt-5 text-xl font-semibold">Halo 👋</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Tanya apa saja. AI bisa ngobrol secara general sekaligus memahami data bisnis Coffee Flow.</p>
                  <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                    {STARTERS.map((starter) => <button key={starter} type="button" onClick={() => send(starter)} className="rounded-xl border bg-background p-3 text-left text-sm transition hover:bg-muted">{starter}</button>)}
                  </div>
                </div>
              ) : messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div>}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "border bg-muted/40"}`}>
                    {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}
                  </div>
                  {message.role === "user" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><User className="size-4" /></div>}
                </div>
              ))}
              {ask.isPending && <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div><div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Berpikir…</div></div>}
            </div>
            <div className="border-t p-3 md:p-4">
              <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message Coffee Flow AI…" className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0" />
                <Button size="icon" className="size-11 shrink-0 rounded-xl" disabled={!input.trim() || ask.isPending} onClick={() => send()}><Send className="size-4" /></Button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">AI bisa menjawab general, analisis bisnis, coding, ide, dan pertanyaan sehari-hari.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">AI bisa bantu apa?</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>💬 Tanya general seperti ChatGPT</p>
            <p>📊 Analisa omzet & transaksi</p>
            <p>📦 Cek produk & stok</p>
            <p>💡 Cari ide promo & bisnis</p>
            <p>💻 Bantu coding & teknis</p>
            <p>✍️ Bikin tulisan, caption, dan konsep</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
