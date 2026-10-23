import { test } from "node:test";
import assert from "node:assert/strict";

import { repackSettings } from "./env.mjs";

test("the repack's settings default to the local repack", () => {
  assert.deepEqual(repackSettings({}), {
    host: "127.0.0.1",
    port: 3317,
    user: "root",
    password: "",
    database: "world",
  });
});

test("the repack's settings are read from PLACES_MYSQL_*, never from the vmangos MYSQL_* names", () => {
  const settings = repackSettings({
    PLACES_MYSQL_HOST: "repack.local",
    PLACES_MYSQL_PORT: "3320",
    PLACES_MYSQL_USER: "reader",
    PLACES_MYSQL_PASSWORD: "x",
    PLACES_MYSQL_DATABASE: "forever",
    MYSQL_HOST: "vmangos.local",
    MYSQL_PORT: "3306",
  });
  assert.deepEqual(settings, { host: "repack.local", port: 3320, user: "reader", password: "x", database: "forever" });
});
