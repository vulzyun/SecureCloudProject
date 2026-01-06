import { useEffect, useState } from "react";
import { api } from "../api";

type Pipeline = { id: number; name: string; repo_url: string; branch: string };
type Me = { id: number; email: string; username: string; role: string };

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("Demo pipeline");
  const [repoUrl, setRepoUrl] = useState("https://github.com/ORG/REPO.git");
  const [branch, setBranch] = useState("main");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      const meData = await api<Me>("/api/me");
      setMe(meData);
      const data = await api<Pipeline[]>("/api/pipelines");
      setPipelines(data);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  useEffect(() => { refresh(); }, []);

  async function createPipeline() {
    setErr(null);
    try {
      await api("/api/pipelines", {
        method: "POST",
        body: JSON.stringify({ name, repo_url: repoUrl, branch }),
      });
      await refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  async function runPipeline(id: number) {
    setErr(null);
    try {
      const r = await api<{ runId: number }>(`/api/pipelines/${id}/run`, { method: "POST" });
      window.location.href = `/runs/${r.runId}`;
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Pipelines</h2>
      {me && <p>Connected as <b>{me.email}</b> ({me.role})</p>}
      {err && <pre style={{ color: "crimson" }}>{err}</pre>}

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
        <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="repo url" style={{ width: 420 }} />
        <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch" />
        <button onClick={createPipeline}>Create (admin only)</button>
      </div>

      <ul style={{ marginTop: 16 }}>
        {pipelines.map((p) => (
          <li key={p.id} style={{ marginBottom: 10 }}>
            <b>{p.name}</b> — {p.repo_url} ({p.branch})
            <button onClick={() => runPipeline(p.id)} style={{ marginLeft: 12 }}>
              Run (admin/dev)
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
