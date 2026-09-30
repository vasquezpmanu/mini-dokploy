import Head from "next/head";
import { authClient } from "@/src/client/auth";
import { AuthScreen } from "@/src/client/components/AuthScreen";
import { Dashboard } from "@/src/client/components/Dashboard";

export default function Home() {
  const session = authClient.useSession();
  return (
    <>
      <Head>
        <title>Mini-Dokploy</title>
        <meta name="description" content="A local Docker deployment platform" />
      </Head>
      {session.isPending ? (
        <div className="loading">Loading Mini-Dokploy…</div>
      ) : session.data ? (
        <Dashboard />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
