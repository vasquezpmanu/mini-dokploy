import type { Deployment, DeploymentAction } from "@/src/client/deployment-types";

interface DeploymentListProps {
  items: Deployment[];
  selectedId: string | null;
  busy: boolean;
  onSelect(id: string): void;
  onAction(id: string, kind: DeploymentAction): void;
}

export function DeploymentList({
  items,
  selectedId,
  busy,
  onSelect,
  onAction,
}: DeploymentListProps) {
  return (
    <section className="panel services-panel" aria-labelledby="services-title">
      <div className="panel-heading services-heading">
        <div>
          <span className="panel-kicker">YOUR INFRASTRUCTURE</span>
          <h2 id="services-title">Services</h2>
          <p className="muted">A live view of your Docker Swarm deployments.</p>
        </div>
        <span className="panel-badge">{items.length} total</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-symbol" aria-hidden="true">
            ◇
          </span>
          <strong>No deployments yet</strong>
          <p>Add a repository to launch your first service.</p>
        </div>
      ) : (
        <div className="service-list">
          {items.map((item) => {
            const inProgress = ["queued", "cloning", "building", "deploying"].includes(item.status);
            return (
              <article
                key={item.id}
                className={`service ${selectedId === item.id ? "selected" : ""}`}
              >
                <div className="service-main">
                  <div className="service-icon" aria-hidden="true">
                    {item.serviceName.slice(-2).toUpperCase()}
                  </div>
                  <div className="service-copy">
                    <div className="service-heading">
                      <strong>{item.serviceName}</strong>
                      <span className={`status ${item.status}`}>
                        <i aria-hidden="true" />
                        {item.status}
                      </span>
                    </div>
                    <p className="repo">{item.repoUrl}</p>
                    <div className="service-meta">
                      <span>Port {item.port}</span>
                      <span>Revision {item.revision}</span>
                    </div>
                  </div>
                </div>
                <div className="service-bottom">
                  <a href={`http://${item.domain}`} target="_blank" rel="noreferrer">
                    Open app ↗
                  </a>
                  <div className="service-actions">
                    <button type="button" onClick={() => onSelect(item.id)}>
                      View logs
                    </button>
                    <button
                      type="button"
                      disabled={busy || inProgress}
                      onClick={() => onAction(item.id, "redeploy")}
                    >
                      Redeploy
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy || inProgress}
                      onClick={() => {
                        if (confirm(`Remove ${item.serviceName}?`)) onAction(item.id, "remove");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {item.lastError && (
                  <p className="error small-error">Last error: {item.lastError}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
