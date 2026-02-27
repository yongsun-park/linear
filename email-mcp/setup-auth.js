import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });
import http from "http";
import { getAuthUrl, acquireTokenInteractive } from "./lib/auth.js";

const PORT = 53847;

async function main() {
  const authUrl = await getAuthUrl();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>인증 실패</h1><p>${url.searchParams.get("error_description")}</p>`);
        console.error("Auth error:", error);
        server.close();
        process.exit(1);
      }

      try {
        await acquireTokenInteractive(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>인증 완료!</h1><p>이 창을 닫아도 됩니다.</p>");
        console.log("Authentication successful! Token cached.");
        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>토큰 교환 실패</h1><p>${err.message}</p>`);
        console.error("Token exchange error:", err);
        server.close();
        process.exit(1);
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`\nOpen this URL in your browser:\n\n${authUrl}\n`);
    console.log(`Waiting for callback on http://localhost:${PORT}/callback ...\n`);

    import("open").then((mod) => mod.default(authUrl)).catch(() => {
      // open failed, user will click manually
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
