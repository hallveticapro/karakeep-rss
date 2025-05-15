/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import axios from "axios";
import { Feed } from "feed";

const KARAKEEP_API_BASE = process.env.KARAKEEP_API_BASE;

function normalizeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'") // single quotes
    .replace(/[\u201C\u201D]/g, '"') // double quotes
    .replace(/[\u2013\u2014]/g, "-") // dashes
    .replace(/\u00a0/g, " ") // non-breaking space
    .normalize("NFKC");
}

function cleanEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&amp;/g, "&");
}

function stripReadabilityWrapper(html: string): string {
  return html
    .replace(/<div[^>]*id="readability-page-1"[^>]*>/gi, "")
    .replace(/<\/div><\/div>$/, ""); // close extra wrappers
}

type Bookmark = {
  id: string;
  createdAt: string;
  content?: {
    url?: string;
    title?: string;
    description?: string;
    favicon?: string;
    htmlContent?: string;
    imageUrl?: string;
  };
};

export async function GET() {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.KARAKEEP_API_KEY}`,
    };

    const listsRes = await axios.get(`${KARAKEEP_API_BASE}/api/v1/lists`, {
      headers,
    });
    const list = listsRes.data.lists.find(
      (l: { name: string }) => l.name === "Great Articles"
    );
    if (!list) {
      return NextResponse.json(
        { error: 'List "Great Articles" not found' },
        { status: 404 }
      );
    }

    const bookmarksRes = await axios.get(
      `${KARAKEEP_API_BASE}/api/v1/lists/${list.id}/bookmarks`,
      {
        headers,
        params: { includeContent: true },
      }
    );

    const bookmarks: Bookmark[] = Array.isArray(bookmarksRes.data.bookmarks)
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

    bookmarks.forEach((bm) => {
      const content = bm.content || {};
      const rawTitle = content.title || content.url || "Untitled";
      const htmlContent = content.htmlContent || "";
      const link = content.url || "#";

      const title = normalizeText(rawTitle);
      const favicon = content.favicon
        ? `<img src="${content.favicon}" alt="favicon" width="16" height="16" style="margin-right:4px;vertical-align:middle;" /> `
        : "";
      const imageBlock = content.imageUrl
        ? `<img src="${content.imageUrl}" alt="preview image" style="max-width:100%; margin: 1em 0;" />`
        : "";

      const fullHTML = `
        <div style="font-family: sans-serif; line-height: 1.6; font-size: 15px;">
          ${
            favicon
              ? `<div style="margin-bottom: 8px;">${favicon}<strong>${title}</strong></div>`
              : ""
          }
          ${imageBlock}
          ${htmlContent}
        </div>
      `;

      const cleanedHTML = cleanEntities(stripReadabilityWrapper(fullHTML));

      feed.addItem({
        title,
        id: bm.id,
        link,
        date: new Date(bm.createdAt || Date.now()),
        content: cleanedHTML, // Use only content:encoded
      });
    });

    return new NextResponse(feed.rss2(), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
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
