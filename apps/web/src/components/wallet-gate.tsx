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

  if (wallet.ready && wallet.account) return children;

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

  const message = wallet.connectionError || error;
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
          <h2 id="wallet-entry-title">Connect to continue</h2>
          <p>Choose your wallet to open your purchase workspace.</p>
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
              onClick={() => void connect()}
              disabled={!wallet.ready || connecting}
            >
              {(!wallet.ready || connecting) && (
                <LoaderCircle size={17} className="spin" />
              )}
              {!wallet.ready
                ? "Restoring wallet…"
                : connecting
                  ? "Connecting…"
                  : "Connect wallet"}
              {wallet.ready && !connecting && <ArrowRight size={17} />}
            </button>
          )}
          <p className="fine" role="status">
            {!wallet.ready
              ? "Checking for an existing wallet connection."
              : "NEAR testnet · Test funds only"}
          </p>
        </section>
      </main>
    </div>
  );
}
