import { test, expect } from "@playwright/test";
import { prepareWallet } from "./helpers/wallet";

const owner = "wallet-entry-test.testnet";

test("wallet balance reads finalized public native amounts without losing atomic precision", async ({request}) => {
  const response = await request.get(`/api/wallet-balance?account=${owner}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({accountId:owner,network:"testnet",totalYocto:"3234567890123456789012345",blockHeight:100,blockHash:"1".repeat(32)});
  const invalid = await request.get('/api/wallet-balance?account=bad/account');
  expect(invalid.status()).toBe(400);
  const unavailable = await request.get('/api/wallet-balance?account=unavailable.testnet');
  expect(unavailable.status()).toBe(503);
  expect(await unavailable.json()).toEqual({error:"WALLET_BALANCE_UNAVAILABLE"});
});

test("native wallet total stays distinct from the pass budget", async ({page}) => {
  await prepareWallet(page,true);
  await page.route('**/api/wallet-balance?**', route=>route.fulfill({json:{accountId:owner,network:'testnet',totalYocto:'3234567890123456789012345'}}));
  await page.goto('/app/purchases');
  const balance=page.getByRole('region',{name:'Connected wallet balance'});
  await expect(balance).toContainText('≈ 3.2345');
  await expect(balance.locator('strong')).toHaveAttribute('title',/3\.234567890123456789012345 NEAR total/);
  await expect(page.locator('.pass-budget-value')).toHaveText('0.000');
  await expect(page.getByText('Available pass budget')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {proofbillTransactions?:unknown[]}).proofbillTransactions??[])).toEqual([]);
});

test("a failed or mismatched balance never displays a fabricated zero and can retry", async ({page}) => {
  await prepareWallet(page,true);
  let state='failed';
  await page.route('**/api/wallet-balance?**', route=>route.fulfill(state==='failed'?{status:503,json:{error:'WALLET_BALANCE_UNAVAILABLE'}}:{json:{accountId:state==='wrong'?'other.testnet':owner,network:'testnet',totalYocto:'1'}}));
  await page.goto('/app/purchases');
  const balance=page.getByRole('region',{name:'Connected wallet balance'});
  await expect(balance).toContainText('Balance unavailable');
  await expect(balance.locator('strong')).toHaveText('— NEAR');
  state='wrong';
  await balance.getByRole('button',{name:'Refresh wallet balance'}).click();
  await expect(balance).toContainText('Balance unavailable');
  state='ready';
  await balance.getByRole('button',{name:'Refresh wallet balance'}).click();
  await expect(balance).toContainText('<0.0001');
  await expect(balance.locator('strong')).toHaveAttribute('title',/0\.000000000000000000000001 NEAR total/);
});
