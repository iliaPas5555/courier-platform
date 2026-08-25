import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const TYPE_LABEL: Record<string, string> = {
  LATE: "Опоздание",
  NO_SHOW: "Невыход",
  OTHER: "Другое",
};

export default function FeedbackNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [type, setType] = useState(params.get("type") || "OTHER");
  const shiftId = params.get("shiftId") || "";
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("Опишите причину");
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      form.append("type", type);
      form.append("reason", reason.trim());
      if (shiftId) form.append("shiftId", shiftId);
      if (files) Array.from(files).forEach((f) => form.append("media", f));
      await api.post("/feedback", form);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="top-bar">
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", fontSize: 16, marginRight: 8, padding: 0 }}
        >
          ←
        </button>
        Обратная связь
      </div>
      <div className="screen">
        <form onSubmit={handleSubmit} className="card">
          <div className="field">
            <label>Тип обращения</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Причина</label>
            <textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Опишите, что случилось..." required />
          </div>
          <div className="field">
            <label>Фото или видео (необязательно)</label>
            <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles(e.target.files)} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={sending}>
            {sending ? "Отправляем..." : "Отправить"}
          </button>
        </form>
      </div>
    </>
  );
}
