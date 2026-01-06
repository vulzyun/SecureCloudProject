import { useEffect, useState } from "react";
import { API_BASE } from "../api";

type RunEvent =
  | { type: "run_start" }
  | { type: "run_success" }
  | { type: "run_failed"; error: string }
  | { type: "step_start" | "step_success"; step: string }
  | { type: "log"; step: string; line: string };

export default function Run({ runId }: { runId: string }) {
  const [out, setOut] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/runs/${runId}/events`, { withCredentials: true });

    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as RunEvent;
      if (evt.type === "log") setOut((p) => p + evt.line);
      else setOut((p) => p + JSON.stringify(evt) + "\n");
    };

    es.onerror = () => setErr("SSE error (proxy/cookie ? backend stopped ?)");
    return () => es.close();
  }, [runId]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Run #{runId}</h2>
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}
      <pre style={{ background: "#111", color: "#ddd", padding: 12, height: 420, overflow: "auto" }}>
        {out}
      </pre>
    </div>
  );
}
