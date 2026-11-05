import { readdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const backend=resolve(dirname(fileURLToPath(import.meta.url)),'..'),root=resolve(backend,'..'),frontend=resolve(root,'frontend');
const entries=readdirSync(root).filter(name=>name!=='.git').sort();
if(JSON.stringify(entries)!==JSON.stringify(['backend','frontend']))throw new Error(`Repository root must contain only frontend and backend; found ${entries.join(', ')}`);
if(!process.env.npm_execpath)throw new Error('Run this through npm run verify inside backend');
async function npm(cwd,args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[process.env.npm_execpath,...args],{cwd,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`npm ${args.join(' ')} failed (${code})`)));});}
await npm(backend,['run','db:generate']);await npm(backend,['run','build']);await npm(backend,['test']);await npm(frontend,['run','build']);await npm(backend,['audit','--audit-level=high']);await npm(frontend,['audit','--audit-level=high']);
if(process.argv.includes('--browser'))await npm(frontend,['run','test:e2e']);
console.log('Verified: two-folder structure, standalone builds, backend tests, and dependency audits.');
