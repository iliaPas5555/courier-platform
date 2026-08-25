import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ChatSummary, Courier } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function ChatInbox() {
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [couriers, setCouriers] = useState<Record<string, Courier>>({});

  useEffect(() => {
    Promise.all([api.get<ChatSummary[]>("/chat"), api.get<Courier[]>("/couriers")]).then(([s, c]) => {
      setSummaries(s.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)));
      setCouriers(Object.fromEntries(c.map((x) => [x.id, x])));
    });
  }, []);

  return (
    <div>
      <h2 className="page-title">Чат с курьерами</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Последнее сообщение</th>
              <th>Когда</th>
              <th>Непрочитано</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.courierId} className="clickable">
                <td>
                  <Link to={`/chat/${s.courierId}`}>{couriers[s.courierId]?.fullName || s.courierId}</Link>
                </td>
                <td className="muted">{s.lastMessage || "[вложение]"}</td>
                <td>{formatDateTime(s.lastAt)}</td>
                <td>{s.unread > 0 && <span className="badge" style={{ background: "#dc2626" }}>{s.unread}</span>}</td>
              </tr>
            ))}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 16 }}>
                  Сообщений пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
