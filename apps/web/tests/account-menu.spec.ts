import { test, expect } from "@playwright/test";
import axe from "axe-core";
import { prepareWallet } from "./helpers/wallet";

const owner='wallet-entry-test.testnet';
test('account options copy and dismiss without disconnecting; only Sign out closes the workspace', async({page})=>{
  await prepareWallet(page,true);
  await page.route('**/api/wallet-balance?**', route=>route.fulfill({json:{accountId:owner,network:'testnet',totalYocto:'1234567890123456789012345'}}));
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(value:string)=>{
      (window as unknown as {copiedAddress:string}).copiedAddress=value;
    }}});
  });
  let logout=0;
  page.on('request',request=>{if(new URL(request.url()).pathname==='/api/auth/logout')logout++});
  await page.goto('/app/purchases');
  const trigger=page.getByRole('button',{name:`Account ${owner}; open options`});
  const panel=page.locator('.wallet-account-popover');
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(panel).toContainText(owner);
  await expect(panel).toContainText('1.234567890123456789012345 NEAR');
  await expect(panel.getByRole('link',{name:'View on explorer'})).toHaveAttribute('href',`https://testnet.nearblocks.io/address/${owner}`);
  await panel.getByRole('button',{name:'Copy address',exact:true}).click();
  await expect(panel.getByRole('status').filter({hasText:'Address copied'})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {copiedAddress:string}).copiedAddress)).toBe(owner);
  expect(logout).toBe(0);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('heading',{name:'Purchases',exact:true}).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.app-shell')).toBeVisible();
  expect(logout).toBe(0);
  await trigger.click();
  await panel.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connect to continue'})).toBeVisible();
  expect(logout).toBe(1);
});

test('account popover exposes wallet balance on mobile and remains readable across viewports',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await prepareWallet(page,true);
  await page.route('**/api/session',r=>r.fulfill({json:{accountId:owner}}));
  await page.route('**/api/wallet-balance?**', route=>route.fulfill({json:{accountId:owner,network:'testnet',totalYocto:'2750000000000000000000000'}}));
  await page.goto('/app/purchases');
  for(const [width,height] of [[375,844],[768,900],[1440,1000],[1440,700]]){
    await page.setViewportSize({width,height});
    const trigger=page.getByRole('button',{name:`Account ${owner}; open options`});
    await expect(trigger).toBeInViewport();
    await trigger.click();
    const panel=page.locator('.wallet-account-popover');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Private session active');
    await expect(panel).toContainText('2.750');
    const bounds=await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({path:test.info().outputPath(`account-menu-${width}-${height}.png`)});
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:`Account ${owner}; open options`}).click();
  await page.addScriptTag({content:axe.source});
  const violations=await page.evaluate(async()=>{
    const result=await(window as unknown as {axe:typeof axe}).axe.run('.wallet-account-popover',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))}));
  });
  expect(violations).toEqual([]);
});
