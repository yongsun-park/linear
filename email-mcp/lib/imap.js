import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getAccessToken } from "./auth.js";

async function createClient() {
  const accessToken = await getAccessToken();
  return new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      accessToken,
    },
    logger: false,
  });
}

function parseEmail(msg, parsed) {
  return {
    uid: String(msg.uid),
    messageId: parsed.messageId || msg.envelope?.messageId || "",
    subject: parsed.subject || "(no subject)",
    from: parsed.from?.value?.[0]?.address || "",
    fromName: parsed.from?.value?.[0]?.name || "",
    to: (parsed.to?.value || []).map((a) => a.address).join(", "),
    date: (parsed.date || new Date()).toISOString(),
    bodyText: parsed.text || "",
    bodyHtml: parsed.html || "",
  };
}

export async function listEmails({ folder = "INBOX", limit = 20 } = {}) {
  const client = await createClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const status = await client.status(folder, { messages: true });
      const total = status.messages || 0;
      if (total === 0) return [];

      const from = Math.max(1, total - limit + 1);
      const range = `${from}:*`;

      const emails = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        const parsed = await simpleParser(msg.source);
        emails.push(parseEmail(msg, parsed));
      }

      emails.sort((a, b) => new Date(b.date) - new Date(a.date));
      return emails.slice(0, limit);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function readEmail({ uid, folder = "INBOX" }) {
  const client = await createClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const msgs = [];
      for await (const msg of client.fetch(uid, {
        uid: true,
        envelope: true,
        source: true,
      }, { uid: true })) {
        msgs.push(msg);
      }

      if (msgs.length === 0) {
        throw new Error(`Email UID ${uid} not found in ${folder}`);
      }

      const parsed = await simpleParser(msgs[0].source);
      return parseEmail(msgs[0], parsed);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function searchEmails({
  folder = "INBOX",
  keyword,
  from,
  since,
  before,
  unseen,
  limit = 50,
} = {}) {
  const client = await createClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const query = {};
      if (unseen) query.seen = false;
      if (keyword) query.body = keyword;
      if (from) query.from = from;
      if (since) query.since = new Date(since);
      if (before) query.before = new Date(before);

      const uids = await client.search(query, { uid: true });
      if (!uids || uids.length === 0) return [];

      const selected = uids.slice(-limit);
      const emails = [];

      const rangeStr = selected.join(",");
      for await (const msg of client.fetch(rangeStr, {
        uid: true,
        envelope: true,
        source: true,
      }, { uid: true })) {
        const parsed = await simpleParser(msg.source);
        emails.push(parseEmail(msg, parsed));
      }

      emails.sort((a, b) => new Date(b.date) - new Date(a.date));
      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function markAsRead({ uids, folder = "INBOX" }) {
  const client = await createClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const rangeStr = uids.join(",");
      await client.messageFlagsAdd(rangeStr, ["\\Seen"], { uid: true });
      return uids.length;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function deleteEmails({ uids, folder = "INBOX" }) {
  const client = await createClient();
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);

    try {
      const rangeStr = uids.join(",");
      await client.messageDelete(rangeStr, { uid: true });
      return uids.length;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
