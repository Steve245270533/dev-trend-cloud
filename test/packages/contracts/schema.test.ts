import assert from "node:assert/strict";
import test from "node:test";
import {
  SourceFeaturesSchema,
  TimestampOriginSchema,
  UnifiedContentRecordSchema,
} from "../../../packages/contracts/src/index.js";

test("source features contract requires layered shared fields", () => {
  assert.ok(Array.isArray(SourceFeaturesSchema.required));
  assert.ok(SourceFeaturesSchema.required.includes("shared"));
  assert.equal(SourceFeaturesSchema.type, "object");
});

test("unified content contract keeps core fields and legacy refs", () => {
  const required = UnifiedContentRecordSchema.required ?? [];
  assert.ok(required.includes("canonicalId"));
  assert.ok(required.includes("source"));
  assert.ok(required.includes("sourceItemId"));
  assert.ok(required.includes("sourceFeatures"));
  assert.ok(required.includes("legacyRefs"));
});

test("timestamp origin contract remains source|collected", () => {
  const variants = Array.isArray(TimestampOriginSchema.anyOf)
    ? TimestampOriginSchema.anyOf
        .map((entry) => ("const" in entry ? entry.const : undefined))
        .filter(
          (value): value is "source" | "collected" =>
            value === "source" || value === "collected",
        )
    : [];
  assert.deepEqual(variants.sort(), ["collected", "source"]);
});
