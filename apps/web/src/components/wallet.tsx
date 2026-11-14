"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NearConnector } from "@hot-labs/near-connect";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "SERVICE_UNAVAILABLE");
  return data;
}
interface Config {
  contractId: string;
  agentId: string;
  configured: boolean;
  network: string;
  loaded?: boolean;
  advancedModes?: boolean;
  budgetPasses?: boolean;
  flexibleBudgets?: boolean;
  sellerId?: string;
}
interface WalletState {
  account: string;
  ready: boolean;
  connectionError: string;
  authenticated: boolean;
  authenticating: boolean;
  authenticationError: string;
  config: Config;
  connect: () => Promise<void>;
  authenticate: () => Promise<void>;
  disconnect: () => Promise<void>;
  transact: (
    method: string,
    args: Record<string, unknown>,
    deposit?: string,
  ) => Promise<void>;
}
const Context = createContext<WalletState | null>(null);
export function WalletProvider({ children }: { children: ReactNode }) {
  const connector = useRef<NearConnector | null>(null),
    accountRef = useRef(""),
    authRevision = useRef(0),
    signing = useRef(false),
    [account, setAccount] = useState(""),
    [ready, setReady] = useState(false),
    [connectionError, setConnectionError] = useState(""),
    [authenticated, setAuthenticated] = useState(false),
    [authenticating, setAuthenticating] = useState(false),
    [authenticationError, setAuthenticationError] = useState(""),
    [config, setConfig] = useState<Config>({
      contractId: "",
      agentId: "",
      configured: false,
      network: "testnet",
      loaded: false,
    });
  function selectAccount(id: string) {
    if (accountRef.current !== id) {
      accountRef.current = id;
      authRevision.current += 1;
      signing.current = false;
      setAuthenticated(false);
      setAuthenticating(false);
      setAuthenticationError("");
    }
    setAccount(id);
  }
  useEffect(() => {
    let active = true;
    void api<Config>("config").then((c) => {
      if (active) setConfig({ ...c, loaded: true });
    });
    void import("@hot-labs/near-connect")
      .then(async ({ NearConnector }) => {
        if (!active) return;
        const c = new NearConnector({
          network: "testnet",
          features: { signMessage: true, signAndSendTransaction: true },
        });
        connector.current = c;
        c.on("wallet:signIn", (p) => {
          if (active) selectAccount(p.accounts[0]?.accountId ?? "");
        });
        c.on("wallet:signOut", () => {
          if (active) {
            selectAccount("");
          }
        });
        try {
          const connected = await c.getConnectedWallet();
          if (active) selectAccount(connected.accounts[0]?.accountId ?? "");
        } catch {
          /* Disconnected is the normal initial state. */
        }
      })
      .catch(() => {
        if (active)
          setConnectionError(
            "The wallet connector could not load. Please reload to try again.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      authRevision.current += 1;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const revision = authRevision.current;
    if (account && !signing.current)
      void api<{ accountId: string | null }>("session")
        .then((s) => {
          if (active && revision === authRevision.current && !signing.current)
            setAuthenticated(s.accountId === account);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [account]);
  async function authenticateFor(id: string, reuseSession = false) {
    if (!id || id !== accountRef.current) throw new Error("CONNECT_WALLET_FIRST");
    if (signing.current) return;
    const revision = ++authRevision.current;
    const stillCurrent = () => revision === authRevision.current && accountRef.current === id;
    signing.current = true;
    setAuthenticating(true);
    setAuthenticationError("");
    try {
      if (reuseSession) {
        const s = await api<{ accountId: string | null }>("session").catch(() => null);
        if (!stillCurrent()) throw new Error("ACCOUNT_CHANGED");
        if (s?.accountId === id) {
          setAuthenticated(true);
          return;
        }
      }
      const w = await connector.current?.wallet();
      if (!w) throw new Error("CONNECT_WALLET_FIRST");
      const c = await api<{
        id: string;
        message: string;
        recipient: string;
        nonce: string;
      }>("auth/challenge", { accountId: id });
      if (!stillCurrent()) throw new Error("ACCOUNT_CHANGED");
      const signed = await w.signMessage({
        message: c.message,
        recipient: c.recipient,
        nonce: Uint8Array.from(atob(c.nonce), (c) => c.charCodeAt(0)),
      });
      if (!stillCurrent() || signed.accountId !== id) throw new Error("ACCOUNT_CHANGED");
      await api("auth/verify", { id: c.id, ...signed });
      if (!stillCurrent()) throw new Error("ACCOUNT_CHANGED");
      setAuthenticated(true);
    } catch (error) {
      if (stillCurrent()) {
        setAuthenticated(false);
        setAuthenticationError("Your wallet is connected, but private sign-in was not completed. Try signing in again to access private tasks and results.");
      }
      throw error;
    } finally {
      if (stillCurrent()) {
        signing.current = false;
        setAuthenticating(false);
      }
    }
  }
  async function connect() {
    const c = connector.current;
    if (!c) throw new Error("WALLET_LOADING");
    const w = await c.connect();
    const accounts = await w.getAccounts();
    const id = accounts[0]?.accountId;
    if (!id) throw new Error("NO_WALLET_ACCOUNT");
    selectAccount(id);
    // A cancelled message must not undo a successful wallet connection.
    await authenticateFor(id, true).catch(() => {});
  }
  async function disconnect() {
    selectAccount("");
    await connector.current?.disconnect();
    await api("auth/logout", {});
  }
  async function transact(
    method: string,
    args: Record<string, unknown>,
    deposit = "1",
  ) {
    if (!config.contractId) throw new Error("CONTRACT_NOT_CONFIGURED");
    const w = await connector.current?.wallet();
    if (!w || !account) throw new Error("CONNECT_WALLET_FIRST");
    const result = await w.signAndSendTransaction({
      receiverId: config.contractId,
      actions: [
        {
          type: "FunctionCall",
          params: { methodName: method, args, deposit, gas: "150000000000000" },
        },
      ],
    });
    const hash = (result as { transaction?: { hash?: string } })?.transaction
      ?.hash;
    if (hash && authenticated) await api("observe", { hash });
  }
  return (
    <Context.Provider
      value={{
        account,
        ready,
        connectionError,
        authenticated,
        authenticating,
        authenticationError,
        config,
        connect,
        authenticate: () => authenticateFor(account),
        disconnect,
        transact,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWallet() {
  const c = useContext(Context);
  if (!c) throw new Error("WalletProvider missing");
  return c;
}
