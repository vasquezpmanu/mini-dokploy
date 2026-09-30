import type { AppProps } from "next/app";
import "../styles.css";
import "../src/client/components/auth.css";
import "../src/client/components/dashboard.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
