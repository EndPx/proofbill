import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const lines=(await readFile(new URL('.env.local',root),'utf8')).split(/\r?\n/);
const allow=new Set(['DATABASE_URL','ARTIFACT_ENCRYPTION_KEY','NEAR_CONTRACT_ID','NEAR_AGENT_ID','NEAR_RPC_URL','NEXT_PUBLIC_NEAR_CONTRACT_ID','NEXT_PUBLIC_NEAR_AGENT_ID','APP_ORIGIN']);
const output=lines.filter(line=>allow.has(line.split('=',1)[0]));
if(!output.some(line=>line.startsWith('APP_ORIGIN=')))output.push(`APP_ORIGIN=${process.env.PROOFBILL_WEB_ORIGIN??'http://localhost:3000'}`);
await writeFile(new URL('apps/web/.env.local',root),output.join('\n')+'\n',{mode:0o600});
console.log('Web server environment written; no secret values printed. Worker signing/provider credentials excluded.');
