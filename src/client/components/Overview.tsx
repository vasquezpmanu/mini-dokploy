import type { Deployment } from "@/src/client/deployment-types";

export function Overview({ items }: { items: Deployment[] }) {
  const running = items.filter((item) => item.status === "running").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const inProgress = items.length - running - failed;

  return (
    <>
      <section className="hero" aria-label="Workspace introduction">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="live-dot" /> LOCAL SWARM WORKSPACE
          </span>
          <h1>Deploy with confidence.</h1>
          <p>Build from Git, route through Traefik, and follow every deployment in real time.</p>
        </div>
        <div className="hero-flow" aria-label="Deployment flow">
          <span>Git repository</span>
          <b aria-hidden="true">→</b>
          <span>Docker image</span>
          <b aria-hidden="true">→</b>
          <span>Swarm service</span>
        </div>
      </section>
      <section className="overview" aria-label="Deployment overview">
        <div className="overview-stat">
          <span>Total services</span>
          <strong>{items.length}</strong>
          <small>All deployments</small>
        </div>
        <div className="overview-stat">
          <span>Running</span>
          <strong>{running}</strong>
          <small>Available now</small>
        </div>
        <div className="overview-stat">
          <span>In progress</span>
          <strong>{inProgress}</strong>
          <small>Building or deploying</small>
        </div>
        <div className="overview-stat">
          <span>Failed</span>
          <strong>{failed}</strong>
          <small>Needs attention</small>
        </div>
      </section>
    </>
  );
}
