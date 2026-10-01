import { readFileSync, writeFileSync } from "node:fs";
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const id = process.env.CLOUDFLARE_DATABASE_ID;
if (!id || !/^[-a-f0-9]{36}$/i.test(id) || /^0{8}-/.test(id))
  throw Error("Set CLOUDFLARE_DATABASE_ID before deploying.");
config.d1_databases[0].database_id = id;
writeFileSync("wrangler.deploy.json", JSON.stringify(config, null, 2) + "\n");
