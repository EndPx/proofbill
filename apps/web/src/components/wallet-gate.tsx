"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useWallet } from "./wallet";

export function WalletGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  if (wallet.ready && wallet.account && wallet.authenticated) return children;
  const connected = !!wallet.account;
  const checking = connected && !wallet.sessionReady && !wallet.authenticating;
  const waiting = !wallet.ready || connecting || checking || wallet.authenticating;

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      await wallet.connect();
    } catch {
      setError(
        "Your wallet is not connected. You can try again when you're ready.",
      );
    } finally {
      setConnecting(false);
    }
  }

  async function signIn() {
    setError("");
    try { await wallet.authenticate(); }
    catch { /* The provider keeps the connected account and a retry explanation. */ }
  }
  async function disconnect() {
    setError("");
    try { await wallet.disconnect(); }
    catch { setError("The wallet could not disconnect cleanly. Reload to check its state."); }
  }
  const message = wallet.connectionError || wallet.authenticationError || error;
  return (
    <div className="landing wallet-entry">
      <nav className="landing-nav" aria-label="Welcome navigation">
        <Link className="brand" href="/">
          <img src="/brand/icon.png" alt="" />
          ProofBill
        </Link>
        <Link className="button light" href="/">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </nav>
      <main className="landing-sheet wallet-entry-sheet">
        <section className="wallet-entry-intro">
          <span className="badge neutral">
            <span className="network-dot" /> NEAR testnet
          </span>
          <h2>
            Your agent's purchases.
            <br />
            Your wallet in control.
          </h2>
          <p>
            Fund a pass, give your agent a task, and keep every receipt.
          </p>
          <div className="wallet-entry-note">
            <ShieldCheck size={20} />
            <p>
              Choose Manual review or authorize Automatic payments within your budget.
            </p>
          </div>
        </section>
        <section
          className="panel wallet-entry-card"
          aria-labelledby="wallet-entry-title"
        >
          <ol className="wallet-entry-steps" aria-label="Sign-in steps">
            <li className={connected ? "complete" : "current"}>{connected ? <Check size={16}/> : <span>1</span>} Connect wallet</li>
            <li className={connected ? "current" : ""}><KeyRound size={16}/> Sign message</li>
          </ol>
          <h1 id="wallet-entry-title">{connected ? "Sign in to continue" : "Connect to continue"}</h1>
          <p>{connected
            ? "Sign a wallet message to open your private workspace. Your wallet stays connected."
            : "Connect your NEAR wallet, then sign a message to verify ownership."}</p>
          {connected && <p className="wallet-entry-account">{wallet.account}</p>}
          {message && (
            <p className="wallet-entry-error" role="alert">
              {message}
            </p>
          )}
          {wallet.connectionError ? (
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Reload and try again
            </button>
          ) : (
            <button
              className="button primary"
              onClick={() => void (connected ? signIn() : connect())}
              disabled={waiting}
            >
              {waiting && (
                <LoaderCircle size={17} className="spin" />
              )}
              {!wallet.ready
                ? "Restoring wallet…"
                : wallet.authenticating
                  ? "Signing in…"
                : checking
                  ? "Checking private session…"
                : connected
                  ? "Sign in for private access"
                : connecting
                  ? "Connecting…"
                  : "Connect wallet"}
              {!waiting && <ArrowRight size={17} />}
            </button>
          )}
          <p className="fine" role="status">
            {!wallet.ready
              ? "Checking for an existing wallet connection."
              : wallet.authenticating
                ? "Sign the wallet message. If no window opens, check blocked pop-ups in your browser."
              : checking
                ? "Verifying your existing private session."
              : connected
                ? "No gas fee. No transfer or spending permission."
                : "Sign-in costs no gas and grants no spending permission."}
          </p>
          {connected && <button type="button" className="button secondary" onClick={() => void disconnect()}>Disconnect wallet</button>}
        </section>
      </main>
    </div>
  );
}
