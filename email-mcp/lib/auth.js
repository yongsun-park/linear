import { ConfidentialClientApplication } from "@azure/msal-node";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CACHE_DIR = join(homedir(), ".email-mcp");
const CACHE_PATH = join(CACHE_DIR, "token-cache.json");

const SCOPES = ["https://outlook.office365.com/IMAP.AccessAsUser.All", "offline_access"];
const REDIRECT_URI = "http://localhost:53847/callback";

function createMsalApp() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
  });
}

async function loadCache(app) {
  try {
    const data = await readFile(CACHE_PATH, "utf-8");
    app.getTokenCache().deserialize(data);
  } catch {
    // no cache yet
  }
}

async function saveCache(app) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_PATH, app.getTokenCache().serialize());
}

export async function getAccessToken() {
  const app = createMsalApp();
  await loadCache(app);

  const accounts = await app.getTokenCache().getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("No cached account. Run 'npm run setup' first to authenticate.");
  }

  const result = await app.acquireTokenSilent({
    account: accounts[0],
    scopes: SCOPES,
  });

  await saveCache(app);
  return result.accessToken;
}

export async function acquireTokenInteractive(code) {
  const app = createMsalApp();

  const result = await app.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  await saveCache(app);
  return result.accessToken;
}

export function getAuthUrl() {
  const app = createMsalApp();
  return app.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });
}
