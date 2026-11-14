"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, LogOut, UserRound, X } from "lucide-react";
import { useWallet } from "./wallet";
import { WalletBalance, walletBalanceText, type useWalletBalance } from "./wallet-balance";

export function AccountMenu({ funds, disabled, onDisconnect }: {
  funds: ReturnType<typeof useWalletBalance>;
  disabled: boolean;
  onDisconnect: () => void;
}) {
  const wallet = useWallet();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.account);
      setCopyStatus("Address copied");
    } catch {
      setCopyStatus("Copy failed. Select the address above to copy it manually.");
    }
  }
  return <div className="account-widget">
    <button type="button" className="account-card" popoverTarget={id}
      aria-label={`Account ${wallet.account}; open options`} aria-expanded={open} aria-controls={id} disabled={disabled}>
      <span className="avatar"><UserRound size={20} /></span>
      <span><strong>{wallet.account}</strong><small>NEAR testnet account</small></span>
      <ChevronDown size={16} />
    </button>
    <div id={id} ref={panel} popover="auto" className="wallet-account-popover" aria-label="Account options"
      onToggle={event => {
        const expanded = event.newState === "open";
        setOpen(expanded);
        if (!expanded) setCopyStatus("");
      }}>
      <header>
        <span className="avatar"><UserRound size={20} /></span>
        <strong>Your account</strong>
        <button type="button" aria-label="Close account options" onClick={() => panel.current?.hidePopover()}><X size={17} /></button>
      </header>
      <p className="account-address">{wallet.account}</p>
      <div className="account-session"><span className={`network-dot ${wallet.authenticated ? "" : "session-locked"}`} />
        {wallet.authenticated ? "Private session active" : "Wallet connected · private sign-in needed"}
      </div>
      <div className="account-balance-summary">
        <WalletBalance {...funds} />
        {funds.balance.status === "ready" && <p className="account-exact-balance">{walletBalanceText(funds.balance,true)} NEAR</p>}
        <p className="account-balance-note">Includes storage-backed and staked NEAR. Purchase Pass budgets are held separately.</p>
      </div>
      <div className="account-actions">
        <button type="button" onClick={() => void copyAddress()}>
          {copyStatus === "Address copied" ? <Check size={17} /> : <Copy size={17} />} Copy address
        </button>
        <a href={`https://testnet.nearblocks.io/address/${encodeURIComponent(wallet.account)}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={17} /> View on explorer
        </a>
      </div>
      {copyStatus && <p className="account-copy-status" role="status">{copyStatus}</p>}
      <div className="account-signout">
        <button type="button" disabled={disabled} onClick={() => { panel.current?.hidePopover(); onDisconnect(); }}>
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </div>
  </div>;
}
