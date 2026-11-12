// Compare configured credentials locally; never send them in a URL or print their values.
const origin=new URL(process.argv[2]??'https://proofbill-two.vercel.app').origin;
const names=['DATABASE_URL','ARTIFACT_ENCRYPTION_KEY','NEAR_AI_CLOUD_API_KEY','NEAR_AGENT_KEY','NEAR_PUBLISHER_KEY'];
const values=names.map(n=>process.env[n]).filter(Boolean);
if(!values.length)throw new Error('Load your private operator env to perform the literal-value check');
async function read(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Public asset returned ${r.status}`);return r.text()}
const pages=await Promise.all(['/', '/app/purchases'].map(async path=>({url:origin+path,text:await read(origin+path)})));
const scripts=new Set();
for(const page of pages){for(const match of page.text.matchAll(/<script[^>]+src="([^"]+)"/g)){if(match[1].startsWith('/_next/static/'))scripts.add(new URL(match[1],origin).href)}}
const matches=[];
for(const page of pages)if(values.some(v=>page.text.includes(v)))matches.push(page.url);
await Promise.all([...scripts].map(async url=>{const text=await read(url);if(values.some(v=>text.includes(v)))matches.push(url)}));
const result={origin,htmlPagesChecked:pages.length,publicScriptFilesChecked:scripts.size,configuredCredentialMatches:matches.length,scope:'Literal-value scan, not a security audit'};
console.log(JSON.stringify(result));
if(matches.length)process.exitCode=1;
