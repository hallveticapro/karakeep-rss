# 📚 Karakeep RSS Generator

Karakeep RSS is a lightweight Node/Next.js-based application that generates an RSS feed from your archived Karakeep bookmarks. Designed for simplicity and readability, this tool helps you consume your saved content in any RSS reader — turning a bookmarking tool into a personalized reading stream.

---

## 🚀 Features

- 📰 Converts your Karakeep bookmark archives into a valid RSS 2.0 feed.
- 🔍 Filters and displays archived bookmarks in a clean, structured feed.
- 🛡️ Secure access via Karakeep API token.
- 🧠 Smart in-memory caching to reduce API calls.
- 📦 Deployable via Docker with minimal setup.

---

## ⚙️ Environment Variables

The app uses the following environment variables to authenticate with Karakeep and customize feed behavior.

| Variable               | Required | Description                                                                 |
|------------------------|----------|-----------------------------------------------------------------------------|
| `KARAKEEP_API_BASE`    | ✅ Yes   | The base URL of your Karakeep API (e.g., `https://karakeep.app`).           |
| `KARAKEEP_API_KEY`     | ✅ Yes   | Your personal API token to authenticate requests.                          |
| `KARAKEEP_LISTS`       | ✅ Yes   | Comma-separated list of list names to include in the feed. Case-insensitive. |
| `FEED_TITLE`           | ❌ No    | Custom title for the RSS feed (default: `Bookmarks from Karakeep`).        |
| `FEED_DESCRIPTION`     | ❌ No    | Optional feed description.                                                 |
| `FEED_AUTHOR`          | ❌ No    | Author name for RSS feed metadata.                                         |
| `FEED_COPYRIGHT`       | ❌ No    | Feed copyright (default: `Copyright © 2025 hallveticapro`).                |
| `BOOKMARK_LIMIT`       | ❌ No    | Max number of bookmarks in the feed. Default: `100`, Max: `100`.           |
| `CACHE_TTL_SECONDS`    | ❌ No    | Cache lifespan in seconds (default: 600). Helps avoid excessive API calls.  |

---

## 🐳 Docker Usage

You can easily deploy this application using Docker. Here's how:

### 1. Create a `.env` file

You can use `.env.example` as a starting point:

```bash
cp .env.example .env
```

Fill in your credentials and desired configuration.

### 2. Build the Docker image

```bash
docker build -t karakeep-rss .
```

### 3. Run the container

```bash
docker run -d --name karakeep-rss \
  -p 3000:3000 \
  --env-file .env \
  karakeep-rss
```

The RSS feed will be available at:
http://localhost:3000/api/rss

---

## 🔧 Local Development

To run locally without Docker:

1. Clone the repo:

```bash
git clone https://github.com/hallveticapro/karakeep-rss.git
cd karakeep-rss
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the required variables.

4. Start the development server:

```bash
npm run dev
```

Then visit http://localhost:3000/api/rss in your browser or RSS reader.

---

## 🧠 Caching

To improve performance and reduce unnecessary load on the Karakeep API, the app caches the RSS feed in memory for a configurable number of seconds. The default is 600 seconds (10 minutes).

You can override this using:

```env
CACHE_TTL_SECONDS=300
```

This caching resets automatically once the time limit expires. If you’re testing frequent updates, lower the value accordingly.

---

## 🧪 Testing

To test your RSS feed's structure, paste your `/api/rss` URL into an RSS validator such as:

- https://validator.w3.org/feed/
- https://www.rssboard.org/rss-validator/

---

## ❓ FAQ

**Q: What happens if I don’t set BOOKMARK_LIMIT?**
A: The feed will include up to 100 bookmarks, which is also the maximum limit supported.

**Q: How do I force-refresh the feed during development?**
A: Set a low CACHE_TTL_SECONDS (like 10) or restart the server to clear the in-memory cache.

---

## 📄 License

MIT © 2025 hallveticapro

---

## 🙌 Credits

Built by Andrew Hall. Inspired by the need to bring structure and readability to saved content.
Special thanks to Karakeep for the elegant API.
