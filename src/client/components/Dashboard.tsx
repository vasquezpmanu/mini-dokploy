import { useState } from "react";
import { authClient } from "@/src/client/auth";
import type { DeploymentAction } from "@/src/client/deployment-types";
import { useDeployments } from "@/src/client/hooks/useDeployments";
import { useDeploymentLogs } from "@/src/client/hooks/useDeploymentLogs";
import type { CreateDeploymentInput } from "@/src/server/validation";
import { DeploymentDetails } from "./DeploymentDetails";
import { DeploymentForm } from "./DeploymentForm";
import { DeploymentList } from "./DeploymentList";
import { Overview } from "./Overview";

export function Dashboard() {
  const { data: session } = authClient.useSession();
  const { items, error, busy, create, action } = useDeployments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { logs, connection } = useDeploymentLogs(selectedId);
  const selectedItem = items.find((item) => item.id === selectedId);

  async function handleCreate(input: CreateDeploymentInput): Promise<boolean> {
    const item = await create(input);
    if (!item) return false;
    setSelectedId(item.id);
    return true;
  }

  async function handleAction(id: string, kind: DeploymentAction) {
    const succeeded = await action(id, kind);
    if (succeeded) setSelectedId(kind === "remove" ? (selectedId === id ? null : selectedId) : id);
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark small">D</span>
          <span>Mini-Dokploy</span>
          <span className="brand-divider" />
          <span className="topbar-context">Workspace</span>
        </div>
        <div className="account">
          <span className="environment-pill">
            <i aria-hidden="true" /> Local Swarm
          </span>
          <span className="account-email">{session?.user.email}</span>
          <button className="text-button" onClick={() => void authClient.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="content">
        <Overview items={items} />
        <div className="columns">
          <DeploymentForm busy={busy} onCreate={handleCreate} />
          <DeploymentList
            items={items}
            selectedId={selectedId}
            busy={busy}
            onSelect={setSelectedId}
            onAction={(id, kind) => void handleAction(id, kind)}
          />
        </div>
        {error && (
          <p className="error global-error" role="alert">
            {error}
          </p>
        )}
        <DeploymentDetails
          selectedId={selectedId}
          item={selectedItem}
          logs={logs}
          connection={connection}
          onClose={() => setSelectedId(null)}
        />
        <footer className="dashboard-footer">
          <span>Mini-Dokploy · local assessment</span>
          <span>HTTP only · local development</span>
        </footer>
      </div>
    </main>
  );
}
