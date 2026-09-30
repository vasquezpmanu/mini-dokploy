import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/client/api";
import type { Deployment, DeploymentAction } from "@/src/client/deployment-types";
import type { CreateDeploymentInput } from "@/src/server/validation";

export function useDeployments() {
  const [items, setItems] = useState<Deployment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.deployments.list.query());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function create(input: CreateDeploymentInput): Promise<Deployment | null> {
    setBusy(true);
    setError("");
    try {
      const item = await api.deployments.create.mutate(input);
      await refresh();
      return item;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, kind: DeploymentAction): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      if (kind === "remove") await api.deployments.remove.mutate({ id });
      else await api.deployments.redeploy.mutate({ id });
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { items, error, busy, create, action };
}
