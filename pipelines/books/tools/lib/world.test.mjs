import { test } from "node:test";
import assert from "node:assert/strict";

import { readWorld } from "./world.mjs";

// A connection that answers each query by the table it reads, and keeps what it was asked.
function stub(tables) {
  const asked = [];
  return {
    asked,
    async query(sql, params) {
      asked.push({ sql, params });
      const table = Object.keys(tables).find((name) => sql.includes(`FROM ${name}`) || sql.includes(`FROM \`${name}\``));
      return [tables[table] ?? []];
    },
  };
}

test("readWorld asks for goobers by the page in data7 as well as text objects by data0", async () => {
  const connection = stub({
    page_text: [{ entry: 358, text: "Long had the children of the stars...", next_page: 364 }],
    gameobject_template: [{ id: 17188, name: "The Lay of Ameth'Aran", firstPage: 358 }],
    item_template: [],
  });
  const world = await readWorld(connection);

  const objects = connection.asked.find(({ sql }) => sql.includes("FROM gameobject_template"));
  assert.match(objects.sql, /t1\.type = \? AND t1\.data7 > 0/);
  assert.match(objects.sql, /IF\(t1\.type = \?, t1\.data0, t1\.data7\)/);
  assert.deepEqual(objects.params, [9, 9, 10, 10]);
  assert.deepEqual(world.owners, [
    { kind: "object", id: 17188, name: "The Lay of Ameth'Aran", firstPage: 358, material: 0 },
  ]);
});
