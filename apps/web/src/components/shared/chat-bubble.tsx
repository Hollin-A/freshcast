"use client";

import { useState } from "react";
import { ChatClient } from "@/app/(app)/chat/chat-client";

export function ChatBubble({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-terra shadow-lg shadow-terra/25 transition-transform active:scale-95"
          aria-label="Ask Freshcast"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 4v-4H6a2 2 0 01-2-2V6z" stroke="#FFF8EC" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Chat overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 pb-3 pt-14">
              <h2 className="font-serif text-xl font-medium text-ink">Ask Freshcast</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-terra"
              >
                Close
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatClient businessName={businessName} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
