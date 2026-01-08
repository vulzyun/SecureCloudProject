import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, runAPI } from "../api";
import type { RunEvent } from "../types";

function formatEvent(e: RunEvent): string {
  if (e.type === "log") {
    const step = e.step ? `[${e.step}] ` : "";
    return `${step}${e.message ?? ""}\n`;
  }
  if (e.type === "step_start") return `\nSTART ${e.step}\n`;
  if (e.type === "step_success") return `OK ${e.step}\n`;
  if (e.type === "run_start") return `\nRUN START\n`;
  if (e.type === "run_success") return `\nRUN SUCCESS\n`;
  if (e.type === "run_failed") return `\nRUN FAILED: ${e.message ?? ""}\n`;
  return `${JSON.stringify(e)}\n`;
}

export default function Run({ runId }: { runId: string }) {
  const navigate = useNavigate();
  const [out, setOut] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const sseUrl = useMemo(() => `${API_BASE}/api/runs/${runId}/events`, [runId]);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function start() {
      setErr(null);
      setOut("");

      // 1) history
      try {
        const hist = await runAPI.history(Number(runId));
        if (cancelled) return;
        setOut(hist.map(formatEvent).join(""));
      } catch (e: any) {
        // history peut échouer si run pas trouvé
        setErr(e.message || String(e));
      }

      // 2) SSE
      es = new EventSource(sseUrl, { withCredentials: true });
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as RunEvent;
          setOut((p) => p + formatEvent(evt));
        } catch {
          setOut((p) => p + e.data + "\n");
        }
      };
      es.onerror = () => setErr("SSE error (backend/proxy/cookie ?)");

    }

    start();
    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [runId, sseUrl]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Run #{runId}</h2>
        <button
          onClick={() => navigate(`/logs/${runId}`)}
          style={{
            backgroundColor: "#3b82f6",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Voir les logs détaillés
        </button>
      </div>
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}
      <pre style={{ background: "#111", color: "#ddd", padding: 12, height: 520, overflow: "auto" }}>
        {out}
      </pre>
    </div>
  );
}
