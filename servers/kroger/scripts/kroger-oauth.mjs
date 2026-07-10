#!/usr/bin/env node
/* global Buffer, console, fetch, process */

/**
 * Create or renew a Kroger user OAuth token without adding credentials to the
 * MCP server's source code. Uses only Node's built-in APIs.
 *
 * Usage:
 *   KROGER_CLIENT_ID=... KROGER_CLIENT_SECRET=... KROGER_REDIRECT_URI=... \\
 *     node scripts/kroger-oauth.mjs authorize
 *   KROGER_CLIENT_ID=... KROGER_CLIENT_SECRET=... KROGER_REFRESH_TOKEN=... \\
 *     node scripts/kroger-oauth.mjs refresh
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL, URLSearchParams } from "node:url";

const AUTHORIZATION_URL = "https://api.kroger.com/v1/connect/oauth2/authorize";
const TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const DEFAULT_SCOPES = "product.compact cart.basic:write";

function loadEnvFile() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const envFile = process.env.KROGER_ENV_FILE || path.resolve(scriptDirectory, "../.env");
  if (!fs.existsSync(envFile)) return;

  for (const rawLine of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    const value = rawValue.trim().replace(/^(["'])(.*)\1$/, "$2");
    process.env[name] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function credentials() {
  return {
    clientId: requireEnv("KROGER_CLIENT_ID"),
    clientSecret: requireEnv("KROGER_CLIENT_SECRET")
  };
}

async function requestToken(params) {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams(params)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Kroger token request failed (${response.status}): ${body.error_description ?? body.error ?? "unknown error"}`);
  }
  return body;
}

function printToken(token) {
  const expiresAt = token.expires_in
    ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
    : undefined;
  console.log("\nToken obtained. Store these as MCP environment variables:\n");
  console.log(`KROGER_ACCESS_TOKEN=${token.access_token}`);
  if (token.refresh_token) console.log(`KROGER_REFRESH_TOKEN=${token.refresh_token}`);
  if (expiresAt) console.log(`KROGER_ACCESS_TOKEN_EXPIRES_AT=${expiresAt}`);
  console.log("\nDo not commit these values or put them in shell history.");
}

async function getAuthorizationCode(redirectUri, expectedState) {
  const redirect = new URL(redirectUri);
  if (!/^https?:$/.test(redirect.protocol) || !["localhost", "127.0.0.1", "::1"].includes(redirect.hostname)) {
    throw new Error("Automatic callback requires KROGER_REDIRECT_URI to use localhost, 127.0.0.1, or ::1. Register a local callback URL such as http://127.0.0.1:3000/callback.");
  }
  const port = Number(redirect.port || (redirect.protocol === "https:" ? 443 : 80));
  if (redirect.protocol !== "http:") throw new Error("Use an http localhost redirect URI; this helper does not run a local HTTPS server.");

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const callback = new URL(request.url ?? "/", redirect);
      if (callback.pathname !== redirect.pathname) {
        response.writeHead(404).end("Not found");
        return;
      }
      if (callback.searchParams.get("state") !== expectedState) {
        response.writeHead(400).end("Invalid OAuth state. You may close this window.");
        server.close();
        reject(new Error("OAuth state did not match"));
        return;
      }
      const error = callback.searchParams.get("error");
      const code = callback.searchParams.get("code");
      response.writeHead(error || !code ? 400 : 200, { "Content-Type": "text/plain" });
      response.end(error || !code ? `Authorization failed: ${error ?? "no code returned"}. You may close this window.` : "Authorization complete. You may close this window and return to the terminal.");
      server.close();
      if (error || !code) {
        reject(new Error(`Authorization failed: ${error ?? "no code returned"}`));
      } else {
        resolve(code);
      }
    });
    server.once("error", reject);
    server.listen(port, redirect.hostname, () => console.log(`\nWaiting for Kroger's redirect at ${redirectUri} ...`));
  });
}

async function authorize() {
  const { clientId } = credentials();
  const redirectUri = requireEnv("KROGER_REDIRECT_URI");
  const state = crypto.randomBytes(24).toString("base64url");
  const authorizationUrl = new URL(AUTHORIZATION_URL);
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: process.env.KROGER_OAUTH_SCOPES?.trim() || DEFAULT_SCOPES,
    state
  }).toString();
  console.log("Open this URL in a browser and sign in to Kroger:\n");
  console.log(authorizationUrl.toString());
  const code = await getAuthorizationCode(redirectUri, state);
  printToken(await requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
}

async function refresh() {
  printToken(await requestToken({ grant_type: "refresh_token", refresh_token: requireEnv("KROGER_REFRESH_TOKEN") }));
}

loadEnvFile();

const command = process.argv[2];
if (!["authorize", "refresh"].includes(command)) {
  console.error("Usage: node scripts/kroger-oauth.mjs <authorize|refresh>");
  process.exitCode = 2;
} else {
  try {
    await (command === "authorize" ? authorize() : refresh());
  } catch (error) {
    console.error(`OAuth helper error: ${error.message}`);
    process.exitCode = 1;
  }
}
