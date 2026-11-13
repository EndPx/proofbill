import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileKey2,
  Fingerprint,
  KeyRound,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { landing } from "@/data/landing";
import { PurchaseStory } from "@/components/purchase-story";
import { LandingMotion } from "@/components/landing-motion";
import { PassHandover } from "@/components/pass-handover";
import { ParticlePass } from "@/components/landing/particle-pass";
import { WorkspaceDemo } from "@/components/workspace-demo";
import "@fontsource-variable/archivo/wdth.css";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: landing.title },
  description: landing.description,
  alternates: { canonical: landing.url },
  openGraph: {
    title: landing.title,
    description: landing.description,
    url: landing.url,
    type: "website",
    images: [
      { url: `${landing.url}/opengraph-image`, width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: landing.title,
    description: landing.description,
    images: [`${landing.url}/opengraph-image`],
  },
};

export default function Home() {
  return (
    <div className={styles.home} id="proofbill-home">
      <a className={styles.skip} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ProofBill home">
          <Image src="/brand/icon.png" alt="" width={35} height={35} />
          ProofBill
        </Link>
        <nav aria-label="Main navigation">
          <a className={styles.navLink} href="#how-it-works">
            How it works
          </a>
          <a
            className={styles.navLink}
            href={landing.github}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
          <Link className={styles.smallCta} href="/app/purchases">
            Open app <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={styles.network}>
              <span /> Agent purchases, on your terms
            </div>
            <h1 id="hero-title" data-intro>
              {landing.hero.first}
              <br />
              <span>{landing.hero.second}</span>
            </h1>
            <p data-intro>{landing.hero.body}</p>
            <div className={styles.heroActions} data-intro>
              <Link className={styles.cta} href="/app/purchases">
                Open ProofBill <ArrowRight size={18} />
              </Link>
              <a className={styles.textLink} href="#how-it-works">
                See how it works <ArrowDown size={16} />
              </a>
            </div>
            <small>{landing.hero.note}</small>
          </div>
          <ParticlePass />
        </section>

        <section
          className={styles.previewSection}
          aria-label="ProofBill product preview"
        >
          <div className={styles.previewHeading}>
            <h2>Explore the workspace. Try the menus.</h2>
            <span>
              <span className={styles.statusDot} /> Interactive demo · Sample
              data
            </span>
          </div>
          <figure className={styles.preview} data-product-preview>
            <WorkspaceDemo />
            <figcaption>
              <span>Sample data only. No wallet or payment required.</span>
              <Link href="/app/purchases" prefetch={false}>
                Open live app <ArrowUpRight size={15} />
              </Link>
            </figcaption>
          </figure>
          <div className={styles.previewFoot}>
            <span>
              <KeyRound size={16} /> Wallet-approved payments
            </span>
            <span>
              <FileKey2 size={16} /> Buyer-only private results
            </span>
            <span>
              <ReceiptText size={16} /> Onchain payment record
            </span>
          </div>
        </section>

        <section
          className={styles.workflow}
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="workflow-title">
              A little permission.
              <br />A lot more clarity.
            </h2>
            <p>
              One purchase, from the first instruction to the final receipt. You
              decide when the seller gets paid.
            </p>
          </div>
          <PurchaseStory />
        </section>

        <section
          className={styles.privacy}
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div className={styles.privacyIntro}>
            <span className={styles.darkLabel}>
              <Fingerprint size={17} /> Private where it matters
            </span>
            <h2 id="privacy-title">
              The result is yours.
              <br />
              <span>The record adds up.</span>
            </h2>
            <p>
              A public payment should not require publishing your entire brief.
              ProofBill separates private artifacts from the facts recorded
              onchain.
            </p>
          </div>
          <div className={styles.recordSplit}>
            <div>
              <FileKey2 size={27} />
              <h3>For the buyer</h3>
              <p>
                Your brief, result and detailed evidence report require a signed
                wallet session.
              </p>
              <ul>
                <li>
                  <KeyRound size={15} /> Buyer-scoped access
                </li>
                <li>
                  <ShieldCheck size={15} /> Encrypted stored artifacts
                </li>
              </ul>
            </div>
            <div>
              <ReceiptText size={27} />
              <h3>On the record</h3>
              <p>
                The seller, amount, order state and data commitments remain
                inspectable on NEAR.
              </p>
              <ul>
                <li>
                  <Check size={15} /> Confirmed seller transfer
                </li>
                <li>
                  <ArrowUpRight size={15} /> Public transaction references
                </li>
              </ul>
            </div>
          </div>
          <p className={styles.trustNote}>
            A clear trust boundary: the app operator handles plaintext and
            publishes offchain evidence. Signature integrity does not guarantee
            answer accuracy.{" "}
            <a href="#questions">
              Read the verification limits <ArrowUpRight size={13} />
            </a>
          </p>
        </section>

        <section className={styles.ownership} aria-labelledby="ownership-title">
          <PassHandover />
          <div>
            <span className={styles.label}>
              An NFT that carries the permission
            </span>
            <h2 id="ownership-title">
              Pass it on.
              <br />
              The rights go with it.
            </h2>
            <p>
              Hand an unused Purchase Pass to a teammate. The new holder
              receives its use and refund rights, and the previous agent
              assignment is cleared.
            </p>
            <p className={styles.ownershipNote}>
              An active order locks transfer. A completed pass keeps its
              receipt.
            </p>
            <Link
              className={styles.textLink}
              href="/app/passes"
              prefetch={false}
            >
              Meet Purchase Passes <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <section
          className={styles.faq}
          id="questions"
          aria-labelledby="faq-title"
        >
          <div className={styles.sectionHeading}>
            <h2 id="faq-title">
              Good questions.
              <br />
              Clear answers.
            </h2>
            <p>The important details before your first purchase.</p>
          </div>
          <div className={styles.faqList}>
            {landing.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finale} aria-labelledby="finale-title">
          <span>
            <span className={styles.statusDot} /> Ready to try on NEAR testnet
          </span>
          <h2 id="finale-title">
            Give your agent a pass.
            <br />
            Keep the final say.
          </h2>
          <Link className={styles.cta} href="/app/purchases">
            Open ProofBill <ArrowRight size={18} />
          </Link>
          <p>Connect your wallet. Make your first purchase a clear one.</p>
        </section>
      </main>
      <footer className={styles.footer}>
        <div>
          <Link className={styles.brand} href="/">
            <Image src="/brand/icon.png" alt="" width={35} height={35} />
            ProofBill
          </Link>
          <p>Know what your agent bought.</p>
        </div>
        <nav aria-label="Project links">
          <a href={landing.github} target="_blank" rel="noopener noreferrer">
            Source code <ArrowUpRight size={14} />
          </a>
          <a href={landing.contract} target="_blank" rel="noopener noreferrer">
            Testnet contract <ArrowUpRight size={14} />
          </a>
          <a href={landing.payment} target="_blank" rel="noopener noreferrer">
            Recorded payment <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className={styles.footerBottom}>
          <span>Built on NEAR. Made by Albary.</span>
          <span>Testnet MVP. Test funds only.</span>
        </div>
      </footer>
      <LandingMotion />
    </div>
  );
}
