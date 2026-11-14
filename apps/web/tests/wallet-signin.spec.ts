import { test, expect, type Page, type Route } from "@playwright/test";
import { prepareWallet } from "./helpers/wallet";
import axe from "axe-core";

const owner = "wallet-entry-test.testnet";
const retry = (page: Page) => page.getByRole("button", { name: "Sign in for private access", exact: true });

async function sessionServer(page: Page, initialAccount: string | null = null, refuse = false) {
  let current = initialAccount;
  const verified: unknown[] = [];
  await page.route("**/api/session", route => route.fulfill({json: {accountId: current}}));
  await page.route("**/api/auth/verify", route => {
    verified.push(route.request().postDataJSON());
    if (refuse) return route.fulfill({status:403,json:{error:"INVALID_SIGNATURE"}});
    current = owner;
    return route.fulfill({json:{accountId: owner}});
  });
  return verified;
}

async function connect(page: Page) {
  await page.getByRole("button", {name:"Connect wallet",exact:true}).click();
  await page.getByText("ProofBill test wallet", {exact:true}).click();
  await expect(page.getByRole("button",{name:"Connect wallet",exact:true})).toHaveCount(0);
  await expect(page.locator('.wallet-entry-account, .account-card strong').first()).toBeVisible();
}

async function messages(page: Page) {
  return page.evaluate(() => (window as unknown as {proofbillMessages?: unknown[]}).proofbillMessages ?? []);
}

test("new connection requests one private sign-in message without a transaction and keeps the route", async ({page}) => {
  await prepareWallet(page,false,false,false,"approve");
  const verified = await sessionServer(page);
  await page.goto("/app/passes/new");
  await expect(page.getByText(/Sign-in costs no gas and grants no spending permission/)).toBeVisible();
  await connect(page);
  await expect.poll(() => verified.length).toBe(1);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(retry(page)).toHaveCount(0);
  expect(await messages(page)).toHaveLength(1);
  expect(verified[0]).toMatchObject({id:"browser-fixture",accountId:owner,signature:"BrowserFixtureNotACryptographicSignature"});
  expect(await page.evaluate(() => (window as unknown as {proofbillTransactions?: unknown[]}).proofbillTransactions ?? [])).toEqual([]);
  await expect(page).toHaveURL(/\/app\/passes\/new$/);
  // A matching session survives restoration without asking for another message.
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(retry(page)).toHaveCount(0);
  expect(await messages(page)).toEqual([]);
  expect(verified).toHaveLength(1);
});

test("a matching existing session skips the post-connect signature", async ({page}) => {
  await prepareWallet(page,false,false,false,"approve");
  const verified = await sessionServer(page,owner);
  await page.goto("/app/purchases");
  await connect(page);
  await expect(retry(page)).toHaveCount(0);
  expect(await messages(page)).toEqual([]);
  expect(verified).toEqual([]);
});

test("a cancelled message leaves the wallet connected and can be retried once", async ({page}) => {
  await prepareWallet(page,false,false,false,"reject-once");
  const verified = await sessionServer(page);
  await page.goto("/app/passes/new");
  await connect(page);
  await expect(page.getByText(/Your private sign-in was not completed/)).toBeVisible();
  await expect(retry(page)).toBeEnabled();
  expect(await messages(page)).toHaveLength(1);
  expect(verified).toEqual([]);
  // No automatic retry loop after cancellation.
  await expect(page.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname==='/api/session'),
    page.evaluate(()=>window.dispatchEvent(new Event('focus'))),
  ]);
  expect(await messages(page)).toHaveLength(1);
  await retry(page).click();
  await expect.poll(() => verified.length).toBe(1);
  await expect(retry(page)).toHaveCount(0);
  await expect(page.getByText(/private sign-in was not completed/)).toHaveCount(0);
  expect(await messages(page)).toHaveLength(2);
});

test("server rejection cannot mark a connected wallet authenticated", async ({page}) => {
  await prepareWallet(page,false,false,false,"approve");
  const verified = await sessionServer(page,null,true);
  await page.goto("/app/purchases");
  await connect(page);
  await expect.poll(() => verified.length).toBe(1);
  await expect(retry(page)).toBeEnabled();
  await expect(page.getByText(/private sign-in was not completed/)).toBeVisible();
});

test("a different message signer is rejected before submitting verification", async ({page}) => {
  await prepareWallet(page,false,false,false,"wrong-account");
  const verified = await sessionServer(page,"other.testnet");
  await page.goto("/app/purchases");
  await connect(page);
  await expect(page.getByText(/private sign-in was not completed/)).toBeVisible();
  expect(await messages(page)).toHaveLength(1);
  expect(verified).toEqual([]);
});

