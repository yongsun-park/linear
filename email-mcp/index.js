import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listEmails, readEmail, searchEmails, deleteEmails } from "./lib/imap.js";

const server = new McpServer({
  name: "email-mcp",
  version: "1.0.0",
});

server.tool(
  "list_emails",
  "List recent emails from the inbox",
  {
    folder: z.string().optional().describe("Mailbox folder (default: INBOX)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of emails to return (default: 20)"),
  },
  async ({ folder, limit }) => {
    const emails = await listEmails({ folder, limit });
    const summary = emails.map((e) => ({
      uid: e.uid,
      date: e.date,
      from: e.fromName ? `${e.fromName} <${e.from}>` : e.from,
      subject: e.subject,
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "read_email",
  "Read the full content of a specific email by UID",
  {
    uid: z.string().describe("Email UID to read"),
    folder: z.string().optional().describe("Mailbox folder (default: INBOX)"),
  },
  async ({ uid, folder }) => {
    const email = await readEmail({ uid, folder });
    return { content: [{ type: "text", text: JSON.stringify(email, null, 2) }] };
  }
);

server.tool(
  "search_emails",
  "Search emails by keyword, sender, or date range",
  {
    keyword: z.string().optional().describe("Search keyword in email body"),
    from: z.string().optional().describe("Filter by sender address"),
    unseen: z.boolean().optional().describe("Only unread emails (default: false)"),
    since: z
      .string()
      .optional()
      .describe("Emails after this date (ISO 8601, e.g. 2025-01-01)"),
    before: z
      .string()
      .optional()
      .describe("Emails before this date (ISO 8601)"),
    folder: z.string().optional().describe("Mailbox folder (default: INBOX)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max results (default: 50)"),
  },
  async ({ keyword, from, unseen, since, before, folder, limit }) => {
    const emails = await searchEmails({ keyword, from, unseen, since, before, folder, limit });
    const summary = emails.map((e) => ({
      uid: e.uid,
      date: e.date,
      from: e.fromName ? `${e.fromName} <${e.from}>` : e.from,
      subject: e.subject,
      preview: e.bodyText?.slice(0, 200),
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "delete_emails",
  "Delete emails by UIDs",
  {
    uids: z.array(z.string()).describe("List of email UIDs to delete"),
    folder: z.string().optional().describe("Mailbox folder (default: INBOX)"),
  },
  async ({ uids, folder }) => {
    const count = await deleteEmails({ uids, folder });
    return { content: [{ type: "text", text: `Deleted ${count} email(s).` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
