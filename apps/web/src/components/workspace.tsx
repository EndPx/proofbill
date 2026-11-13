"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  KeyRound,
  LoaderCircle,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  TriangleAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  formatNear,
  humanPhase,
  validAccountId,
  canTransfer,
  SERVICE_ID,
  SERVICE_PRICE,
  STORAGE_BUDGET,
  MODEL_ID,
  type PurchasePass,
  type PurchaseOrder,
  type PrivateResult,
  type PaymentMode,
} from "@proofbill/shared";
import { api, useWallet } from "./wallet";
type Job = { order_id: string; state: string; error_code: string | null };
type OrderDetail = {
  order: PurchaseOrder | null;
  job: Job | null;
  payment_mode?: PaymentMode;
  observations: { action: string; tx_hash: string; signer_id: string }[];
};
const errorCopy: Record<string, string> = {
  CONTRACT_NOT_CONFIGURED:
    "The testnet contract is being connected. Please check back shortly.",
  AUTHENTICATION_REQUIRED:
    "Sign a wallet message to unlock private tasks and results.",
  HOLDER_ONLY: "This action belongs to the current pass holder.",
  PASS_NOT_AVAILABLE: "This pass is already in use or has expired.",
  ASSIGN_AGENT_FIRST: "Assign the purchasing agent before running your task.",
  ORDER_ALREADY_QUEUED:
    "This pass already has a queued task. Open its order to continue.",
  PASS_JOB_REQUIRES_RECONCILIATION:
    "An earlier task may already be processing. Refresh its status before retrying. If it stays blocked, contact support for reconciliation.",
  PROVIDER_OUTCOME_UNKNOWN:
    "The inference was interrupted and will not run again automatically. You can request a refund while the contract allows it.",
  PRIVATE_RESULT_UNAVAILABLE:
    "The chain recorded delivery, but its private result is unavailable. No new inference will start. Contact support to reconcile this order.",
  SERVICE_UNAVAILABLE:
    "The service could not be reached. Refresh to check the latest contract state before retrying.",
  CHALLENGE_EXPIRED:
    "Your sign-in challenge expired. Please unlock your session again.",
};
function niceError(e: unknown) {
  const code = e instanceof Error ? e.message : "SERVICE_UNAVAILABLE";
  return (
    errorCopy[code] ??
    (code.length < 100
      ? code.replaceAll("_", " ").toLowerCase()
      : "The request could not be completed. Please check the current order state before retrying.")
  );
}
function Status({ value }: { value: string }) {
  const good = ["Completed", "Paid", "passed", "Available"].includes(value),
    bad = ["failed", "TransferFailed", "RefundFailed"].includes(value);
  return (
    <span
      className={`badge ${good ? "success" : bad ? "error" : ["Delivered", "InUse", "queued", "running"].includes(value) ? "warning" : "neutral"}`}
    >
      {good && <Check size={13} />}{" "}
      {value === "Delivered" ? "Needs review" : humanPhase(value)}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ReceiptText size={28} />
      </div>
      <h2>{title}</h2>
      <div className="empty-copy">{children}</div>
      {action}
    </div>
  );
}
const explorer = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
function PaymentChoice({
  mode,
  onChange,
  consent,
  onConsent,
  seller,
  disabled = false,
}: {
  mode: PaymentMode;
  onChange: (value: PaymentMode) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  seller: string;
  disabled?: boolean;
}) {
  return (
    <>
      <label className="field">
        Payment approval
        <select
          aria-label="Payment approval"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value as PaymentMode);
            onConsent(false);
          }}
        >
          <option value="Manual">Manual — owner approval</option>
          <option value="Automatic">Automatic — pay on delivery</option>
        </select>
      </label>
      {mode === "Automatic" ? (
        <div className="info">
          <ShieldCheck size={18} />
          <label>
            <input
              type="checkbox"
              checked={consent}
              disabled={disabled}
              onChange={(e) => onConsent(e.target.checked)}
            />{" "}
            I authorize one automatic payment of {formatNear(SERVICE_PRICE)}{" "}
            testnet NEAR to {seller || "the fixed service seller"} after the
            configured publisher records matching delivery. No final wallet
            approval is requested. Evidence checks do not guarantee answer
            quality.
          </label>
        </div>
      ) : (
        <p className="fine">
          You inspect the result and approve the payment in your wallet.
        </p>
      )}
    </>
  );
}
function AgentSettings({
  pass,
  hostedAgent,
  advanced,
  busy,
  onSave,
}: {
  pass: PurchasePass;
  hostedAgent: string;
  advanced: boolean;
  busy: boolean;
  onSave: (agent: string, mode: PaymentMode) => void;
}) {
  const [kind, setKind] = useState(
    pass.agent_id && pass.agent_id !== hostedAgent ? "custom" : "proofbill",
  );
  const [account, setAccount] = useState(
    pass.agent_id && pass.agent_id !== hostedAgent ? pass.agent_id : "",
  );
  const [mode, setMode] = useState<PaymentMode>(pass.payment_mode ?? "Manual");
  const [consent, setConsent] = useState(false);
  const agent = kind === "proofbill" ? hostedAgent : account.trim();
  return (
    <section className="form-panel" aria-label="Agent and payment settings">
      <label className="field">
        Purchasing agent
        <select
          aria-label="Purchasing agent"
          value={kind}
          disabled={busy}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="proofbill">ProofBill assistant</option>
          <option value="custom" disabled={!advanced}>
            My own agent
          </option>
        </select>
      </label>
      {kind === "custom" && (
        <label className="field">
          Agent NEAR account
          <input
            value={account}
            disabled={busy}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="assistant.your-account.testnet"
            autoCapitalize="none"
            spellCheck={false}
          />
          <small>
            Your agent signs reservations with its own account. Keep its private
            key in your agent runtime.
          </small>
        </label>
      )}
      {advanced && (
        <PaymentChoice
          mode={mode}
          onChange={setMode}
          consent={consent}
          onConsent={setConsent}
          seller={pass.seller_id}
          disabled={busy}
        />
      )}
      <p className="fine">
        The NFT stays in your wallet. Saving changes invalidates the previous
        agent authorization.
      </p>
      <button
        className="button primary"
        disabled={
          busy || !validAccountId(agent) || (mode === "Automatic" && !consent)
        }
        onClick={() => onSave(agent, mode)}
      >
        {pass.agent_id
          ? "Save agent and payment settings"
          : kind === "custom"
            ? "Assign my agent"
            : "Assign ProofBill assistant"}{" "}
        <Bot size={17} />
      </button>
    </section>
  );
}
export function Workspace() {
  const wallet = useWallet(),
    router = useRouter(),
    pathname = usePathname();
  const route = pathname.split("/").filter(Boolean),
    section = route[1] ?? "purchases",
    id = route[2] ?? "";
  const [passes, setPasses] = useState<PurchasePass[]>([]),
    [orders, setOrders] = useState<PurchaseOrder[]>([]),
    [pass, setPass] = useState<PurchasePass | null>(null),
    [detail, setDetail] = useState<OrderDetail | null>(null),
    [result, setResult] = useState<PrivateResult | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [brief, setBrief] = useState(""),
    [receiver, setReceiver] = useState(""),
    [hours, setHours] = useState("72"),
    [paymentMode, setPaymentMode] = useState<PaymentMode>("Manual"),
    [automaticConsent, setAutomaticConsent] = useState(false),
    [tab, setTab] = useState("Result");
  const refresh = useCallback(async () => {
    if (!wallet.config.configured) return;
    try {
      if (wallet.account) {
        const data = await api<{
          passes: PurchasePass[];
          orders: PurchaseOrder[];
        }>(`workspace?account=${encodeURIComponent(wallet.account)}`);
        setPasses(data.passes);
        setOrders(data.orders);
      } else {
        setPasses([]);
        setOrders([]);
      }
      if (section === "passes" && id && id !== "new")
        setPass(await api<PurchasePass>(`pass/${encodeURIComponent(id)}`));
      if ((section === "orders" || section === "receipts") && id) {
        setDetail(await api<OrderDetail>(`order/${encodeURIComponent(id)}`));
        if (wallet.authenticated) {
          try {
            const r = await api<{ result: PrivateResult | null }>(
              `private/${encodeURIComponent(id)}`,
            );
            setResult(r.result);
          } catch {
            setResult(null);
          }
        } else setResult(null);
      }
    } catch (e) {
      setError(niceError(e));
    }
  }, [
    wallet.account,
    wallet.authenticated,
    wallet.config.configured,
    section,
    id,
  ]);
  useEffect(() => {
    setPass(null);
    setDetail(null);
    setResult(null);
    setError("");
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [refresh]);
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(niceError(e));
    } finally {
      setBusy("");
    }
  }
  const available = passes
      .filter((p) => p.phase === "Available")
      .reduce((s, p) => s + BigInt(p.price_yocto), 0n),
    reserved = passes
      .filter((p) =>
        ["InUse", "RefundPending", "RefundFailed"].includes(p.phase),
      )
      .reduce((s, p) => s + BigInt(p.price_yocto), 0n),
    paid = orders
      .filter((o) => o.phase === "Paid")
      .reduce((s, o) => s + BigInt(o.price_yocto), 0n);
  const isOwner = pass?.owner_id === wallet.account;
  const Button = ({
    children,
    onClick,
    secondary = false,
    disabled = false,
  }: {
    children: ReactNode;
    onClick: () => void;
    secondary?: boolean;
    disabled?: boolean;
  }) => (
    <button
      className={`button ${secondary ? "secondary" : "primary"}`}
      onClick={onClick}
      disabled={!!busy || disabled}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
  const connectButton = (
    <Button onClick={() => void run("Connecting", wallet.connect)}>
      Connect wallet <ArrowRight size={16} />
    </Button>
  );
  const action = (
    method: string,
    args: Record<string, unknown>,
    deposit = "1",
  ) =>
    void run(method, async () => {
      await wallet.transact(method, args, deposit);
      setNotice(
        "Transaction submitted. This page follows the confirmed contract state.",
      );
    });
  const pageHeader = (
    title: string,
    description: string,
    button?: ReactNode,
  ) => (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {button}
    </header>
  );
  const passLink = (token: string) =>
    `/app/passes/${encodeURIComponent(token)}`;
  const orderLink = (order: string) =>
    `/app/orders/${encodeURIComponent(order)}`;
  const activeOrder = orders.find((o) => o.phase === "Delivered");
  let content: ReactNode;
  if (section === "passes" && id === "new")
    content = (
      <>
        {pageHeader(
          "New Purchase Pass",
          "One service purchase. A clear spending limit.",
        )}
        <div className="detail-grid">
          <section className="panel form-panel">
            <h2>Choose your purchase</h2>
            <div className="service-option">
              <span className="service-icon">
                <FileText />
              </span>
              <div>
                <strong>Private brief extraction</strong>
                <p>
                  Extract item, quantity and requester from a purchase brief.
                </p>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <label className="field">
              Pass expires after
              <select value={hours} onChange={(e) => setHours(e.target.value)}>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
              </select>
            </label>
            {wallet.config.advancedModes && (
              <PaymentChoice
                mode={paymentMode}
                onChange={setPaymentMode}
                consent={automaticConsent}
                onConsent={setAutomaticConsent}
                seller={wallet.config.sellerId ?? ""}
                disabled={!!busy}
              />
            )}
            <div className="info">
              <ShieldCheck size={18} />
              <p>
                You choose the agent and payment policy. An unused pass can be
                transferred with its service and refund rights.
              </p>
            </div>
            <dl className="facts">
              <div>
                <dt>Network</dt>
                <dd>NEAR testnet</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{MODEL_ID}</dd>
              </div>
              <div>
                <dt>Use</dt>
                <dd>One fixed-price order</dd>
              </div>
            </dl>
          </section>
          <aside className="receipt">
            <h2>Fund your pass</h2>
            <p>
              The service allocation stays in the contract until the selected
              payment policy settles the order or a refund is confirmed.
            </p>
            <div className="receipt-rule" />
            <dl className="facts">
              <div>
                <dt>Service allocation</dt>
                <dd>{formatNear(SERVICE_PRICE)} NEAR</dd>
              </div>
              <div>
                <dt>Storage budget</dt>
                <dd>{formatNear(STORAGE_BUDGET)} NEAR</dd>
              </div>
            </dl>
            <div className="amount">
              {formatNear(
                (BigInt(SERVICE_PRICE) + BigInt(STORAGE_BUDGET)).toString(),
              )}
              <small>testnet NEAR + wallet gas</small>
            </div>
            <p className="fine">
              Storage remains reserved while the NFT and its history exist. It
              is separate from the refundable service allocation.
            </p>
            {wallet.account ? (
              <Button
                disabled={
                  !wallet.config.configured ||
                  (paymentMode === "Automatic" && !automaticConsent)
                }
                onClick={() =>
                  void run("Creating pass", async () => {
                    await wallet.transact(
                      "create_purchase_pass",
                      {
                        service_id: SERVICE_ID,
                        payment_mode: paymentMode,
                        expires_at_ns: (
                          (BigInt(Date.now()) + BigInt(hours) * 3600000n) *
                          1000000n
                        ).toString(),
                      },
                      (
                        BigInt(SERVICE_PRICE) + BigInt(STORAGE_BUDGET)
                      ).toString(),
                    );
                    router.push("/app/passes");
                  })
                }
              >
                Confirm and mint pass <Plus size={16} />
              </Button>
            ) : (
              connectButton
            )}
          </aside>
        </div>
      </>
    );
  else if (section === "passes" && id) {
    content = pass ? (
      <>
        <Link className="back-link" href="/app/passes">
          <ArrowLeft size={15} /> Purchase Passes
        </Link>
        {pageHeader(
          `Purchase Pass #${pass.token_id.replace("pass-", "")}`,
          "Your right to one bounded AI service purchase.",
          <Status value={pass.phase} />,
        )}
        <div className="detail-grid">
          <section>
            <div className="pass-large">
              <div className="pass-art">
                <img src="/brand/icon.png" alt="ProofBill Purchase Pass" />
                <span>Purchase Pass</span>
                <strong>{pass.token_id}</strong>
              </div>
              <div className="pass-caption">
                <span>Private brief extraction</span>
                <Status value={pass.phase} />
              </div>
            </div>
            <dl className="facts panel">
              <div>
                <dt>Current holder</dt>
                <dd>{pass.owner_id}</dd>
              </div>
              <div>
                <dt>Seller</dt>
                <dd>{pass.seller_id}</dd>
              </div>
              <div>
                <dt>Service allocation</dt>
                <dd>{formatNear(pass.price_yocto)} testnet NEAR</dd>
              </div>
              <div>
                <dt>Expiry</dt>
                <dd>
                  {new Date(
                    Number(BigInt(pass.expires_at_ns) / 1000000n),
                  ).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Purchasing agent</dt>
                <dd>{pass.agent_id ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Payment approval</dt>
                <dd>{pass.payment_mode ?? "Manual"}</dd>
              </div>
            </dl>
            {pass.order_id && (
              <Link
                className="button secondary"
                href={orderLink(pass.order_id)}
              >
                Open linked order <ArrowRight size={16} />
              </Link>
            )}
          </section>
          <aside className="panel form-panel">
            <h2>
              {pass.phase === "Available"
                ? "Put your pass to work"
                : "Pass activity"}
            </h2>
            {!isOwner ? (
              <p>
                Only the current holder can use, transfer or refund this pass.
              </p>
            ) : pass.phase === "Available" ? (
              <>
                <AgentSettings
                  key={`${pass.token_id}:${pass.authorization_revision}`}
                  pass={pass}
                  hostedAgent={wallet.config.agentId}
                  advanced={!!wallet.config.advancedModes}
                  busy={!!busy}
                  onSave={(agent, mode) =>
                    void action("assign_agent", {
                      token_id: pass.token_id,
                      expected_revision: pass.authorization_revision,
                      agent_id: agent,
                      payment_mode: mode,
                    })
                  }
                />
                {pass.agent_id && pass.agent_id !== wallet.config.agentId ? (
                  <div className="info">
                    <Bot size={18} />
                    <div>
                      <strong>Your agent is assigned</strong>
                      <p>
                        Give your agent pass ID <code>{pass.token_id}</code>. It
                        signs the reservation and submits its own request; the
                        NFT remains yours.
                      </p>
                      <a
                        href="https://github.com/EndPx/proofbill/blob/main/docs/agent-integration.md"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Own-agent SDK and setup guide <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                ) : pass.agent_id ? (
                  <>
                    <div className="trust-line">
                      <Bot size={17} /> ProofBill assistant is assigned
                    </div>
                    <label className="field">
                      Your private purchase brief
                      <textarea
                        maxLength={8000}
                        rows={5}
                        value={brief}
                        onChange={(e) => setBrief(e.target.value)}
                        placeholder="What items do you need, how many, and who requested them?"
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() =>
                        setBrief(
                          "We need 12 workshop notebooks for our community session. Requested by the Community team.",
                        )
                      }
                    >
                      Use a synthetic example
                    </button>
                    {!wallet.authenticated ? (
                      <Button
                        onClick={() =>
                          void run("Unlocking", wallet.authenticate)
                        }
                      >
                        Unlock private session <KeyRound size={16} />
                      </Button>
                    ) : (
                      <Button
                        disabled={brief.trim().length < 8}
                        onClick={() =>
                          void run("Queuing order", async () => {
                            const r = await api<{ job: Job }>("jobs", {
                              tokenId: pass.token_id,
                              input: brief,
                            });
                            router.push(orderLink(r.job.order_id));
                          })
                        }
                      >
                        Run agent <ArrowRight size={16} />
                      </Button>
                    )}
                    <p className="fine">
                      Your brief and result stay private to this buyer.
                      Inference is processed by the service operator and NEAR
                      AI.
                    </p>
                  </>
                ) : null}
                <hr />
                <h3>Transfer unused pass</h3>
                <p className="fine">
                  The receiver gets the service allocation and refund right. The
                  previous agent assignment and automatic payment permission are
                  cleared.
                </p>
                <label className="field">
                  Receiver account
                  <input
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    placeholder="teammate.testnet"
                  />
                </label>
                <Button
                  secondary
                  disabled={
                    !canTransfer(pass) ||
                    !validAccountId(receiver) ||
                    receiver === wallet.account
                  }
                  onClick={() =>
                    action("nft_transfer", {
                      token_id: pass.token_id,
                      receiver_id: receiver,
                      approval_id: null,
                      memo: "Transfer unused purchase entitlement",
                    })
                  }
                >
                  Transfer pass <ArrowUpRight size={16} />
                </Button>
                <hr />
                <Button
                  secondary
                  onClick={() =>
                    action("cancel_and_refund", {
                      token_id: pass.token_id,
                      expected_revision: pass.authorization_revision,
                    })
                  }
                >
                  Request service refund
                </Button>
              </>
            ) : (
              <>
                <p>
                  {pass.phase === "Completed"
                    ? "This purchase is complete. The pass keeps its public receipt history and has no remaining service value."
                    : pass.phase === "Refunded"
                      ? "The service allocation was refunded. This pass has no remaining purchase value."
                      : "Transfer is locked while this pass has an active order or unresolved payment."}
                </p>
                {pass.phase === "RefundFailed" && (
                  <Button
                    secondary
                    onClick={() =>
                      action("retry_failed_refund", {
                        token_id: pass.token_id,
                        expected_attempt_nonce: pass.attempt,
                      })
                    }
                  >
                    Retry confirmed failed refund
                  </Button>
                )}
                {pass.order_id && (
                  <Link
                    className="button primary"
                    href={orderLink(pass.order_id)}
                  >
                    View order <ArrowRight size={16} />
                  </Link>
                )}
              </>
            )}
          </aside>
        </div>
      </>
    ) : (
      <Empty title="Loading your Purchase Pass">
        Reading confirmed state from NEAR testnet.
      </Empty>
    );
  } else if ((section === "orders" || section === "receipts") && id) {
    const o = detail?.order;
    const receiptMode = section === "receipts";
    const paymentSummary = {
      Reserved:
        detail?.payment_mode === "Automatic"
          ? "Waiting for matching publisher delivery. Your advance authorization starts the initial seller payment."
          : "Waiting for delivery. You can review the result before authorizing payment.",
      Delivered: "Review the result before approving this exact order and seller payment.",
      PaymentPending: "The seller transfer is pending. Paid appears only after the contract confirms success.",
      Paid: "The contract confirmed the seller transfer. Your Purchase Pass is Completed.",
      TransferFailed: "The seller transfer failed. The buyer can approve a retry or request a service refund.",
      Refunded: "The contract confirmed the service refund to the buyer. Storage backing is separate.",
      RefundFailed: "The service refund failed. Open the Purchase Pass to retry the confirmed failed refund.",
      RefundPending: "The service refund is pending. Its outcome has not been confirmed.",
    };
    content = (
      <>
        <Link className="back-link" href="/app/purchases">
          <ArrowLeft size={15} /> Purchases
        </Link>
        {pageHeader(
          receiptMode ? "Purchase receipt" : "Private brief extraction",
          o
            ? `${o.order_id} · Agent: ${o.agent_id === wallet.config.agentId ? "ProofBill assistant" : o.agent_id}`
            : id,
          o && <Status value={o.phase} />,
        )}
        {o ? (
          <div className="detail-grid">
            <section>
              <div className="tabs">
                {["Result", "Request", "Evidence"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Result" ? (
                <section className="panel">
                  <h2>Result</h2>
                  {result ? (
                    <dl className="result-fields">
                      {Object.entries(result.output).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k.replaceAll("_", " ")}</dt>
                          <dd>
                            {typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="private-empty">
                      <KeyRound />
                      <h3>
                        {wallet.authenticated
                          ? "Waiting for your result"
                          : "Your result is private"}
                      </h3>
                      <p>
                        {detail?.job?.error_code
                          ? niceError(new Error(detail.job.error_code))
                          : wallet.authenticated
                            ? "The agent and verifier are processing this order. This page updates from recorded progress."
                            : "The historical buyer can unlock the result with a wallet signature."}
                      </p>
                      {wallet.account === o.buyer_id &&
                        !wallet.authenticated && (
                          <Button
                            onClick={() =>
                              void run("Unlocking", wallet.authenticate)
                            }
                          >
                            Unlock private result
                          </Button>
                        )}
                    </div>
                  )}
                </section>
              ) : tab === "Evidence" ? (
                <section className="panel">
                  <h2>Evidence scope</h2>
                  <p>
                    Required response signature and preflight checks are
                    performed offchain by the disclosed application verifier.
                    They do not guarantee answer accuracy.
                  </p>
                  <dl className="facts">
                    <div>
                      <dt>Request commitment</dt>
                      <dd className="hash">{o.request_commitment}</dd>
                    </div>
                    <div>
                      <dt>Response commitment</dt>
                      <dd className="hash">
                        {o.response_commitment ?? "Not published"}
                      </dd>
                    </div>
                    <div>
                      <dt>Evidence commitment</dt>
                      <dd className="hash">
                        {o.evidence_commitment ?? "Not published"}
                      </dd>
                    </div>
                  </dl>
                  {result && (
                    <a
                      className="button secondary"
                      href={`/api/private/${encodeURIComponent(id)}?export=1`}
                    >
                      Export private evidence <ArrowUpRight size={16} />
                    </a>
                  )}
                </section>
              ) : (
                <section className="panel">
                  <h2>Purchase terms</h2>
                  <dl className="facts">
                    <div>
                      <dt>Buyer</dt>
                      <dd>{o.buyer_id}</dd>
                    </div>
                    <div>
                      <dt>Agent</dt>
                      <dd>{o.agent_id}</dd>
                    </div>
                    <div>
                      <dt>Seller</dt>
                      <dd>{o.seller_id}</dd>
                    </div>
                    <div>
                      <dt>Purchase Pass</dt>
                      <dd>
                        <Link href={passLink(o.token_id)}>{o.token_id}</Link>
                      </dd>
                    </div>
                  </dl>
                  <p className="fine">
                    The exact request and private evidence are available to the
                    historical buyer in the authorized export.
                  </p>
                </section>
              )}
              <section className="section-gap">
                <h2>Evidence checks</h2>
                <div className="check-list">
                  {result?.checks?.length ? (
                    result.checks.map((c) => (
                      <div className="check-row" key={c.name}>
                        <span>{c.name}</span>
                        <span
                          className={
                            c.state === "passed" ? "check-good" : "muted"
                          }
                        >
                          {c.state === "passed" ? (
                            <CheckCircle2 size={18} />
                          ) : c.state === "failed" ? (
                            <XCircle size={18} />
                          ) : (
                            <Clock3 size={18} />
                          )}{" "}
                          {humanPhase(c.state.replaceAll("_", " "))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="fine">
                      {o.phase === "Reserved"
                        ? "Evidence is being collected and checked."
                        : "Unlock the buyer's private report to inspect the individual checks."}
                    </p>
                  )}
                </div>
                <p className="fine scope-note">
                  <ShieldCheck size={16} /> Signature integrity does not
                  guarantee answer accuracy. TLS binding and source-image
                  allowlisting are not checked.
                </p>
              </section>
              {detail.observations.length > 0 && (
                <section className="section-gap">
                  <h2>Onchain references</h2>
                  {detail.observations.map((r, i) => (
                    <a
                      key={r.tx_hash + i}
                      className="chain-link"
                      href={explorer(r.tx_hash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{r.action.replaceAll("_", " ")}</span>
                      <span>
                        {r.tx_hash.slice(0, 9)}… <ExternalLink size={13} />
                      </span>
                    </a>
                  ))}
                </section>
              )}
            </section>
            <aside>
              <div className="receipt">
                <h2>
                  {o.phase === "Paid"
                    ? "Payment receipt"
                    : detail?.payment_mode === "Automatic"
                      ? "Automatic payment"
                      : "Payment status"}
                </h2>
                <p>{o.order_id}</p>
                <p className="fine">
                  {detail?.payment_mode === "Automatic"
                    ? "Owner preauthorized one payment after matching publisher delivery."
                    : "The buyer authorizes payment in the wallet after delivery."}
                </p>
                <dl className="facts">
                  <div>
                    <dt>Seller</dt>
                    <dd>{o.seller_id}</dd>
                  </div>
                  <div>
                    <dt>Agent</dt>
                    <dd>{o.agent_id}</dd>
                  </div>
                </dl>
                <div className="receipt-rule" />
                <div className="amount">
                  {formatNear(o.price_yocto)}
                  <small>testnet NEAR</small>
                </div>
                <Status value={o.phase} />
                <p className="fine">{paymentSummary[o.phase]}</p>
                {wallet.account === o.buyer_id && (
                  <>
                    {o.phase === "Delivered" && (
                      <Button
                        onClick={() =>
                          action("approve_and_pay", {
                            order_id: id,
                            expected_delivery_commitment: o.evidence_commitment,
                          })
                        }
                      >
                        Approve payment <ArrowRight size={16} />
                      </Button>
                    )}
                    {o.phase === "TransferFailed" && (
                      <Button
                        onClick={() =>
                          action("retry_failed_payment", {
                            order_id: id,
                            expected_attempt_nonce: o.attempt,
                          })
                        }
                      >
                        Retry failed payment
                      </Button>
                    )}
                    {["Reserved", "Delivered", "TransferFailed"].includes(
                      o.phase,
                    ) && (
                      <Button
                        secondary
                        onClick={() =>
                          action("cancel_and_refund", {
                            token_id: o.token_id,
                            expected_revision: o.revision,
                          })
                        }
                      >
                        Request service refund
                      </Button>
                    )}
                  </>
                )}
                {o.phase === "Paid" && !receiptMode && (
                  <Link
                    className="button secondary"
                    href={`/receipts/${encodeURIComponent(id)}`}
                  >
                    Open receipt <ReceiptText size={16} />
                  </Link>
                )}
              </div>
              <section className="timeline">
                <h2>Order timeline</h2>
                {[
                  { label: "Order reserved", done: true },
                  { label: "Result delivered", done: !!o.response_commitment },
                  {
                    label:
                      detail?.payment_mode === "Automatic"
                        ? "Automatic payment authorized in advance"
                        : "Buyer payment approval",
                    done: detail?.payment_mode === "Automatic" || o.attempt > 0,
                  },
                  { label: "Payment confirmed", done: o.phase === "Paid" },
                ].map((s, i) => (
                  <div
                    className={`timeline-row ${s.done ? "done" : ""}`}
                    key={s.label}
                  >
                    {s.done ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <span className="timeline-dot" />
                    )}
                    <span>{s.label}</span>
                    {!s.done && (
                      <small>
                        {i === 2 && o.phase === "Delivered"
                          ? "Awaiting approval"
                          : "Not confirmed"}
                      </small>
                    )}
                  </div>
                ))}
              </section>
            </aside>
          </div>
        ) : (
          <Empty
            title={
              detail?.job
                ? "Your agent is preparing the order"
                : "Loading order"
            }
          >
            {detail?.job?.error_code
              ? niceError(new Error(detail.job.error_code))
              : "The order appears here after its NEAR reservation is confirmed."}
          </Empty>
        )}
      </>
    );
  } else if (section === "passes")
    content = (
      <>
        {pageHeader(
          "Purchase Passes",
          "A funded right to one AI service purchase.",
          <Link className="button primary" href="/app/passes/new">
            <Plus size={17} /> New Purchase Pass
          </Link>,
        )}
        {passes.length ? (
          <div className="pass-grid">
            {passes.map((p) => (
              <Link
                className="pass-card"
                href={passLink(p.token_id)}
                key={p.token_id}
              >
                <div className="pass-art">
                  <img src="/brand/icon.png" alt="" />
                  <span>Purchase Pass</span>
                  <strong>{p.token_id}</strong>
                </div>
                <div className="pass-card-body">
                  <Status value={p.phase} />
                  <h2>Private brief extraction</h2>
                  <div>
                    <strong>{formatNear(p.price_yocto)}</strong>
                    <span>testnet NEAR</span>
                  </div>
                  <small>
                    {p.phase === "Available"
                      ? "Ready to assign and use"
                      : "Open pass details"}
                  </small>
                  <ArrowUpRight size={18} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Your first purchase starts with a pass">
            Fund a fixed-price service, then let an agent order within those
            rules. Your unused pass can also be transferred to a teammate.
          </Empty>
        )}
      </>
    );
  else {
    const visible = orders.filter(
      (o) =>
        (filter === "All" ||
          (filter === "Needs review"
            ? o.phase === "Delivered"
            : o.phase === "Paid")) &&
        `${o.order_id} ${o.seller_id}`.includes(query),
    );
    content = (
      <>
        {pageHeader(
          section === "receipts" ? "Receipts" : "Purchases",
          section === "receipts"
            ? "A clear record of completed service payments."
            : "Track what your agents buy.",
          <Link className="button primary" href="/app/passes/new">
            <Plus size={17} /> New Purchase Pass
          </Link>,
        )}
        <div className="ledger">
          {[
            { label: "Available to use", value: available },
            { label: "Reserved / in flight", value: reserved },
            { label: "Paid for services", value: paid },
          ].map((v) => (
            <div key={v.label}>
              <span>{v.label}</span>
              <strong>
                {wallet.account ? formatNear(v.value.toString()) : "—"}
              </strong>
              <small>testnet NEAR</small>
            </div>
          ))}
        </div>
        <div className="purchase-grid">
          <section>
            <h2>
              {section === "receipts" ? "Payment receipts" : "Recent orders"}
            </h2>
            <div className="table-tools">
              <div className="tabs">
                {["All", "Needs review", "Paid"].map((t) => (
                  <button
                    key={t}
                    className={filter === t ? "selected" : ""}
                    onClick={() => setFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="search">
                <Search size={16} />
                <input
                  aria-label="Search orders"
                  placeholder="Search orders"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            {visible.length ? (
              <div className="order-table">
                <div className="table-head">
                  <span>Service</span>
                  <span>Agent</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {visible
                  .filter((o) => section !== "receipts" || o.phase === "Paid")
                  .map((o) => (
                    <Link
                      className="order-row"
                      href={
                        section === "receipts"
                          ? `/receipts/${o.order_id}`
                          : orderLink(o.order_id)
                      }
                      key={o.order_id}
                    >
                      <span className="order-service">
                        <FileText size={21} />
                        <span>
                          <strong>Private brief extraction</strong>
                          <small>{o.order_id}</small>
                        </span>
                      </span>
                      <span className="agent-name">
                        <Bot size={17} />{" "}
                        {o.agent_id === wallet.config.agentId
                          ? "ProofBill assistant"
                          : o.agent_id}
                      </span>
                      <span>
                        <strong>{formatNear(o.price_yocto)}</strong>
                        <small>testnet NEAR</small>
                      </span>
                      <Status value={o.phase} />
                    </Link>
                  ))}
              </div>
            ) : (
              <Empty
                title={
                  wallet.account
                    ? "No purchases yet"
                    : "Your agent's purchases, in one place"
                }
              >
                {wallet.account
                  ? "Create a Purchase Pass and give your agent its first task."
                  : "Connect a testnet wallet to manage passes and payment policies. Sign a separate message to unlock private results."}
                {!wallet.account && (
                  <div className="empty-action">{connectButton}</div>
                )}
              </Empty>
            )}
          </section>
          <aside className="receipt review-card">
            <ReceiptText size={27} />
            <h2>
              {activeOrder
                ? "Ready for review"
                : "A receipt for every purchase"}
            </h2>
            {activeOrder ? (
              <>
                <p>{activeOrder.order_id}</p>
                <div className="receipt-rule" />
                <div className="amount">
                  {formatNear(activeOrder.price_yocto)}
                  <small>testnet NEAR</small>
                </div>
                <p>Inspect the result and its evidence before paying.</p>
                <Link
                  className="button primary"
                  href={orderLink(activeOrder.order_id)}
                >
                  Review order <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <p>
                  Follow what was requested, what arrived, and what was paid.
                </p>
                <div className="receipt-rule" />
                <div className="mini-step">
                  <KeyRound size={17} /> A bounded Purchase Pass
                </div>
                <div className="mini-step">
                  <ShieldCheck size={17} /> Inspectable response evidence
                </div>
                <div className="mini-step">
                  <ReceiptText size={17} /> A confirmed payment record
                </div>
                <Link className="button secondary" href="/app/passes">
                  View Purchase Passes
                </Link>
              </>
            )}
          </aside>
        </div>
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/brand/icon.png" alt="" />
          ProofBill
        </Link>
        <div className="sidebar-search">
          <Search size={16} />
          <span>Your purchase workspace</span>
        </div>
        <div className="budget">
          <span>Available budget</span>
          <strong>
            {wallet.account ? formatNear(available.toString()) : "—"}
          </strong>
          <small>testnet NEAR</small>
          <Link className="button light" href="/app/passes/new">
            Fund a Purchase Pass
          </Link>
        </div>
        <nav aria-label="Workspace">
          <Link
            className={
              section === "purchases" || section === "orders" ? "active" : ""
            }
            href="/app/purchases"
          >
            <ShoppingCart size={20} />
            Purchases
          </Link>
          <Link
            className={section === "passes" ? "active" : ""}
            href="/app/passes"
          >
            <Ticket size={20} />
            Purchase Passes
          </Link>
          <Link
            className={section === "receipts" ? "active" : ""}
            href="/app/receipts"
          >
            <ReceiptText size={20} />
            Receipts
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <a
            href="https://github.com/EndPx/proofbill"
            target="_blank"
            rel="noreferrer"
          >
            Project & documentation <ArrowUpRight size={15} />
          </a>
          <button
            className="account-card"
            aria-label={
              wallet.account
                ? `Account ${wallet.account}; disconnect`
                : "Connect wallet"
            }
            onClick={() =>
              void run(
                "Account",
                wallet.account ? wallet.disconnect : wallet.connect,
              )
            }
            disabled={!!busy}
          >
            <span className="avatar">
              <UserRound size={20} />
            </span>
            <span>
              <strong>{wallet.account || "Connect wallet"}</strong>
              <small>
                {wallet.account
                  ? "NEAR testnet account"
                  : "Start your first purchase"}
              </small>
            </span>
            {wallet.account ? <LogOut size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </aside>
      <div className="content-sheet">
        <div
          className="content-scroll"
          role="region"
          aria-label="Purchase workspace content"
          tabIndex={0}
        >
          <div className="topbar">
            <span className="badge neutral">
              <span className="network-dot" />
              NEAR testnet
            </span>
            <div>
              {wallet.account && !wallet.authenticated && (
                <button
                  className="text-button"
                  onClick={() => void run("Unlocking", wallet.authenticate)}
                >
                  <KeyRound size={14} /> Unlock private session
                </button>
              )}
              <button
                aria-label="Refresh confirmed state"
                className="icon-button"
                onClick={() => void refresh()}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <main className="workspace-main">
            {wallet.config.loaded && !wallet.config.configured && (
              <div className="banner">
                <TriangleAlert size={18} />
                <span>
                  Testnet contract setup is in progress. Live purchase actions
                  become available after deployment.
                </span>
              </div>
            )}
            {error && (
              <div className="banner error-banner" role="alert">
                <TriangleAlert size={18} />
                <span>{error}</span>
                <button aria-label="Dismiss error" onClick={() => setError("")}>
                  ×
                </button>
              </div>
            )}
            {notice && (
              <div className="banner success-banner" role="status">
                <CheckCircle2 size={18} />
                {notice}
              </div>
            )}
            {content}
          </main>
          <footer className="app-footer">
            <span>ProofBill · Know what your agent bought.</span>
            <span>NEAR testnet · Test funds only</span>
          </footer>
        </div>
      </div>
      {busy && (
        <div className="progress-toast" role="status">
          <LoaderCircle className="spin" size={18} />
          {busy.replaceAll("_", " ")}…
        </div>
      )}
    </div>
  );
}
