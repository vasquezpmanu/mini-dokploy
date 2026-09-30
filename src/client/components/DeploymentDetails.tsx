import type { Deployment } from "@/src/client/deployment-types";

interface DeploymentDetailsProps {
  selectedId: string | null;
  item: Deployment | undefined;
  logs: string;
  connection: "idle" | "connecting" | "live" | "reconnecting";
  onClose(): void;
}

export function DeploymentDetails({
  selectedId,
  item,
  logs,
  connection,
  onClose,
}: DeploymentDetailsProps) {
  if (!selectedId) return null;
  return (
    <section className="panel details-panel" aria-label="Deployment details">
      <div className="panel-heading details-heading">
        <div>
          <span className="panel-kicker">SELECTED SERVICE</span>
          <h2>{item?.serviceName ?? "Deployment details"}</h2>
          <p className="muted">Runtime configuration and live build output.</p>
        </div>
        <button className="outline-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {item && (
        <div className="detail-meta">
          <div>
            <span>Internal port</span>
            <strong>{item.port}</strong>
          </div>
          <div>
            <span>Revision</span>
            <strong>{item.revision}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{item.status}</strong>
          </div>
          <div>
            <span>Address</span>
            <a href={`http://${item.domain}`} target="_blank" rel="noreferrer">
              {item.domain} ↗
            </a>
          </div>
        </div>
      )}
      <div className="log-toolbar">
        <div>
          <span className="terminal-mark" aria-hidden="true">
            &gt;_
          </span>
          <h3>Live deployment logs</h3>
        </div>
        <span className={`connection ${connection}`}>
          <i aria-hidden="true" />
          {connection === "live"
            ? "Live"
            : connection === "reconnecting"
              ? "Reconnecting"
              : "Connecting"}
        </span>
      </div>
      <pre className="log-output" aria-live="polite">
        {logs || "Waiting for logs…"}
      </pre>
    </section>
  );
}
