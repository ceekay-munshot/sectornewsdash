import { useState } from "react";
import { Bot, Play, X } from "lucide-react";

const MUNS_API_BASE = "https://devde.muns.io";

type RunStatus = "idle" | "running" | "ok" | "error";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "agent";

const triggerDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function MunsRunButton() {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const reset = () => {
    setStatus("idle");
    setMessage("");
  };

  const handleRun = async () => {
    if (!agentId.trim() || !agentName.trim() || !token.trim()) {
      setStatus("error");
      setMessage("Agent ID, Name, and MUNS token are all required.");
      return;
    }

    setStatus("running");
    setMessage("");

    const startedAt = new Date();
    const payload = {
      agent_library_id: agentId.trim(),
      metadata: {
        to_date: startedAt.toISOString().slice(0, 10),
        timezone: "UTC",
      },
    };

    let responseStatus = 0;
    let responseHeaders: Record<string, string> = {};
    let rawText = "";
    let networkError: string | null = null;

    try {
      const response = await fetch(`${MUNS_API_BASE}/agents/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      responseStatus = response.status;
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      rawText = await response.text();
    } catch (error) {
      networkError = error instanceof Error ? error.message : String(error);
    }

    const finishedAt = new Date();
    const slug = slugify(agentName);
    const stamp = finishedAt.toISOString().replace(/[:.]/g, "-");
    const filename = `muns-output-${slug}-${stamp}.json`;

    const fileContents = {
      agentId: agentId.trim(),
      agentName: agentName.trim(),
      apiBase: MUNS_API_BASE,
      requestedAt: startedAt.toISOString(),
      completedAt: finishedAt.toISOString(),
      requestPayload: payload,
      responseStatus,
      responseHeaders,
      rawText,
      networkError,
    };

    triggerDownload(filename, JSON.stringify(fileContents, null, 2));

    if (networkError) {
      setStatus("error");
      setMessage(`Network error: ${networkError}. Output file still saved.`);
      return;
    }
    if (responseStatus < 200 || responseStatus >= 300) {
      setStatus("error");
      setMessage(`MUNS responded ${responseStatus}. Output saved as ${filename}.`);
      return;
    }
    setStatus("ok");
    setMessage(`Saved ${filename}. Drop it into muns-outputs/ in the repo.`);
  };

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        aria-label="Run MUNS agent"
      >
        <Bot size={12} />
        <span className="hidden sm:inline">MUNS</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-strong w-full max-w-md p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-white">
                  Run MUNS Agent
                </h2>
                <p className="mt-0.5 text-[11px] text-white/50">
                  Output downloads as a JSON file.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <Field
                label="Agent ID"
                hint="UUID from MUNS library (sent as agent_library_id)"
                value={agentId}
                onChange={setAgentId}
                placeholder="f8c08f67-9dc2-4960-9c87-623251f297c1"
              />
              <Field
                label="Name"
                hint="Used for the output filename"
                value={agentName}
                onChange={setAgentName}
                placeholder="management-compensation"
              />
              <Field
                label="MUNS Token"
                hint="Bearer token; sent only with this request"
                value={token}
                onChange={setToken}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                isSecret
              />
            </div>

            {message ? (
              <p
                className={`mt-3 text-[11px] ${
                  status === "error" ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {message}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
                disabled={status === "running"}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRun}
                disabled={status === "running"}
              >
                <Play size={12} />
                {status === "running" ? "Running…" : "Run"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  isSecret?: boolean;
}

function Field({ label, hint, value, onChange, placeholder, isSecret }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
      {hint ? (
        <span className="mb-1 block text-[10.5px] text-white/35">{hint}</span>
      ) : null}
      <input
        type={isSecret ? "password" : "text"}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="focus-ring w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-white/90 placeholder:text-white/25"
      />
    </label>
  );
}
