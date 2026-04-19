"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "Slowest day?",
  "What sold best this week?",
  "Compare this week vs last",
  "Should I prep more tomorrow?",
];

export function ChatClient({ businessName }: { businessName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: updatedMessages.slice(-8),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        if (res.status === 503) {
          setMessages([
            ...updatedMessages,
            { role: "assistant", content: "I'm temporarily unavailable. Please try again in a moment." },
          ]);
        } else {
          toast.error(body.error?.message || "Something went wrong");
        }
        return;
      }

      const data = await res.json();
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="px-5 pt-14 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">Your data, only</p>
            <h1 className="mt-1 font-serif text-[32px] font-medium tracking-tight text-ink">Ask Freshcast</h1>
          </div>
          <Badge variant="olive">Private</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-body">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-terra">Freshcast</span>
              <p className="mt-1">Morning. Want me to pull anything useful about {businessName} for today?</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2.5 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-md bg-ink text-cream"
                  : "rounded-bl-md border border-line bg-paper text-ink"
              }`}
            >
              {msg.role === "assistant" && (
                <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-terra">Freshcast</p>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-2.5 flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-line bg-paper px-3.5 py-3">
              <p className="text-sm text-muted-warm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="shrink-0 rounded-full border border-line bg-paper px-3 py-2 text-[13px] text-body whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-full border border-line bg-paper py-2.5 pl-4 pr-2.5">
          <input
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-mute2 outline-none"
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terra disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l7-7 7 7M12 5v16" stroke="#FFF8EC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
