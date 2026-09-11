from pathlib import Path

client=Path('src/supabase-account-client.ts')
source=client.read_text()
old_type="export type AccountSupabaseClient=any;\n\nlet accountClientPromise:Promise<AccountSupabaseClient>|null=null;"
new_type="export type AccountSupabaseClient=any;\n\nconst accountAuthStorage={\n getItem:(key:string)=>{try{return window.localStorage.getItem(key)}catch{return null}},\n setItem:(key:string,value:string)=>{try{window.localStorage.setItem(key,value)}catch{}},\n removeItem:(key:string)=>{try{window.localStorage.removeItem(key)}catch{}}\n};\n\nlet accountClientPromise:Promise<AccountSupabaseClient>|null=null;"
if new_type not in source:
    if old_type not in source: raise SystemExit('account storage type anchor missing')
    source=source.replace(old_type,new_type,1)
old_auth="auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth'}"
new_auth="auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'rhythtap-account-auth',storage:accountAuthStorage}"
if new_auth not in source:
    if old_auth not in source: raise SystemExit('account auth config anchor missing')
    source=source.replace(old_auth,new_auth,1)
client.write_text(source)

vite=Path('vite.config.ts')
source=vite.read_text()
source=source.replace("import { accountSessionTransform } from './scripts/account-session-transform.ts';\n",'')
source=source.replace('stabilityTransform(), accountSessionTransform(), battleExperienceTransform()','stabilityTransform(), battleExperienceTransform()')
if 'accountSessionTransform' in source or 'account-session-transform' in source: raise SystemExit('account session transform remains in vite')
vite.write_text(source)

test=Path('tests/stability-regressions.test.mjs')
source=test.read_text()
source=source.replace("const accountSession=await readFile('scripts/account-session-transform.ts','utf8');","const accountSession=await readFile('src/supabase-account-client.ts','utf8');")
if "scripts/account-session-transform.ts" in source: raise SystemExit('stability test still references account-session transform')
test.write_text(source)

Path('scripts/account-session-transform.ts').unlink()
Path('scripts/consolidate-account-session.py').unlink()
Path('.github/workflows/consolidate-account-session.yml').unlink()
