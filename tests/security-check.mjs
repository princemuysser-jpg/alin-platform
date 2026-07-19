import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];

const cors = read("supabase/functions/_shared/cors.ts");
if (/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/.test(cors)) {
  failures.push("Edge Functions must not allow every CORS origin");
}
if (!cors.includes("ALLOWED_ORIGINS")) failures.push("CORS allowlist environment variable is missing");
if (!cors.includes("Vary': 'Origin")) failures.push("CORS responses must vary by Origin");

for (const name of ["create", "update", "delete", "reset-password"]) {
  const folder = name === "create" ? "admin-create-account"
    : name === "update" ? "admin-update-account"
    : name === "delete" ? "admin-delete-account"
    : "admin-reset-password";
  const source = read(`supabase/functions/${folder}/index.ts`);
  if (!source.includes("requireAdmin(req)")) failures.push(`${folder}: missing server-side admin authorization`);
  if (!source.includes("isAllowedOrigin(req)")) failures.push(`${folder}: missing origin validation`);
}

const resetPassword = read("supabase/functions/admin-reset-password/index.ts");
if (!resetPassword.includes("emailForUsername(username)")) failures.push("Legacy password reset does not create an Auth identity");
if (!resetPassword.includes("auth_user_id: created.user.id")) failures.push("Legacy password reset does not link the Auth identity");

const sql = read("RUN_ON_SUPABASE_v2_0_3_IDEMPOTENT.sql");
for (const required of [
  "security definer",
  "revoke insert on public.orders from anon, authenticated",
  "grant execute on function public.alin_create_store_orders",
  "from public.delivery_areas",
  "jsonb_array_length(p_items)>50",
]) {
  if (!sql.toLowerCase().includes(required.toLowerCase())) failures.push(`SQL hardening missing: ${required}`);
}

const cloud = read("modules/core/cloud-status-ui.js");
if (!cloud.includes("window.confirmCheckout=secureCheckout")) failures.push("Direct checkout does not use secure RPC");
if (!cloud.includes("window.confirmCartCheckout=secureCheckout")) failures.push("Cart checkout does not use secure RPC");

const platform = read("modules/core/platform.js");
if (/status==='processing'.{0,300}stock:Math\.max/.test(platform)) {
  failures.push("Order status transition still deducts stock a second time");
}

console.log(JSON.stringify({ checks: 18, failures }, null, 2));
process.exit(failures.length ? 1 : 0);
