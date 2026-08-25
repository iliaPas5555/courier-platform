import { useEffect, useRef, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { ChatMessage } from "../lib/api";
import { formatDateTime } from "../lib/format";
import BottomNav from "../components/BottomNav";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.get<ChatMessage[]>("/chat/me").then(setMessages);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && (!files || files.length === 0)) return;
    setSending(true);
    try {
      const form = new FormData();
      if (text.trim()) form.append("text", text.trim());
      if (files) Array.from(files).forEach((f) => form.append("media", f));
      await api.post("/chat/me", form);
      setText("");
      setFiles(null);
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="top-bar">Чат с администратором</div>
      <div className="screen" style={{ paddingBottom: 150 }}>
        <div className="chat-thread">
          {messages.length === 0 && <div className="muted">Напишите, если есть вопросы — ответ придёт сюда</div>}
          {messages.map((m) => (
            <div key={m.id} className={"chat-bubble " + (m.senderType === "COURIER" ? "courier" : "admin")}>
              {m.text}
              {m.mediaUrls.map((u) =>
                /\.(mp4|mov|webm|m4v)$/i.test(u) ? (
                  <video key={u} src={u} controls />
                ) : (
                  <img key={u} src={u} alt="вложение" />
                )
              )}
              <div className="meta">{formatDateTime(m.createdAt)}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <form onSubmit={handleSend} className="chat-input-bar">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение..." />
        <label className="btn btn-sm" style={{ padding: "10px 12px" }}>
          📎
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>
        <button className="btn btn-primary btn-sm" disabled={sending}>
          ➤
        </button>
      </form>
      <BottomNav />
    </>
  );
}
