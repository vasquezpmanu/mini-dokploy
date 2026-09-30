import { useState } from "react";
import { authClient } from "@/src/client/auth";

export function AuthScreen() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "signUp"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) setError(result.error.message ?? "Authentication failed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About Mini-Dokploy">
        <div className="brand brand-on-dark">
          <span className="brand-mark">D</span>
          <span>Mini-Dokploy</span>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">LOCAL DEPLOYMENT PLATFORM</p>
          <h1>From repository to running service.</h1>
          <p>Build, deploy, and observe your apps on a local Docker Swarm from one workspace.</p>
          <div className="auth-flow" aria-hidden="true">
            <span>Git source</span>
            <span>Build image</span>
            <span>Swarm service</span>
          </div>
        </div>
        <p className="auth-story-foot">One workspace. Clear deployment history. Live build logs.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-heading">
          <span className="panel-kicker">YOUR WORKSPACE</span>
          <h2>{mode === "signIn" ? "Welcome back" : "Create an account"}</h2>
          <p className="muted">
            {mode === "signIn"
              ? "Sign in to manage your local deployments."
              : "Start deploying with your own private workspace."}
          </p>
        </div>
        <form className="auth-card" onSubmit={submit}>
          {mode === "signUp" && (
            <label>
              Name
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={8}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "signIn" ? "Sign in" : "Create account"}
          </button>
          <button
            className="text-button auth-switch"
            type="button"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError("");
            }}
          >
            {mode === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
