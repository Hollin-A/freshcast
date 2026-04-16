"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "What sold best this week?",
  "How are my sales trending?",
  "What should I prepare for tomorrow?",
  "Which day is my strongest?",
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

  // Empty state with suggested questions
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Ask anything about {businessName}&apos;s sales, trends, or predictions
          </p>
          <div className="grid grid-cols-1 gap-2 w-full">
            {SUGGESTED_QUESTIONS.map((q) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto py-3 px-4 text-sm"
                onClick={() => sendMessage(q)}
                disabled={isLoading}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  // Chat view with messages
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[85%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card"
              }`}
            >
              <CardContent className="py-2.5 px-3.5">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </CardContent>
            </Card>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-card">
              <CardContent className="py-2.5 px-3.5">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <Input
          placeholder="Ask a follow-up..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          disabled={isLoading}
        />
        <Button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
