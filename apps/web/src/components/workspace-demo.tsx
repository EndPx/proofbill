"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingCart,
  Ticket,
  UserRound,
} from "lucide-react";
import { formatNear, SERVICE_PRICE, STORAGE_BUDGET } from "@proofbill/shared";
import {
  demoOrders,
  demoPasses,
  type DemoOrder,
  type DemoPass,
} from "@/data/workspace-demo";
import styles from "./workspace-demo.module.css";

type View = "purchases" | "passes" | "receipts" | "order" | "receipt" | "new";
const tabs = ["Result", "Request", "Evidence"] as const;
type Tab = (typeof tabs)[number];

export function WorkspaceDemo() {
  const scroll = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("order");
  const [orders, setOrders] = useState<DemoOrder[]>(demoOrders);
  const [passes, setPasses] = useState<DemoPass[]>(demoPasses);
  const [selected, setSelected] = useState("demo-order-001");
  const [tab, setTab] = useState<Tab>("Result");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("My next purchase");
  const [notice, setNotice] = useState("");
  const order = orders.find((record) => record.id === selected)!;
  const activeMenu =
    view === "receipt"
      ? "receipts"
      : view === "order"
        ? "purchases"
        : view === "new"
          ? "passes"
          : view;
  const available =
    BigInt(passes.filter((pass) => pass.phase === "Available").length) *
    BigInt(SERVICE_PRICE);

  function menu(next: View) {
    scroll.current?.scrollTo({ top: 0 });
    setView(next);
    setQuery("");
    setNotice("");
  }
  function open(record: DemoOrder, receipt = false) {
    scroll.current?.scrollTo({ top: 0 });
    setSelected(record.id);
    setTab("Result");
    setView(receipt ? "receipt" : "order");
    setNotice("");
  }
  function reset() {
    scroll.current?.scrollTo({ top: 0 });
    setOrders(demoOrders);
    setPasses(demoPasses);
    setSelected("demo-order-001");
    setTab("Result");
    setQuery("");
    setName("My next purchase");
    setView("order");
    setNotice("Demo reset to its sample data.");
  }
  function createPass(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    scroll.current?.scrollTo({ top: 0 });
    setPasses((previous) => [
      ...previous,
      {
        id: `demo-pass-${String(previous.length + 1).padStart(3, "0")}`,
        name: name.trim(),
        phase: "Available",
      },
    ]);
    setView("passes");
    setNotice("Demo pass created. No wallet or funds were used.");
  }
  function approve() {
    setOrders((previous) =>
      previous.map((record) =>
        record.id === selected ? { ...record, phase: "Paid" } : record,
      ),
    );
    setPasses((previous) =>
      previous.map((pass) =>
        pass.id === order.passId ? { ...pass, phase: "Completed" } : pass,
      ),
    );
    setNotice(
      "Demo approval complete. This is a local simulation, not a transaction.",
    );
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next]);
    document.getElementById(`demo-tab-${tabs[next]}`)?.focus();
  }
  const status = (phase: string) => (
    <span
      className={styles.status}
      data-good={
        phase === "Paid" || phase === "Completed" || phase === "Available"
      }
    >
      {phase === "Paid" && <Check size={11} />}
      {phase === "Delivered"
        ? "Needs review"
        : phase === "InUse"
          ? "In use"
          : phase}
    </span>
  );
  const title =
    view === "passes"
      ? "Purchase Passes"
      : view === "new"
        ? "New Purchase Pass"
        : view === "purchases"
          ? "Purchases"
          : view === "receipts"
            ? "Receipts"
            : view === "receipt"
              ? "Payment receipt"
              : "Private brief extraction";
  const filtered = orders.filter(
    (record) =>
      (view !== "receipts" || record.phase === "Paid") &&
      `${record.title} ${record.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <div
      className={styles.demo}
      role="region"
      aria-label="Interactive workspace demo"
    >
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image src="/brand/icon.png" width={27} height={27} alt="" />
          ProofBill
        </div>
        <div className={styles.budget}>
          <span>Available demo budget</span>
          <strong>{formatNear(available.toString())}</strong>
          <small>sample testnet NEAR</small>
          <button type="button" onClick={() => menu("new")}>
            Fund a Purchase Pass <Plus size={13} />
          </button>
        </div>
        <nav aria-label="Demo workspace menus">
          {(
            [
              ["purchases", "Purchases", ShoppingCart],
              ["passes", "Purchase Passes", Ticket],
              ["receipts", "Receipts", ReceiptText],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              aria-pressed={activeMenu === key}
              onClick={() => menu(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.account}>
          <UserRound size={26} />
          <div>
            <strong>Sample buyer</strong>
            <span>Demo account</span>
          </div>
        </div>
      </aside>
      <div className={styles.sheet}>
        <div
          className={styles.scroll}
          ref={scroll}
          data-lenis-prevent
          tabIndex={0}
          role="region"
          aria-label="Demo content"
        >
          <div className={styles.topbar}>
            <span className={styles.demoBadge}>Sample data</span>
            <button type="button" onClick={reset}>
              <RotateCcw size={12} /> Reset demo
            </button>
          </div>
          <div className={styles.main}>
            {(view === "order" || view === "receipt") && (
              <button
                className={styles.back}
                type="button"
                onClick={() =>
                  menu(view === "receipt" ? "receipts" : "purchases")
                }
              >
                <ArrowLeft size={12} />{" "}
                {view === "receipt" ? "All receipts" : "All purchases"}
              </button>
            )}
            <div className={styles.heading}>
              <div>
                <h3>{title}</h3>
                <p>
                  {view === "order" || view === "receipt"
                    ? `${order.id} · Research assistant`
                    : view === "new"
                      ? "Create a sample pass to explore the interface."
                      : "Explore the workspace with local example records."}
                </p>
              </div>
              {(view === "order" || view === "receipt") && status(order.phase)}
            </div>
            <p className={styles.notice} role="status">
              {notice}
            </p>

            {view === "new" ? (
              <form className={styles.form} onSubmit={createPass}>
                <label>
                  Pass name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={60}
                  />
                </label>
                <dl className={styles.facts}>
                  <div>
                    <dt>Service</dt>
                    <dd>Private brief extraction</dd>
                  </div>
                  <div>
                    <dt>Service allocation</dt>
                    <dd>{formatNear(SERVICE_PRICE)} testnet NEAR</dd>
                  </div>
                  <div>
                    <dt>Separate storage budget</dt>
                    <dd>{formatNear(STORAGE_BUDGET)} NEAR</dd>
                  </div>
                </dl>
                <p>
                  Sample data only. Creating this pass does not connect a wallet
                  or move funds.
                </p>
                <button className={styles.primary} type="submit">
                  Create demo pass <ArrowRight size={14} />
                </button>
              </form>
            ) : view === "passes" ? (
              <div className={styles.passes}>
                <button
                  className={styles.newPass}
                  type="button"
                  onClick={() => menu("new")}
                >
                  <Plus size={17} /> New demo pass
                </button>
                {passes.map((pass) => (
                  <article className={styles.pass} key={pass.id}>
                    <Ticket size={23} />
                    <h4>{pass.name}</h4>
                    <p>{pass.id}</p>
                    {status(pass.phase)}
                    <dl className={styles.facts}>
                      <div>
                        <dt>Service allocation</dt>
                        <dd>{formatNear(SERVICE_PRICE)} NEAR</dd>
                      </div>
                    </dl>
                    {pass.phase === "InUse" && (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() =>
                          open(
                            orders.find((record) => record.passId === pass.id)!,
                          )
                        }
                      >
                        Review demo order <ArrowRight size={13} />
                      </button>
                    )}
                    {pass.phase === "Completed" && (
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() =>
                          open(
                            orders.find((record) => record.passId === pass.id)!,
                            true,
                          )
                        }
                      >
                        View demo receipt <ReceiptText size={13} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : view === "purchases" || view === "receipts" ? (
              <>
                <div className={styles.ledger}>
                  <div>
                    <span>Purchases</span>
                    <strong>{orders.length}</strong>
                  </div>
                  <div>
                    <span>Needs review</span>
                    <strong>
                      {
                        orders.filter((record) => record.phase === "Delivered")
                          .length
                      }
                    </strong>
                  </div>
                  <div>
                    <span>Paid receipts</span>
                    <strong>
                      {
                        orders.filter((record) => record.phase === "Paid")
                          .length
                      }
                    </strong>
                  </div>
                </div>
                <label className={styles.search}>
                  <Search size={14} />
                  <input
                    aria-label="Search demo orders"
                    placeholder="Search orders"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className={styles.orders}>
                  {filtered.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className={styles.orderRow}
                      title={
                        view === "receipts"
                          ? "Open demo receipt"
                          : "Open demo order"
                      }
                      onClick={() => open(record, view === "receipts")}
                    >
                      <FileText size={18} />
                      <span>
                        <strong>{record.title}</strong>
                        <small>{record.id}</small>
                      </span>
                      {status(record.phase)}
                      <ArrowRight size={13} />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className={styles.empty}>
                      No demo orders match your search.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.detail}>
                <section>
                  <div
                    className={styles.tabs}
                    role="tablist"
                    aria-label="Demo order details"
                  >
                    {tabs.map((value, index) => (
                      <button
                        type="button"
                        role="tab"
                        id={`demo-tab-${value}`}
                        aria-selected={tab === value}
                        aria-controls="demo-order-panel"
                        tabIndex={tab === value ? 0 : -1}
                        key={value}
                        onClick={() => setTab(value)}
                        onKeyDown={(event) => tabKey(event, index)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <div
                    className={styles.panel}
                    id="demo-order-panel"
                    role="tabpanel"
                    aria-labelledby={`demo-tab-${tab}`}
                  >
                    <h4>
                      {tab === "Result"
                        ? "Example result"
                        : tab === "Request"
                          ? "Sample request"
                          : "Example evidence report"}
                    </h4>
                    {tab === "Result" ? (
                      <dl className={styles.result}>
                        <div>
                          <dt>Item</dt>
                          <dd>{order.item}</dd>
                        </div>
                        <div>
                          <dt>Quantity</dt>
                          <dd>{order.quantity}</dd>
                        </div>
                        <div>
                          <dt>Requested by</dt>
                          <dd>{order.requestedBy}</dd>
                        </div>
                      </dl>
                    ) : tab === "Request" ? (
                      <>
                        <blockquote>{order.brief}</blockquote>
                        <p>
                          Synthetic purchase brief for this interactive demo.
                        </p>
                      </>
                    ) : (
                      <>
                        <ul className={styles.checks}>
                          {[
                            "Response integrity",
                            "Model signature",
                            "Private buyer session",
                          ].map((check) => (
                            <li key={check}>
                              <span>{check}</span>
                              <span>
                                <Check size={12} /> Example
                              </span>
                            </li>
                          ))}
                          <li>
                            <span>TLS connection binding</span>
                            <span>Not checked</span>
                          </li>
                        </ul>
                        <p>
                          Illustrative report, not a new verification. Signature
                          checks do not guarantee answer accuracy.
                        </p>
                      </>
                    )}
                  </div>
                  <div className={styles.hint}>
                    <Ticket size={15} />
                    <p>
                      Try the menus and tabs. Every record in this preview is
                      sample data.
                    </p>
                  </div>
                </section>
                <aside className={styles.receipt}>
                  <ReceiptText size={21} />
                  <h4>Sample payment receipt</h4>
                  <p>{order.id}</p>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Seller</dt>
                      <dd>Demo service operator</dd>
                    </div>
                    <div>
                      <dt>Agent</dt>
                      <dd>Research assistant</dd>
                    </div>
                  </dl>
                  <div className={styles.rule} />
                  <div className={styles.amount}>
                    {formatNear(SERVICE_PRICE)}
                    <small>sample testnet NEAR</small>
                  </div>
                  {status(order.phase)}
                  <p>
                    {order.phase === "Paid"
                      ? "This example shows a completed purchase and its receipt."
                      : "Explore the review step, then simulate an approval."}
                  </p>
                  {order.phase === "Delivered" ? (
                    <button
                      className={styles.primary}
                      type="button"
                      onClick={approve}
                    >
                      Approve in demo <ArrowRight size={13} />
                    </button>
                  ) : (
                    view !== "receipt" && (
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={() => open(order, true)}
                      >
                        View demo receipt <ReceiptText size={13} />
                      </button>
                    )
                  )}
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
