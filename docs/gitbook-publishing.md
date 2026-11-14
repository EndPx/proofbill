# Publishing the ProofBill GitBook

The English source is `docs/gitbook`. `SUMMARY.md` supplies seven native page groups and nested Overview children. The root `.gitbook.yaml` points Git Sync at that directory. Existing engineering/evidence docs remain outside the public GitBook navigation.

## Hosted status checked 15 November 2026, Asia/Jakarta

The new ProofBill space and Basic site were created in the existing SAMA organization. Git Sync to `EndPx/proofbill`, branch `main`, completed successfully in the Git-to-GitBook direction. API inspection confirmed 31 document pages, seven native groups, nested guides, and Home's hidden title/sidebar/pagination settings. The generated cover also rendered in the authenticated editor.

Native customization was saved with the Clean theme, rounded corners, charcoal tint, Inter, green `#08623C` in light mode and mint `#51E79C` in dark mode, and a light/dark toggle. Logo/favicon URLs were configured. The site remains Basic; no paid plan was purchased. Configuration read-back is not a substitute for verifying all theme features in a public render.

Publication is **not complete**. The API and authenticated editor both returned `Request blocked for security reasons`, and the owner reported the same result when clicking Publish manually. The provider did not give a more specific reason. Do not present the intended slug or an editor/preview link as a live public documentation URL, and do not bypass the provider restriction. Recheck publication after GitBook resolves the restriction.

An isolated attempt to render the temporary preview did not reach the expected Home heading, so desktop/mobile published-site visual acceptance remains unverified. The source, imported structure, editor Home, and assets are available; they do not establish a public release.

## Source and hosting

Connect the existing `EndPx/proofbill` repository, branch `main`, to the new ProofBill space. For a fresh connection, the initial direction is **Git → GitBook**. The authored repository is the source; importing GitBook's blank/template content into Git could overwrite it. The official MCP supports space/site creation and content editing, but its guide states that Git Sync wiring is configured in the GitBook app.

After import, verify native group objects, nested pages, relative links, Mermaid, files, and Home layout. A normal linked category article is not an equivalent substitute for a native group.

The prepared source uses a single-space Home fallback: Home appears once in SUMMARY, its left table of contents and automatic title/pagination are hidden, and its Documentation row opens Introduction / Overview. Actual Home/Documentation site-section tabs require the site's section feature. Do not enable a paid plan to obtain them. If the account supports sections, separate the Home root and Documentation root and preserve published IDs/slugs while moving them.

## Native ProofBill branding

| Setting | Target |
| --- | --- |
| Site title | ProofBill |
| Theme | Clean; no gradient background |
| Primary brand | Mint `#51E79C`; accessible dark-green link variant on white |
| Neutral tint | Charcoal `#252525` / white reading surface |
| Corners | Rounded |
| Light/dark | Light default; reader toggle where supported |
| Body / heading | Inter / Archivo where the native font choices and plan permit |
| Code | Native monospace; charcoal code surfaces |
| Logo / favicon | `assets/logo-light.png`, `assets/logo-dark.png`, `assets/icon.png` |
| Home illustration | `assets/cover-chatgpt-v1.webp` |

These are target settings, not evidence that the hosted theme was applied. Fetch the current customization, change supported fields, then read it back. Keep the Basic site type. Do not upgrade billing, enable trials, or claim arbitrary app-shell CSS is supported by native GitBook themes.

Home should show the centered welcome heading, one conceptual illustration, and one Quick Start row. Documentation should show the article hierarchy, useful tables, and readable diagrams. Verify desktop and a narrow viewport after publication; source/frontmatter validation alone does not prove the hosted layout.

## Asset provenance

The cover was generated with the built-in ChatGPT Image tool for ProofBill. Its exact prompt is recorded in `docs/gitbook/assets/provenance.json`. It illustrates permission and receipts; it is not a screenshot or financial evidence. The receipt image is an existing actual testnet public-receipt capture. The workspace image uses a labelled synthetic local fixture.

The journey/component diagrams have editable Excalidraw scenes. Their SVG/PNG views are rendered from the same authored scene data. Mermaid remains the text-based technical diagram source in the articles. No AI illustration is presented as proof of a verification check.

## Checks and import archive

```sh
node tools/check-gitbook.mjs
```

An import archive should contain only the GitBook content root and its referenced assets. Store archives and validation captures under ignored `.local/gitbook-build`, outside the source tree. A ZIP or editor preview is not a published site URL.
