import { useEffect, useRef, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ChatMessage, Courier } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function ChatWithCourier() {
  const { courierId } = useParams<{ courierId: string }>();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!courierId) return;
    api.get<ChatMessage[]>(`/chat/${courierId}`).then(setMessages);
  }, [courierId]);

  useEffect(() => {
    if (!courierId) return;
    api.get<{ courier: Courier }>(`/couriers/${courierId}`).then((r) => setCourier(r.courier));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [courierId, load]);

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
      await api.post(`/chat/${courierId}`, form);
      setText("");
      setFiles(null);
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Чат — {courier?.fullName || "..."}</h2>
      <div className="card">
        <div className="chat-thread">
          {messages.map((m) => (
            <div key={m.id} className={"chat-bubble " + (m.senderType === "ADMIN" ? "admin" : "courier")}>
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
        <form onSubmit={handleSend} className="flex gap-8" style={{ marginTop: 14 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ваш ответ..." />
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles(e.target.files)} style={{ width: 160 }} />
          <button className="btn btn-primary" disabled={sending}>
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
