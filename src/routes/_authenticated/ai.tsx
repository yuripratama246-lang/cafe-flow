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
  "Produk apa yang paling perlu diperhatikan?",
  "Ada stok yang hampir habis?",
  "Kasih insight untuk meningkatkan penjualan",
];

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
    <AppShell title="AI Assistant" description="Tanya apa saja tentang operasional dan bisnis Cafe Flow">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="flex min-h-[calc(100vh-150px)] flex-col overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
              <div><p>Cafe Flow AI</p><p className="text-xs font-normal text-muted-foreground">Powered by Groq</p></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
              {!messages.length ? (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-8" /></div>
                  <h2 className="mt-5 text-xl font-semibold">Ada yang mau dicek?</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">AI Assistant bisa membaca data Cafe Flow untuk membantu memahami penjualan, order, produk, dan stok.</p>
                  <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                    {STARTERS.map((starter) => <button key={starter} type="button" onClick={() => send(starter)} className="rounded-xl border bg-background p-3 text-left text-sm transition hover:bg-muted">{starter}</button>)}
                  </div>
                </div>
              ) : messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div>}
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-primary text-primary-foreground" : "border bg-muted/40"}`}>{message.content}</div>
                  {message.role === "user" && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><User className="size-4" /></div>}
                </div>
              ))}
              {ask.isPending && <div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bot className="size-4" /></div><div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Menganalisis data…</div></div>}
            </div>
            <div className="border-t p-3 md:p-4">
              <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Tanya tentang penjualan, stok, produk…" className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0" />
                <Button size="icon" className="size-11 shrink-0 rounded-xl" disabled={!input.trim() || ask.isPending} onClick={() => send()}><Send className="size-4" /></Button>
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">AI menggunakan data Cafe Flow yang tersedia saat ini. Jangan masukkan informasi rahasia pelanggan.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Yang bisa ditanya</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Omzet dan transaksi hari ini</p>
            <p>• Order yang masih berjalan</p>
            <p>• Produk dan harga</p>
            <p>• Stok yang menipis</p>
            <p>• Insight dan saran bisnis</p>
            <p>• Ringkasan performa outlet</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
