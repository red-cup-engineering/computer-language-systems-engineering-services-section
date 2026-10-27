#!/usr/bin/env node
// l-space: tell renderings into ARB catalogs, report on them, and exchange them as XLIFF 2.0.
//
//   l-space tell   --source en.arb --target zh-Hans.arb --drafts drafts.json --by NAME [--kind human|machine] [--role translator|reviewer] [--at ISO]
//   l-space report --source en.arb [--policy policy.json] TARGET.arb...
//   l-space xliff  --source en.arb --target zh-Hans.arb [--policy policy.json] [--out FILE]
//   l-space import --source en.arb --target zh-Hans.arb --xliff FILE --by NAME [--kind human|machine]
//
// `drafts.json` maps message keys to target messages. A target catalog that does not exist yet is created.
// Every rendering is bound to the current source token, so a later source edit makes it stale.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { lSpace, parseArb, readSpace, report, serializeArb, tell } from "../src/catalog.mjs";
import { fromXliff, roleOfState, toXliff } from "../src/xliff.mjs";

const [command, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    source: { type: "string" }, target: { type: "string" }, drafts: { type: "string" }, xliff: { type: "string" },
    by: { type: "string" }, kind: { type: "string", default: "human" }, role: { type: "string", default: "translator" },
    at: { type: "string" }, policy: { type: "string" }, out: { type: "string" }, locale: { type: "string" },
  },
});

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const need = (name) => {
  if (!values[name]) throw new Error(`l-space ${command}: --${name} is required`);
  return values[name];
};
const targetCatalog = (path, locale) => (existsSync(path) ? parseArb(readFileSync(path, "utf8")) : parseArb({ "@@locale": locale ?? localeOfPath(path) }));
const localeOfPath = (path) => path.split("/").at(-1).replace(/\.arb$/u, "");
const policy = values.policy ? readJson(values.policy) : undefined;

switch (command) {
  case "tell": {
    const space = lSpace({ source: readFileSync(need("source"), "utf8") });
    let catalog = targetCatalog(need("target"), values.locale);
    const at = values.at ?? new Date().toISOString();
    for (const [key, message] of Object.entries(readJson(need("drafts")))) {
      catalog = tell(space, catalog, key, message, { role: values.role, kind: values.kind, by: need("by"), at });
    }
    writeFileSync(values.target, serializeArb(catalog));
    break;
  }
  case "report": {
    const space = lSpace({ source: readFileSync(need("source"), "utf8"), targets: positionals.map((path) => readFileSync(path, "utf8")) });
    process.stdout.write(`${JSON.stringify(report(space, { policy }), null, 2)}\n`);
    break;
  }
  case "xliff": {
    const target = targetCatalog(need("target"), values.locale);
    const space = lSpace({ source: readFileSync(need("source"), "utf8"), targets: [target] });
    const descriptions = new Map(space.units.map((unit) => [unit.key, unit.description]).filter(([, text]) => text));
    const xml = toXliff(readSpace(space, { required: [target.locale], policy }), { targetLocale: target.locale, descriptions });
    if (values.out) writeFileSync(values.out, xml);
    else process.stdout.write(xml);
    break;
  }
  case "import": {
    const space = lSpace({ source: readFileSync(need("source"), "utf8") });
    let catalog = targetCatalog(need("target"), values.locale);
    const at = values.at ?? new Date().toISOString();
    for (const unit of fromXliff(readFileSync(need("xliff"), "utf8")).units) {
      const role = roleOfState(unit.state);
      if (!role || unit.target === undefined) continue;
      catalog = tell(space, catalog, unit.key, unit.target, { role, kind: values.kind, by: need("by"), at });
    }
    writeFileSync(values.target, serializeArb(catalog));
    break;
  }
  default:
    process.stderr.write("usage: l-space tell|report|xliff|import (see the header of scripts/l-space.mjs)\n");
    process.exit(2);
}
