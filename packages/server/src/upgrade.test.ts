import assert from "node:assert/strict";
import {test} from "node:test";
import type {PurchaseOrder} from "@proofbill/shared";
import {checkOrderUpgrade} from "../../../workers/agent/src/upgrade-checks.ts";
test("upgrade validation uses the recorded order policy rather than a later NFT policy",()=>{
  const before={order_id:"pass-12-order-1",payment_mode:"Automatic",price_yocto:"10000000000000000000000"} as PurchaseOrder;
  checkOrderUpgrade(before,{...before,max_order_price_yocto:null},"Manual");
  assert.throws(()=>checkOrderUpgrade(before,{...before,payment_mode:"Manual"}));
  assert.throws(()=>checkOrderUpgrade(before,{...before,price_yocto:"20000000000000000000000"}));
});
test("legacy single-use validation needs an explicit known policy and cannot invent a new ceiling",()=>{
  const before={order_id:"pass-1-order",price_yocto:"10000000000000000000000"} as PurchaseOrder;
  checkOrderUpgrade(before,{...before,payment_mode:"Manual",max_order_price_yocto:null},"Manual");
  assert.throws(()=>checkOrderUpgrade(before,{...before,payment_mode:"Manual"}));
  assert.throws(()=>checkOrderUpgrade(before,{...before,payment_mode:"Manual",max_order_price_yocto:"100000000000000000000000"},"Manual"));
});
