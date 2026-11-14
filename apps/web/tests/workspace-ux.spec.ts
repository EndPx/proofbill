import { test, expect, type Page } from "@playwright/test";
import axe from "axe-core";
import { prepareWallet } from "./helpers/wallet";

const owner = "wallet-entry-test.testnet";
const budget = {funded_yocto:"50000000000000000000000",available_yocto:"40000000000000000000000",reserved_yocto:"0",spent_yocto:"10000000000000000000000",refunded_yocto:"0",orders_created:1};
const pass = {token_id:"pass-99",owner_id:owner,seller_id:"seller.testnet",model_id:"Qwen/Qwen3.8-27B",price_yocto:"10000000000000000000000",storage_credit_yocto:"20000000000000000000000",storage_required_for_order_yocto:"0",expires_at_ns:"1999999999000000000",authorization_revision:1,agent_id:"agent.testnet",payment_mode:"Manual",phase:"Available",order_id:null,transfer_pending:false,attempt:0,flexible_budget:true,max_order_price_yocto:null,budget};
const order = {order_id:"pass-99-order-1",token_id:pass.token_id,buyer_id:owner,agent_id:pass.agent_id,seller_id:pass.seller_id,price_yocto:pass.price_yocto,revision:1,phase:"Paid",payment_mode:"Manual",created_at_ns:"1794657600000000000",attempt:1,request_commitment:"a".repeat(64),response_commitment:"b".repeat(64),evidence_commitment:"c".repeat(64)};
async function setup(page:Page, phase="Paid") {
  await prepareWallet(page,true,false,true);
  await page.route("**/api/**", route=>{
    const path=new URL(route.request().url()).pathname;
    return route.fulfill({json:path==="/api/config"?{contractId:"proofbill.testnet",agentId:"agent.testnet",sellerId:pass.seller_id,network:"testnet",configured:true,advancedModes:true,budgetPasses:true,flexibleBudgets:true}
      :path==="/api/session"?{accountId:owner}
      :path==="/api/workspace"?{passes:[pass],orders:[{...order,phase}]}
      :path.startsWith("/api/pass/")?pass
      :path.startsWith("/api/order/")?{order:{...order,phase},payment_mode:"Manual",pass_budget:budget,job:null,observations:[]}
      :path.startsWith("/api/private/")?{result:{output:{item:"notebooks",quantity:12,requested_by:"Maya"},checks:[{name:"Response signature",state:"passed"}],scope:["The operator processes plaintext."]}}:{}});
  });
}

test("a ready pass puts the task first, with settings and metadata available on demand",async({page})=>{
  await setup(page);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===1440?1000:844});
    await page.goto("/app/passes/pass-99");
    const run=page.getByRole("button",{name:"Run agent",exact:true});
    await expect(run).toBeInViewport({ratio:1});
    await expect(page.getByRole("combobox",{name:"Purchasing agent"})).toBeHidden();
    await expect(page.getByText("Current holder",{exact:true})).toBeHidden();
    await expect(page.getByRole("definition").filter({hasText:"0.040"}).first()).toBeVisible();
    await page.getByRole("textbox",{name:"Your private purchase brief"}).fill("Order 12 notebooks for Maya.");
    await expect(run).toBeEnabled();
    await page.locator(".agent-settings > summary").click();
    await expect(page.getByRole("combobox",{name:"Payment approval"})).toHaveValue("Manual");
    await expect(page.getByRole("textbox",{name:"Your private purchase brief"})).toHaveValue("Order 12 notebooks for Maya.");
    await page.addScriptTag({content:axe.source});
    const violations=await page.evaluate(async()=>(await (window as unknown as {axe:typeof axe}).axe.run('.workspace-main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})));
    expect(violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    expect(await page.evaluate(()=>(window as unknown as {proofbillTransactions?:unknown[]}).proofbillTransactions??[])).toEqual([]);
  }
});

test("slow and failed reads do not present a false empty balance; retry restores confirmed state",async({page})=>{
  await setup(page);
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve});
  let fail=true;
  await page.route("**/api/workspace?**",async route=>{await pending;return fail?route.fulfill({status:503,json:{error:"SERVICE_UNAVAILABLE"}}):route.fulfill({json:{passes:[pass],orders:[order]}})});
  await page.goto("/app/purchases");
  await expect(page.getByRole("status",{name:"Loading workspace"})).toBeVisible();
  await expect(page.getByText("Your first purchase starts here",{exact:true})).toHaveCount(0);
  await expect(page.locator(".pass-budget-value")).toHaveText("—");
  release();
  await expect(page.getByRole("heading",{name:"Workspace unavailable"})).toBeVisible();
  fail=false;
  await page.getByRole("button",{name:"Retry loading"}).click();
  await expect(page.locator(".pass-budget-value")).toHaveText("0.040");
  await expect(page.getByRole("link",{name:/Private brief extraction/})).toBeVisible();
});

test("receipts distinguish unpaid purchases from no matching paid receipts",async({page})=>{
  await setup(page,"Delivered");
  await page.goto("/app/receipts");
  await expect(page.getByRole("heading",{name:"No payment receipts yet"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Needs review",exact:true})).toHaveCount(0);
  await setup(page);
  await page.goto("/app/receipts");
  await expect(page.getByRole("link",{name:/Private brief extraction/})).toHaveAttribute("href","/receipts/pass-99-order-1");
  await page.getByRole("textbox",{name:"Search orders"}).fill("missing receipt");
  await expect(page.getByRole("heading",{name:"No matching receipts"})).toBeVisible();
});

test("a delayed pass response cannot replace a newer route's confirmed view",async({page})=>{
  await setup(page);
  let release!:()=>void;
  const pending=new Promise<void>(resolve=>{release=resolve});
  await page.route("**/api/pass/pass-99",async route=>{await pending;await route.fulfill({json:pass})});
  await page.goto("/app/passes/pass-99");
  await expect(page.getByRole("status",{name:"Loading workspace"})).toBeVisible();
  await page.getByRole("navigation",{name:"Workspace"}).getByRole("link",{name:"Purchases",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Purchases",exact:true})).toBeVisible();
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/pass/pass-99");
  release();
  await response;
  await expect(page.getByRole("status",{name:"Loading workspace"})).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Purchases",exact:true})).toBeVisible();
});

test("paid orders expose remaining budget management and actual evidence scope on demand",async({page})=>{
  await setup(page);
  await page.goto("/app/orders/pass-99-order-1");
  await expect(page.getByText("notebooks",{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Manage remaining budget"})).toHaveAttribute("href","/app/passes/pass-99#manage-pass");
  await expect(page.getByText("The operator processes plaintext.",{exact:true})).toBeHidden();
  await page.getByRole("button",{name:"Evidence",exact:true}).click();
  await expect(page.getByText("The operator processes plaintext.",{exact:true})).toBeVisible();
  await expect(page.getByText(/TLS binding and source-image allowlisting are not checked/)).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Approve payment"})).toHaveCount(0);
});
