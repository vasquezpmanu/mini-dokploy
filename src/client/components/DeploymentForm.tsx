import { useRef, useState } from "react";
import { parseLabels } from "@/src/client/labels";
import { parsePort } from "@/src/client/port";
import type { CreateDeploymentInput } from "@/src/server/validation";

interface DeploymentFormProps {
  busy: boolean;
  onCreate(input: CreateDeploymentInput): Promise<boolean>;
}

export function DeploymentForm({ busy, onCreate }: DeploymentFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [port, setPort] = useState("");
  const [portTouched, setPortTouched] = useState(false);
  const [labels, setLabels] = useState("");
  const [formError, setFormError] = useState("");
  const portInputRef = useRef<HTMLInputElement>(null);
  const portResult = parsePort(port);
  const portError = portTouched && !portResult.ok ? portResult.message : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const checkedPort = parsePort(port);
    if (!checkedPort.ok) {
      setPortTouched(true);
      portInputRef.current?.focus();
      return;
    }
    setFormError("");
    try {
      const customLabels = parseLabels(labels);
      const created = await onCreate({
        repoUrl,
        dockerfilePath,
        port: checkedPort.port,
        customLabels,
      });
      if (created) {
        setRepoUrl("");
        setPort("");
        setPortTouched(false);
        setLabels("");
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section className="panel deploy-panel" aria-labelledby="new-deployment-title">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">CREATE</span>
          <h2 id="new-deployment-title">New deployment</h2>
          <p className="muted">Connect a public Git repository to your local Swarm.</p>
        </div>
        <span className="panel-badge">01 / 02</span>
      </div>
      <form onSubmit={submit}>
        <div className="form-section-title">
          <span>1</span>
          <strong>Source</strong>
        </div>
        <label>
          Git repository URL
          <input
            required
            type="url"
            autoComplete="url"
            placeholder="https://github.com/you/app.git"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
          />
        </label>
        <label>
          Dockerfile path
          <input
            required
            value={dockerfilePath}
            onChange={(event) => setDockerfilePath(event.target.value)}
          />
          <span className="field-help">Relative to the repository root.</span>
        </label>
        <div className="form-section-title">
          <span>2</span>
          <strong>Runtime</strong>
        </div>
        <label>
          App port (inside container)
          <input
            ref={portInputRef}
            type="text"
            inputMode="numeric"
            placeholder="e.g. 80, 3000, or 8080"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            onBlur={() => setPortTouched(true)}
            aria-invalid={Boolean(portError)}
            aria-describedby={portError ? "port-help port-error" : "port-help"}
          />
          <span className="field-help" id="port-help">
            Internal container port, not a host or Compose port.
          </span>
          {portError && (
            <span className="field-warning" id="port-error" role="alert">
              {portError}
            </span>
          )}
        </label>
        <label>
          Custom Docker labels <span className="optional">optional</span>
          <textarea
            rows={3}
            placeholder="team=demo"
            value={labels}
            onChange={(event) => setLabels(event.target.value)}
          />
          <span className="field-help">One KEY=VALUE pair per line.</span>
        </label>
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <button className="primary deploy-submit" disabled={busy}>
          {busy ? "Working…" : "Deploy repository"}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </section>
  );
}
