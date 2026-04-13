#!/usr/bin/env node
// Usage: node scripts/hash-password.mjs <password>
// Prints a bcrypt hash suitable for WHITELABEL_PORTAL_PASSWORD_HASH.

import { hash } from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const h = await hash(pw, 12);
console.log(h);
