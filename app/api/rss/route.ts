/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import axios from "axios";
import { Feed } from "feed";

const KARAKEEP_API_BASE = process.env.KARAKEEP_API_BASE;
const LIST_NAMES = (process.env.KARAKEEP_LISTS || "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

function normalizeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
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
    .replace(/<\/div><\/div>$/, "");
}

function removeDuplicateImages(html: string): string {
  const seen = new Set<string>();
  return html.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (imgTag, src) => {
    if (seen.has(src)) return "";
    seen.add(src);
    return imgTag;
  });
}

function extractFirstImage(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  return match ? match[0] : null;
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
    const allLists: { id: string; name: string }[] = listsRes.data.lists;

    const matchedLists = allLists.filter((list) =>
      LIST_NAMES.includes(list.name.trim().toLowerCase())
    );

    if (matchedLists.length === 0) {
      return NextResponse.json(
        { error: "No matching Karakeep lists found" },
        { status: 404 }
      );
    }

    const allBookmarks: Bookmark[] = [];

    for (const list of matchedLists) {
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

      allBookmarks.push(...bookmarks);
    }

    // Sort bookmarks by date descending
    allBookmarks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const feed = new Feed({
      title: "Bookmarks from Karakeep",
      description: "An RSS feed of your selected Karakeep bookmarks.",
      id: "https://karakeep-rss.app",
      link: "https://karakeep-rss.app",
      language: "en",
      copyright: "2025 hallveticapro",
    });

    allBookmarks.forEach((bm) => {
      const content = bm.content || {};
      const title = normalizeText(content.title || content.url || "Untitled");
      const htmlContent = content.htmlContent || "";

      // Clean and prep content
      const coreHTML = stripReadabilityWrapper(htmlContent);
      const cleanedHTML = cleanEntities(removeDuplicateImages(coreHTML));

      const previewImage =
        extractFirstImage(coreHTML) ||
        (content.imageUrl
          ? `<img src="${content.imageUrl}" alt="preview image" style="max-width:100%; margin: 1em 0;" />`
          : "");

      feed.addItem({
        title,
        id: bm.id,
        link: content.url || "#",
        date: new Date(bm.createdAt || Date.now()),
        description: previewImage,
        content: `
          <div style="font-family: sans-serif; line-height: 1.6; font-size: 15px;">
            <strong>${title}</strong>
            ${cleanedHTML}
          </div>
        `,
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
