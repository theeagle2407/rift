import {spawnSync} from 'node:child_process';
for(const file of ['test-stress.mjs','test-history.mjs','test-instruments.mjs','test-contract-check.mjs','test-provider.mjs','test-qwen.mjs','test-review-cache.mjs','test-equity.mjs','test-research.mjs','test-brief.mjs']){
 const run=spawnSync(process.execPath,[`scripts/${file}`],{stdio:'inherit'});
 if(run.error||run.status!==0){console.error(`Verification stopped: ${file}`);process.exit(1);}
}
console.log('All ten Rift suites passed. External providers were not called.');
