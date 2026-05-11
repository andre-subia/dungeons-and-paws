#!/usr/bin/env tsx
import { ENGINE_VERSION } from "@gridlore/engine";

const [, , cmd] = process.argv;

switch (cmd) {
  case "version":
  case undefined:
    console.log(`gridlore-tools (engine ${ENGINE_VERSION})`);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
