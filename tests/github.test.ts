import test from "node:test";
import assert from "node:assert/strict";
import { validPath, validateFiles, github } from "../worker/github.ts";
import type { Env } from "../worker/auth.ts";
test("GitHub uploads reject secret paths, traversal, duplicate paths and known tokens", () => {
  for (const path of [
    "../key.py",
    "/root.py",
    ".env",
    ".env.local",
    ".git/config",
    ".github/workflows/run.yml",
    "key.pem",
    "a\\b.py",
  ])
    assert.equal(validPath(path), false, path);
  assert.equal(validPath("exercises/loops.py"), true);
  assert.throws(() =>
    validateFiles([
      { path: "a.py", content: "x" },
      { path: "a.py", content: "y" },
    ]),
  );
  assert.throws(() =>
    validateFiles([{ path: "a.py", content: "ghp_" + "x".repeat(40) }]),
  );
  assert.throws(() =>
    validateFiles([{ path: "a.py", content: "a".repeat(100001) }]),
  );
  assert.equal(
    validateFiles([{ path: "a.py", content: 'print("hello")' }]).length,
    1,
  );
});
test("guide cannot access student GitHub connection or write through it", async () => {
  const r = await github(
    new Request("https://example.com/api/github/connect", { method: "POST" }),
    {} as Env,
    { sub: "guide", email: "guide@example.com", role: "teacher" },
    async () => ({}),
  );
  assert.equal(r.status, 403);
});

test('commit preserves the base tree and rejects stale heads without a force push',async()=>{
 const {EncryptJWT}=await import('jose');
 const user={sub:'student-id',email:'student@example.com',role:'student' as const};
 const secret='s'.repeat(64);const key=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const encrypted=await new EncryptJWT({token:'test-token'}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setSubject(user.sub).encrypt(key);
 const db={prepare:(sql:string)=>({bind:()=>({first:async()=>sql.includes('github_connections')?{login:'student',token:encrypted}:{full_name:'student/project'}})})};
 const env={DB:db,SESSION_SECRET:secret,GITHUB_CLIENT_ID:'client',GITHUB_CLIENT_SECRET:'secret'} as unknown as Env;
 const original=globalThis.fetch;const writes:any[]=[];
 globalThis.fetch=async(input,init)=>{const path=String(input).replace('https://api.github.com','');const data=init?.body?JSON.parse(String(init.body)):null;if(init?.method!=='GET')writes.push({path,data});
 const result=path==='/repos/student/project'?{private:false,owner:{login:'student'},default_branch:'main'}:path.endsWith('/git/ref/heads/main')?{object:{sha:'head1'}}:path.endsWith('/git/commits/head1')?{tree:{sha:'tree1'}}:path.endsWith('/git/trees')?{sha:'tree2'}:path.endsWith('/git/commits')?{sha:'commit2',html_url:'https://github.com/student/project/commit/commit2'}:{};
 return Response.json(result);
 };
 try{const req=new Request('https://app.example/api/github/commit',{method:'POST'});const data={repo:'student/project',head:'old',message:'Add exercise',files:[{path:'exercise.py',content:'print(1)'}]};assert.equal((await github(req,env,user,async()=>data)).status,409);assert.equal(writes.length,0);assert.equal((await github(req,env,user,async()=>({...data,head:'head1'}))).status,200);assert.equal(writes[0].data.base_tree,'tree1');assert.deepEqual(writes[1].data.parents,['head1']);assert.equal(writes[2].data.force,false);
 }finally{globalThis.fetch=original}
});
