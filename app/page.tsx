export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Karakeep RSS Feed</h1>
      <a
        href="/api/rss"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        View RSS Feed
      </a>
    </main>
  );
}
