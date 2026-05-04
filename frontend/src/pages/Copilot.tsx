import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { copilotApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Bot, Send, Loader2, Sparkles, Trash2, User,
  BarChart3, Package, ShoppingCart, Wrench, AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ─── Suggested queries ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: BarChart3, text: "Show me today's dashboard KPIs", color: "text-blue-400" },
  { icon: Package, text: "Which materials are low on stock?", color: "text-amber-400" },
  { icon: ShoppingCart, text: "List all pending purchase orders", color: "text-green-400" },
  { icon: Wrench, text: "Can we produce 50 units of Speed Motor 500W?", color: "text-purple-400" },
  { icon: AlertTriangle, text: "Show this month's financial summary", color: "text-rose-400" },
  { icon: Package, text: "What are our current confirmed customer orders?", color: "text-cyan-400" },
];

// ─── Simple markdown renderer ───────────────────────────────────────────────
function renderMarkdown(text: string) {
  // Process text into HTML-safe markdown
  const lines = text.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  const processInline = (line: string): string => {
    return line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs font-mono">$1</code>')
      .replace(/₹([\d,]+(?:\.\d+)?)/g, '<span class="font-semibold text-emerald-400">₹$1</span>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row
    if (line.trim().startsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Skip separator rows
      if (!/^\|[\s\-:|]+\|$/.test(line.trim())) {
        tableRows.push(line);
      }
      continue;
    }

    // End of table
    if (inTable) {
      inTable = false;
      result.push(renderTable(tableRows));
      tableRows = [];
    }

    // Headers
    if (line.startsWith("### ")) {
      result.push(`<h3 class="text-sm font-bold text-foreground mt-3 mb-1">${processInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      result.push(`<h2 class="text-base font-bold text-foreground mt-3 mb-1">${processInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      result.push(`<h1 class="text-lg font-bold text-foreground mt-3 mb-1">${processInline(line.slice(2))}</h1>`);
    }
    // Bullet points
    else if (/^[-*]\s/.test(line.trim())) {
      result.push(`<li class="ml-4 list-disc text-sm text-foreground/90">${processInline(line.trim().slice(2))}</li>`);
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line.trim())) {
      const content = line.trim().replace(/^\d+\.\s/, "");
      result.push(`<li class="ml-4 list-decimal text-sm text-foreground/90">${processInline(content)}</li>`);
    }
    // Empty line
    else if (line.trim() === "") {
      result.push('<div class="h-2"></div>');
    }
    // Normal paragraph
    else {
      result.push(`<p class="text-sm text-foreground/90 leading-relaxed">${processInline(line)}</p>`);
    }
  }

  // Close any remaining table
  if (inTable && tableRows.length > 0) {
    result.push(renderTable(tableRows));
  }

  return result.join("\n");
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";
  const parseRow = (row: string) =>
    row.split("|").filter(Boolean).map((c) => c.trim());

  const headers = parseRow(rows[0]);
  const bodyRows = rows.slice(1).map(parseRow);

  let html = '<div class="overflow-x-auto my-2 rounded-lg border border-border">';
  html += '<table class="w-full text-xs">';
  html += '<thead><tr class="bg-muted/50 border-b border-border">';
  headers.forEach((h) => {
    html += `<th class="px-3 py-2 text-left font-medium text-muted-foreground">${h}</th>`;
  });
  html += "</tr></thead><tbody>";
  bodyRows.forEach((row, ri) => {
    html += `<tr class="${ri % 2 === 0 ? "" : "bg-muted/20"} border-b border-border/50">`;
    row.forEach((cell) => {
      html += `<td class="px-3 py-1.5 text-foreground/90">${cell}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  return html;
}

// ─── Main Component ─────────────────────────────────────────────────────────
const STORAGE_KEY = "smop_copilot_history";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-05-03"
}

function loadTodayMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.date !== getTodayKey()) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return (data.messages || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveTodayMessages(messages: Message[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: getTodayKey(), messages }),
  );
}

const Copilot = () => {
  const { username } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => loadTodayMessages());
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveTodayMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const chatMutation = useMutation({
    mutationFn: (allMessages: Array<{ role: "user" | "assistant"; content: string }>) =>
      copilotApi.chat(allMessages),
    onSuccess: (res) => {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.data?.response || "No response received.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: (err: Error) => {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ **Error**: ${err.message}\n\nPlease try again or rephrase your question.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const sendMessage = useCallback(
    (text?: string) => {
      const content = (text || input).trim();
      if (!content || chatMutation.isPending) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");

      // Send only role + content to the API
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      chatMutation.mutate(apiMessages);
    },
    [input, messages, chatMutation],
  );

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Empty state ────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Hero */}
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/20">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-foreground mb-1">SMOP Copilot</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
            Your AI-powered operations assistant. Ask about inventory, orders, feasibility, procurement, and more — grounded in live system data.
          </p>

          {/* Suggestion chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.text)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left group"
              >
                <s.icon className={`w-4 h-4 ${s.color} shrink-0 group-hover:scale-110 transition-transform`} />
                <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                  {s.text}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border p-4 bg-card/50">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about inventory, orders, feasibility..."
              className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors min-h-[44px] max-h-[120px]"
              rows={1}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || chatMutation.isPending}
              className="shrink-0 w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Chat view ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">SMOP Copilot</h1>
            <p className="text-xs text-muted-foreground">
              {chatMutation.isPending ? "Thinking..." : "Online · Grounded in live data"}
            </p>
          </div>
        </div>
        <button
          onClick={clearConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-primary/10 text-primary"
                  : "bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div
                  className="copilot-response"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              )}
              <p
                className={`text-[10px] mt-1.5 ${
                  msg.role === "user" ? "text-primary-foreground/50" : "text-muted-foreground"
                }`}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {chatMutation.isPending && (
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Querying system data...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border p-4 bg-card/50 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatMutation.isPending ? "Waiting for response..." : "Ask a follow-up question..."}
            disabled={chatMutation.isPending}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors disabled:opacity-50 min-h-[44px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || chatMutation.isPending}
            className="shrink-0 w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all"
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2 max-w-3xl mx-auto">
          Copilot queries live SMOP data. Responses are AI-generated from real system records.
        </p>
      </div>
    </div>
  );
};

export default Copilot;
