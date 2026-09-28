const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const endpoint='https://hackathon.bitgetops.com/v1/responses';
const model='qwen3.8-max';
async function main(){
 const root=process.cwd(),target=path.join(root,'.env.local');
 if(!fs.existsSync(path.join(root,'package.json')))throw Error('Run this from the Rift project folder.');
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Environment file is a symlink; setup stopped.');
 if(spawnSync('git',['ls-files','--error-unmatch','.env.local'],{cwd:root,stdio:'ignore'}).status===0)throw Error('.env.local is tracked. Untrack it before saving a token.');
 const prompt=spawnSync('python3',['-c','import getpass; print(getpass.getpass("Bitget Qwen token (hidden): "))'],{stdio:['inherit','pipe','inherit'],encoding:'utf8'});
 if(prompt.status!==0)throw Error('Token entry cancelled or Python 3 unavailable. Nothing changed.');
 let key=prompt.stdout.trim();
 if(!/^[A-Za-z0-9_.-]{10,500}$/.test(key))throw Error('Unexpected token characters. Paste only the token, without Bearer or quotation marks. Nothing changed.');
 console.log(`Testing ${model} through the organizer gateway (one request)…`);
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,input:'Reply with only the word READY.',max_output_tokens:1024})});
 console.log('HTTP:',response.status);
 if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?'Token access rejected. Ask the organizer to confirm activation. Nothing changed.':response.status===429?'Rate limit or allowance reached. Nothing changed.':`Gateway failure (${response.status}). Nothing changed.`);}
 const d=await response.json();
 const answer=typeof d.output_text==='string'?d.output_text:(d.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]).filter(p=>p.type==='output_text').map(p=>p.text||'').join('');
 if(d.status!=='completed'||answer.trim()!=='READY')throw Error('Gateway responded but the probe was incomplete or unexpected. Nothing changed.');
 const old=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
 const clean=old.split(/\r?\n/).filter(l=>!/^(?:\s*export\s+)?(?:RIFT_AI_PROVIDER|QWEN_API_KEY|QWEN_MODEL|QWEN_CHAT_COMPLETIONS_URL|QWEN_RESPONSES_URL)\s*=/.test(l)).join('\n').trimEnd();
 const ignore=path.join(root,'.gitignore');let ignored=fs.existsSync(ignore)?fs.readFileSync(ignore,'utf8'):'';
 if(!ignored.split(/\r?\n/).includes('.env.local'))fs.writeFileSync(ignore,ignored+'\n.env.local\n');
 fs.writeFileSync(target,clean+`\nRIFT_AI_PROVIDER=qwen\nQWEN_API_KEY=${key}\nQWEN_MODEL=${model}\n`,{mode:0o600});fs.chmodSync(target,0o600);key='';
 console.log('Qwen probe passed. Rift is configured for Qwen. Restart your development server, then click Interpret thesis.');
 console.log('This probe checks access; the full interpretation still needs an end-to-end test.');
}
main().catch(e=>{console.error('Setup:',e.name==='TimeoutError'?'Connection timed out. Nothing changed.':e.message);if(e.cause?.code)console.error('Network code:',e.cause.code);process.exitCode=1;});
