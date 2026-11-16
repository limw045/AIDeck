import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { Client } from "pg";

const database = process.env.AIDECK_TEST_DATABASE_URL;

test("Admin and provisioning SQL matches the current Signora schema", { skip: !database }, async () => {
  const client = new Client({ connectionString: database, connectionTimeoutMillis: 10000, query_timeout: 10000 });
  await client.connect();
  try {
    await client.query("begin read only");
    for (const file of ["app/admin/page.tsx", "app/admin/existing/[source]/[id]/page.tsx", "app/admin/actions.ts", "lib/provision.ts"]) {
      const source = ts.createSourceFile(file, await readFile(new URL(`../${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
      const queries = [];
      function visit(node) {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
          && /^\s*(select|insert|update)\b/i.test(node.text) && /\bsignora\./.test(node.text)) {
          queries.push(node.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      assert.ok(queries.length, `No Signora queries found in ${file}`);
      for (const sql of queries) {
        const parameters = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])));
        await client.query(`explain ${sql}`, Array(parameters).fill(null));
      }
    }
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