test("disconnect while a signature is pending invalidates its completion", async ({page}) => {
  await page.setViewportSize({width:375,height:844});
  await prepareWallet(page,false,false,false,"pending");
  const verified = await sessionServer(page);
  await page.goto("/app/purchases");
  await connect(page);
  await expect(page.getByText(/Sign the wallet message/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Signing in…",exact:true})).toBeDisabled();
  await expect.poll(() => messages(page).then(m => m.length)).toBe(1);
  await page.screenshot({path:test.info().outputPath("private-signin-pending-mobile.png")});
  await page.getByRole("button",{name:"Disconnect wallet",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Connect to continue"})).toBeVisible();
  await page.evaluate(() => (window as unknown as {proofbillResolveMessage:()=>void}).proofbillResolveMessage());
  // Flush the resumed signature handler; it must not reach auth/verify.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve,100)));
  expect(verified).toEqual([]);
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("a stale session lookup cannot undo successful explicit sign-in", async ({page}) => {
  await prepareWallet(page,true,false,false,"approve");
  const verified = await sessionServer(page);
  let held: Route | undefined;
  await page.goto("/app/purchases");
  await expect(retry(page)).toBeEnabled();
  await page.route("**/api/session", route => { held=route; });
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect.poll(() => !!held).toBe(true);
  expect(await messages(page)).toEqual([]);
  await retry(page).click();
  await expect.poll(() => verified.length).toBe(1);
  await expect(retry(page)).toHaveCount(0);
  await held!.fulfill({json:{accountId:null}});
  await page.getByRole("button",{name:"Refresh confirmed state"}).click();
  await expect(retry(page)).toHaveCount(0);
});

test("the sign-in retry and cancellation explanation fit mobile, tablet and desktop", async ({page}) => {
  await prepareWallet(page,false,false,false,"reject");
  await sessionServer(page);
  await page.goto("/app/purchases");
  await connect(page);
  await expect(page.getByText(/private sign-in was not completed/)).toBeVisible();
  for (const width of [375,768,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(retry(page)).toBeVisible();
    const layout=await page.evaluate(()=>({page:document.documentElement.scrollWidth}));
    expect(layout.page).toBe(width);
    await page.screenshot({path:test.info().outputPath(`private-signin-retry-${width}.png`)});
  }
  await page.addScriptTag({content:axe.source});
  const violations=await page.evaluate(async()=>{
    const result=await (window as unknown as {axe:typeof axe}).axe.run('.wallet-entry-card',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.map(v=>v.id);
  });
  expect(violations).toEqual([]);
});

test('a restored wallet without a private session gates every workspace route without fetching its contents',async({page})=>{
  await prepareWallet(page,true);
  await sessionServer(page);
  const workspaceRequests:string[]=[];
  page.on('request',r=>{if(/\/api\/(workspace|pass\/|order\/|private\/)/.test(r.url()))workspaceRequests.push(r.url())});
  for(const route of ['/app/purchases','/app/passes','/app/passes/new','/app/orders/pass-2-order','/app/receipts']){
    await page.goto(route);
    await expect(page.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();
    await expect(retry(page)).toBeEnabled();
    await expect(page.locator('.wallet-entry-account')).toHaveText(owner);
    await expect(page.locator('.app-shell')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Connect wallet',exact:true})).toHaveCount(0);
  }
  expect(workspaceRequests).toEqual([]);
  expect(await messages(page)).toEqual([]);
});

test('session expiry on focus returns to sign-in and can recover without reconnecting',async({page})=>{
  await prepareWallet(page,true,false,false,'approve');
  let current:string|null=owner;
  let verifications=0;
  await page.route('**/api/session',r=>r.fulfill({json:{accountId:current}}));
  await page.route('**/api/auth/verify',r=>{current=owner;verifications++;return r.fulfill({json:{accountId:owner}})});
  await page.goto('/app/passes/new');
  await expect(page.locator('.app-shell')).toBeVisible();
  current=null;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await expect(page.locator('.wallet-entry-account')).toHaveText(owner);
  expect(await messages(page)).toEqual([]);
  await retry(page).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/passes\/new$/);
  expect(verifications).toBe(1);
  expect(await messages(page)).toHaveLength(1);
});

test('a slow session restore shows a checking state rather than an empty workspace',async({page})=>{
  await prepareWallet(page,true);
  let held:Route|undefined;
  await page.route('**/api/session',r=>{held=r});
  await page.goto('/app/purchases');
  await expect(page.getByRole('button',{name:'Checking private session…',exact:true})).toBeDisabled();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await expect.poll(()=>!!held).toBe(true);
  await held!.fulfill({json:{accountId:owner}});
  await expect(page.locator('.app-shell')).toBeVisible();
  expect(await messages(page)).toEqual([]);
});
