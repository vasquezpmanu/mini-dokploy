import { useEffect, useState } from "react";

export function useDeploymentLogs(selectedId: string | null) {
  const [logs, setLogs] = useState("");
  const [connection, setConnection] = useState<"idle" | "connecting" | "live" | "reconnecting">(
    "idle",
  );

  useEffect(() => {
    if (!selectedId) return;
    setLogs("");
    setConnection("connecting");
    let active = true;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/logs?id=${selectedId}`,
      );
      socket.onopen = () => setConnection("live");
      socket.onmessage = (event) =>
        setLogs((previous) => `${previous}${event.data}`.slice(-262_144));
      socket.onclose = () => {
        if (active) {
          setConnection("reconnecting");
          retry = setTimeout(connect, 2000);
        }
      };
    };
    connect();
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [selectedId]);

  return { logs, connection };
}
