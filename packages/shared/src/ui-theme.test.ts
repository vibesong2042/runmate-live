import assert from "node:assert/strict";
import { test } from "node:test";
import { getRunMateTheme, RUNMATE_THEME_IDS, RUNMATE_THEMES } from "./ui-theme.js";

test("RunMate themes expose three child-friendly choices", () => {
  assert.deepEqual(RUNMATE_THEME_IDS, ["classic", "sunny-sprint", "adventure-trail"]);
  assert.equal(RUNMATE_THEMES.length, 3);
});

test("unknown theme id falls back to classic", () => {
  assert.equal(getRunMateTheme("missing").id, "classic");
  assert.equal(getRunMateTheme(undefined).id, "classic");
});

test("theme tokens include stable button and metric colors", () => {
  const sunny = getRunMateTheme("sunny-sprint");

  assert.equal(sunny.id, "sunny-sprint");
  assert.match(sunny.colors.primary, /^#[0-9a-f]{6}$/i);
  assert.match(sunny.colors.metricStrongBackground, /^#[0-9a-f]{6}$/i);
  assert.ok(sunny.previewWords.length >= 3);
});
