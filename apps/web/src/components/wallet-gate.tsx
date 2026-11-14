"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
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
          <h1>
            Your agent's purchases.
            <br />
            Your wallet in control.
          </h1>
          <p>
            Connect your NEAR wallet to manage Purchase Passes, review private
            results, and choose how payment is authorized.
          </p>
          <div className="wallet-entry-note">
            <ShieldCheck size={20} />
            <p>
              Connecting does not move funds. Manual payment needs your
              approval; Automatic payment uses the permission you give in
              advance.
            </p>
          </div>
        </section>
        <section
          className="panel wallet-entry-card"
          aria-labelledby="wallet-entry-title"
        >
          <span className="wallet-entry-icon">
            <KeyRound size={28} />
          </span>
          <h2 id="wallet-entry-title">{connected ? "Sign in to continue" : "Connect to continue"}</h2>
          <p>{connected
            ? "Your wallet is connected. Sign a message to verify ownership and open your private workspace."
            : "Choose your wallet, then sign a message to open your private session. Signing in costs no gas and grants no spending permission."}</p>
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
                ? "Sign the wallet message to open your private session. If no wallet window appears, check your browser's blocked pop-up indicator."
              : checking
                ? "Verifying your existing private session."
              : connected
                ? "No gas fee. No transfer or spending permission."
                : "NEAR testnet · Test funds only"}
          </p>
          {connected && <button type="button" className="button secondary" onClick={() => void disconnect()}>Disconnect wallet</button>}
        </section>
      </main>
    </div>
  );
}
