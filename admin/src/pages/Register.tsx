import { useRef, useState } from "react";
import { api } from "../lib/api";
import type { PayrollUploadResult } from "../lib/api";

export default function Register() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PayrollUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Выберите файл .xlsx");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post<PayrollUploadResult>("/payroll/upload", form);
      setResult(r);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить реестр");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Реестр выплат</h2>

      <div className="card" style={{ maxWidth: 600 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Загрузите файл .xlsx с колонками: <b>ФИО</b>, <b>телефон</b>, <b>заработано за неделю</b>,{" "}
          <b>баланс</b>, <b>получено на руки</b>, <b>период</b>. Курьеры сопоставляются по номеру телефона.
          Значение из колонки «баланс» прибавляется к текущему балансу каждого курьера (баланс — это сумма,
          удержанная и хранящаяся на счёте компании до полного расчёта). Данные сразу появляются у курьера в
          приложении и здесь, в карточке курьера.
        </p>
        <div className="field">
          <input type="file" accept=".xlsx,.xls" ref={fileRef} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" disabled={busy} onClick={handleUpload}>
          {busy ? "Загружаю..." : "Загрузить реестр"}
        </button>
      </div>

      {result && (
        <div className="card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginTop: 0 }}>Результат загрузки</h3>
          <div className="success-text">Начислено курьерам: {result.matchedCount}</div>
          {result.unmatchedCount > 0 && (
            <>
              <div className="error-text">Не найдено по телефону: {result.unmatchedCount}</div>
              <table style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Строка</th>
                    <th>ФИО</th>
                    <th>Телефон</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unmatched.map((u) => (
                    <tr key={u.row}>
                      <td>{u.row}</td>
                      <td>{u.fullName || "—"}</td>
                      <td>{u.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                Проверьте номер телефона в реестре — он должен совпадать с номером, под которым курьер
                зарегистрирован в приложении.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
