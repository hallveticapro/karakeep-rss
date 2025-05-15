/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import axios from "axios";
import { Feed } from "feed";

const KARAKEEP_API_BASE = process.env.KARAKEEP_API_BASE;

// 🔧 Normalize curly quotes, dashes, and smart characters
function normalizeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'") // single quotes
    .replace(/[\u201C\u201D]/g, '"') // double quotes
    .replace(/[\u2013\u2014]/g, "-") // dashes
    .replace(/\u00a0/g, " ") // non-breaking space
    .normalize("NFKC");
}

// 🧽 Clean broken UTF-8 artifacts that leak from badly decoded HTML
function cleanUTF8(html: string): string {
  return html
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/â€˜/g, "'")
    .replace(/â€/g, "")
    .normalize("NFKC");
}

// 🔖 Bookmark type for typing safety
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
    imageAssetId?: string;
    screenshotAssetId?: string;
  };
};

export async function GET() {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.KARAKEEP_API_KEY}`,
    };

    // Step 1: Get lists
    const listsRes = await axios.get(`${KARAKEEP_API_BASE}/api/v1/lists`, {
      headers,
    });
    const list = listsRes.data.lists.find(
      (list: { name: string }) => list.name === "Great Articles"
    );

    if (!list) {
      return NextResponse.json(
        { error: 'List "Great Articles" not found' },
        { status: 404 }
      );
    }

    const listId = list.id;

    // Step 2: Get bookmarks
    const bookmarksRes = await axios.get(
      `${KARAKEEP_API_BASE}/api/v1/lists/${listId}/bookmarks`,
      {
        headers,
        params: {
          includeContent: true,
        },
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
      const rawDescription = content.description || "No description available.";
      const htmlContent = content.htmlContent || "";
      const link = content.url || "#";
      const favicon = content.favicon
        ? `<img src="${content.favicon}" alt="favicon" width="16" height="16" style="margin-right:4px;vertical-align:middle;" /> `
        : "";

      const title = normalizeText(rawTitle);
      const description = normalizeText(rawDescription);

      const imageBlock = content.imageUrl
        ? `<img src="${content.imageUrl}" alt="preview image" style="max-width:100%; margin: 1em 0;" />`
        : "";

      const formattedHTML = cleanUTF8(`
        <div style="font-family: sans-serif; line-height: 1.6; font-size: 15px;">
          ${
            favicon
              ? `<div style="margin-bottom: 8px;">${favicon}<strong>${title}</strong></div>`
              : ""
          }
          <p><em>${description}</em></p>
          ${imageBlock}
          ${htmlContent}
        </div>
      `);

      // ✨ Duplicate full HTML to both fields for better client compatibility
      feed.addItem({
        title,
        id: bm.id,
        link,
        date: new Date(bm.createdAt || Date.now()),
        description: formattedHTML,
        content: formattedHTML,
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
