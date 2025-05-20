/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import axios from "axios";
import { Feed } from "feed";

const KARAKEEP_API_BASE = process.env.KARAKEEP_API_BASE;
const LIST_NAMES = (process.env.KARAKEEP_LISTS || "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

const FEED_TITLE = process.env.FEED_TITLE?.trim() || "Bookmarks from Karakeep";
const FEED_DESCRIPTION =
  process.env.FEED_DESCRIPTION?.trim() ||
  "An RSS feed of your selected Karakeep bookmarks.";
const FEED_AUTHOR = process.env.FEED_AUTHOR?.trim();
const FEED_COPYRIGHT =
  process.env.FEED_COPYRIGHT?.trim() || "Copyright © 2025 hallveticapro";
const BOOKMARK_LIMIT = Math.min(
  parseInt(process.env.BOOKMARK_LIMIT || "100", 10),
  100
);

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "600", 10); // in seconds

let rssCache: { data: string; timestamp: number } | null = null;

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

async function fetchAllBookmarks(
  listId: string,
  headers: any
): Promise<Bookmark[]> {
  const bookmarks: Bookmark[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const params: Record<string, any> = {
      includeContent: true,
      limit: 100,
    };
    if (cursor) {
      params.cursor = cursor;
    }

    const res = await axios.get(
      `${KARAKEEP_API_BASE}/api/v1/lists/${listId}/bookmarks`,
      {
        headers,
        params,
      }
    );

    const pageBookmarks: Bookmark[] = Array.isArray(res.data.bookmarks)
      ? res.data.bookmarks
      : [];
    bookmarks.push(...pageBookmarks);

    cursor = res.data.cursor;
    if (!cursor || pageBookmarks.length === 0) break;
  }

  const seen = new Set<string>();
  return bookmarks.filter((bm) => {
    if (seen.has(bm.id)) return false;
    seen.add(bm.id);
    return true;
  });
}

export async function GET() {
  const now = Date.now();

  if (rssCache && now - rssCache.timestamp < CACHE_TTL * 1000) {
    console.log("✅ Serving cached RSS feed");
    return new NextResponse(rssCache.data, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  }

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
      const bookmarks = await fetchAllBookmarks(list.id, headers);
      allBookmarks.push(...bookmarks);
    }

    allBookmarks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const feed = new Feed({
      title: FEED_TITLE,
      description: FEED_DESCRIPTION,
      id: KARAKEEP_API_BASE || "https://karakeep.app",
      link: KARAKEEP_API_BASE || "https://karakeep.app",
      language: "en",
      copyright: FEED_COPYRIGHT,
      ...(FEED_AUTHOR ? { author: { name: FEED_AUTHOR } } : {}),
    });

    allBookmarks.slice(0, BOOKMARK_LIMIT).forEach((bm) => {
      const content = bm.content || {};
      const title = normalizeText(content.title || content.url || "Untitled");
      const htmlContent = content.htmlContent || "";

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

    const rssOutput = feed.rss2();
    rssCache = {
      data: rssOutput,
      timestamp: now,
    };

    console.log("♻️ Refreshed RSS cache");

    return new NextResponse(rssOutput, {
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
