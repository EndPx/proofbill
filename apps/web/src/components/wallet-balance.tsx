"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatNear, formatReceiptNear } from "@proofbill/shared";
import { api } from "./wallet";

type Balance = { accountId: string; status: "loading" | "ready" | "unavailable"; totalYocto?: string };

export function useWalletBalance(accountId: string) {
  const [balance, setBalance] = useState<Balance>({ accountId, status: "loading" });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!accountId) return;
    let active = true, pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await api<{accountId:string;network:string;totalYocto:string}>(`wallet-balance?account=${encodeURIComponent(accountId)}`);
        if (result.accountId !== accountId || result.network !== "testnet") throw new Error("WRONG_BALANCE_ACCOUNT");
        formatReceiptNear(result.totalYocto);
        if (active) setBalance({ accountId, status: "ready", totalYocto: result.totalYocto });
      } catch {
        if (active) setBalance({ accountId, status: "unavailable" });
      } finally { pending = false; }
    }
    setBalance({ accountId, status: "loading" });
    void load();
    const refreshVisible = () => { if (!document.hidden) void load(); };
    const interval = setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [accountId, revision]);
  return { balance: balance.accountId === accountId ? balance : { accountId, status: "loading" } as Balance, refresh };
}

export function walletBalanceText(balance: Balance, exact = false) {
  if (balance.status !== "ready" || balance.totalYocto === undefined) return "—";
  if (exact) return formatReceiptNear(balance.totalYocto);
  const amount = BigInt(balance.totalYocto);
  if (amount > 0n && amount < 10n ** 20n) return "<0.0001";
  return `${amount % (10n ** 20n) ? "≈ " : ""}${formatNear(balance.totalYocto, 4)}`;
}

export function WalletBalance({ balance, refresh }: ReturnType<typeof useWalletBalance>) {
  return <section className="wallet-balance" aria-label="Connected wallet balance">
    <div className="wallet-balance-heading">
      <span>Wallet balance</span>
      <button type="button" className="wallet-balance-refresh" aria-label="Refresh wallet balance" onClick={refresh} disabled={balance.status === "loading"}>
        <RefreshCw size={14} />
      </button>
    </div>
    <strong title={balance.status === "ready" ? `${walletBalanceText(balance, true)} NEAR total, including storage-backed and staked NEAR. Purchase Pass budgets are separate.` : undefined}>
      {walletBalanceText(balance)} <small>NEAR</small>
    </strong>
    <small role="status">{balance.status === "loading" ? "Loading wallet balance…" : balance.status === "unavailable" ? "Balance unavailable · retry" : "Total native NEAR · testnet"}</small>
  </section>;
}
