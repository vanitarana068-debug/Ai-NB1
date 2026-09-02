import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const GREETING =
  "Hello — I'm the Northbridge assistant. Ask me about delivery, returns, warranty, stock or anything in the catalogue.";

const SUGGESTIONS = [
  "How much is delivery?",
  "What's your returns policy?",
  "Do I need an account to buy?",
];

export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Follow the answer as it streams in.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (trimmed === "" || streaming) return;

    const history: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!response.ok || response.body === null) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        // Replace the trailing placeholder with the answer so far.
        setMessages([...history, { role: "assistant", content: answer }]);
      }

      if (answer.trim() === "") {
        setMessages([
          ...history,
          { role: "assistant", content: "Sorry — I didn't catch that. Could you try again?" },
        ]);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessages([
        ...history,
        {
          role: "assistant",
          content: "Sorry — I couldn't reach the assistant just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      <Button
        size="icon"
        aria-label={open ? "Close the shop assistant" : "Ask the shop assistant"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 size-12 rounded-full shadow-lg"
      >
        {open ? <X /> : <MessageCircle />}
      </Button>

      {open && (
        <section
          aria-label="Shop assistant"
          className="fixed bottom-20 right-5 z-50 flex h-[min(30rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Shop assistant</p>
              <p className="truncate text-xs text-muted-foreground">
                Answers from our own policies and catalogue
              </p>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm">
                {GREETING}
              </p>

              {messages.map((message, index) => (
                <p
                  key={index}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "self-end rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted",
                  )}
                >
                  {message.content === "" ? (
                    <span className="inline-flex gap-1" aria-label="Typing">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </span>
                  ) : (
                    message.content
                  )}
                </p>
              ))}

              {messages.length === 0 && (
                <div className="flex flex-col items-start gap-2 pt-1">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="cursor-pointer rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question"
              aria-label="Ask a question"
              maxLength={2000}
              disabled={streaming}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send"
              disabled={streaming || input.trim() === ""}
            >
              <Send />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
