/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import axios from "axios";
import { Feed } from "feed";
import { htmlToText } from "html-to-text";

const KARAKEEP_API_BASE = process.env.KARAKEEP_API_BASE;

// 🔧 Normalize curly quotes, dashes, and weird characters
function normalizeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'") // single quotes
    .replace(/[\u201C\u201D]/g, '"') // double quotes
    .replace(/[\u2013\u2014]/g, "-") // en/em dashes
    .replace(/\u00a0/g, " ") // non-breaking spaces
    .normalize("NFKC");
}

export async function GET() {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.KARAKEEP_API_KEY}`,
    };

    // Step 1: Get all lists
    const listsRes = await axios.get(`${KARAKEEP_API_BASE}/api/v1/lists`, {
      headers,
    });
    const list = listsRes.data.lists.find(
      (list: any) => list.name === "Great Articles"
    );

    if (!list) {
      return NextResponse.json(
        { error: 'List "Great Articles" not found' },
        { status: 404 }
      );
    }

    const listId = list.id;

    // Step 2: (optional) Get list metadata
    await axios.get(`${KARAKEEP_API_BASE}/api/v1/lists/${listId}`, { headers });

    // Step 3: Get bookmarks with full content
    const bookmarksRes = await axios.get(
      `${KARAKEEP_API_BASE}/api/v1/lists/${listId}/bookmarks`,
      {
        headers,
        params: {
          includeContent: true,
        },
      }
    );

    const bookmarks = Array.isArray(bookmarksRes.data.bookmarks)
      ? bookmarksRes.data.bookmarks
      : [];

    const feed = new Feed({
      title: "Great Articles from Karakeep",
      description: "An RSS feed for your 'Great Articles' list on Karakeep",
      id: "https://karakeep-rss.app",
      link: "https://karakeep-rss.app",
      language: "en",
      copyright: `${new Date().getFullYear()} You`,
    });

    bookmarks.forEach((bm: any) => {
      const content = bm.content || {};

      const rawTitle = content.title || content.url || "Untitled";
      const rawDescription = content.description || "No description available.";
      const rawHtml = content.htmlContent || "";

      const title = normalizeText(rawTitle);
      const description = normalizeText(rawDescription);

      let textOnly = htmlToText(rawHtml, {
        wordwrap: 130,
        selectors: [{ selector: "img", format: "skip" }],
      });

      textOnly = normalizeText(textOnly);

      const link = content.url || "#";
      const favicon = content.favicon
        ? `<img src="${content.favicon}" alt="favicon" width="16" height="16" style="margin-right:4px;vertical-align:middle;" /> `
        : "";

      feed.addItem({
        title,
        id: bm.id,
        link,
        date: new Date(bm.createdAt || Date.now()),
        description,
        content: `
          ${favicon}<strong>${title}</strong><br/>
          <em>${description}</em><br/><br/>
          ${textOnly}
        `,
      });
    });

    return new NextResponse(feed.rss2(), {
      headers: {
        "Content-Type": "application/rss+xml",
      },
    });
  } catch (err: any) {
    console.error("🔥 Error generating feed:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
