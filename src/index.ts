import { analyzeString } from "./utils";

export interface Env {
  STRING_STORE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method.toUpperCase();

	console.log("Incoming path:", path);

    try {
      // ===== POST /strings =====
      if (method === "POST" && path === "/strings") {
        // request.json() can fail or return unknown; narrow it to a record or null
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body.value !== "string")
          return json({ error: "Invalid or missing 'value' field" }, 400);

        const value = (body.value as string).trim();
        if (!value) return json({ error: "Empty string not allowed" }, 400);

        // analyzeString may have a specific return shape; cast to any to avoid TS errors here
        const analysis = (await analyzeString(value)) as any;
        const id = analysis.sha256_hash as string;

        // Check if already exists
        const existing = (await env.STRING_STORE.get(id)) as string | null;
        if (existing) return json({ error: "String already exists" }, 409);

        const record = {
          id,
          value,
          properties: analysis,
          created_at: new Date().toISOString(),
        };

        await env.STRING_STORE.put(id, JSON.stringify(record));
        return json(record, 201);
      }

	    // ===== GET /strings/filter-by-natural-language =====
      if (method === "GET" && path.startsWith("/strings/filter-by-natural-language")) {
        const q = url.searchParams.get("query") || "";
        if (!q) return json({ error: "Missing 'query' parameter" }, 400);

        const parsed = parseNaturalLanguageQuery(q);
        if (!parsed) return json({ error: "Unable to parse natural language query" }, 400);

        // detect conflicting filters (simple conflict example: min_length > max_length)
        if (parsed.min_length !== undefined && parsed.max_length !== undefined && parsed.min_length > parsed.max_length) {
          return json({ error: "Conflicting filters" }, 422);
        }

        const list = (await env.STRING_STORE.list()) as any;
        const results: any[] = [];
        for (const key of list.keys) {
          const recordStr = (await env.STRING_STORE.get(key.name)) as string | null;
          if (!recordStr) continue;
          results.push(JSON.parse(recordStr));
        }

        // Convert parsed into URLSearchParams to reuse applyFilters
        const params = new URLSearchParams();
        Object.entries(parsed).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          params.set(k, String(v));
        });

        const filters = applyFilters(results, params);
        return json({
          data: filters.data,
          count: filters.data.length,
          interpreted_query: {
            original: q,
            parsed_filters: parsed,
          },
        });
      }

      // ===== GET /strings/{value} =====
      if (method === "GET" && path.startsWith("/strings/") && path.split("/").length === 3) {
        const parts = path.split("/");
        const seg = parts[2];
        if (typeof seg !== "string") return json({ error: "Invalid path" }, 400);
        const value = decodeURIComponent(seg);
        const hash = await computeHash(value);
        const data = (await env.STRING_STORE.get(hash)) as string | null;
        if (!data) return json({ error: "String not found" }, 404);
        return json(JSON.parse(data));
      }

      // ===== DELETE /strings/{value} =====
      if (method === "DELETE" && path.startsWith("/strings/") && path.split("/").length === 3) {
        const parts = path.split("/");
        const seg = parts[2];
        if (typeof seg !== "string") return json({ error: "Invalid path" }, 400);
        const value = decodeURIComponent(seg);
        const hash = await computeHash(value);
        const data = (await env.STRING_STORE.get(hash)) as string | null;
        if (!data) return json({ error: "String not found" }, 404);
        await env.STRING_STORE.delete(hash);
        return new Response(null, { status: 204 });
      }

      // ===== GET /strings (with optional filters) =====
      if (method === "GET" && path === "/strings") {
        // KVNamespace.list() can have complex typing depending on lib; cast to any to iterate safely
        const list = (await env.STRING_STORE.list()) as any;
        const results: any[] = [];

        for (const key of list.keys) {
          const recordStr = (await env.STRING_STORE.get(key.name)) as string | null;
          if (!recordStr) continue;
          const record = JSON.parse(recordStr);
          results.push(record);
        }

        const filters = applyFilters(results, url.searchParams);
        return json({
          data: filters.data,
          count: filters.data.length,
          filters_applied: filters.applied,
        });
      }

    

      // Default route
      return new Response("Backend Wizards — String Analyzer Stage 1 🧙‍♂️", {
        status: 200,
      });
    } catch (err: any) {
      console.error("Error:", err);
      return json({ error: err?.message || "Internal error" }, 500);
    }
  },
};

// ---------- Helper utilities ----------

// Simple JSON response helper
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

// Compute SHA-256 for GET/DELETE hash lookup
async function computeHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  // In Cloudflare Workers the global crypto is available; cast to any to satisfy TS in different environments
  const subtle = ((globalThis as any).crypto || (globalThis as any).msCrypto)?.subtle as SubtleCrypto | undefined;
  if (!subtle) throw new Error("SubtleCrypto not available");
  const hash = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Filtering logic
function applyFilters(records: any[], params: URLSearchParams) {
  const applied: Record<string, any> = {};
  let filtered = records;

  if (params.has("is_palindrome")) {
    const boolVal = params.get("is_palindrome") === "true";
    filtered = filtered.filter((r) => r.properties.is_palindrome === boolVal);
    applied.is_palindrome = boolVal;
  }

  if (params.has("min_length")) {
    const min = parseInt(params.get("min_length") || "0", 10);
    filtered = filtered.filter((r) => r.properties.length >= min);
    applied.min_length = min;
  }

  if (params.has("max_length")) {
    const max = parseInt(params.get("max_length") || "99999", 10);
    filtered = filtered.filter((r) => r.properties.length <= max);
    applied.max_length = max;
  }

  if (params.has("word_count")) {
  const wc = parseInt(params.get("word_count") || "0", 10);
  filtered = filtered.filter((r) => Number(r.properties.word_count) === wc);
  applied.word_count = wc;
	}


  if (params.has("contains_character")) {
    const ch = params.get("contains_character") || "";
    filtered = filtered.filter((r) => r.value.includes(ch));
    applied.contains_character = ch;
  }

  return { data: filtered, applied };
}

// Very small heuristic parser for natural language queries used by the filter endpoint
function parseNaturalLanguageQuery(q: string): Record<string, string | number | boolean> | null {
  const lowered = q.toLowerCase().trim();
  const out: Record<string, string | number | boolean> = {};

  // word count: look for 'single word', 'one word', '2 word' etc.
  const singleWord = /\b(single word|one word|\b1 word)\b/.test(lowered);
  if (singleWord) out.word_count = 1;

  // palindromic
  if (/(palindromic|palindrome|palindromic strings|palindromes)/.test(lowered)) {
    out.is_palindrome = true;
  }

  // longer than N (e.g., 'longer than 10 characters')
  const longerMatch = lowered.match(/longer than (\d+) characters?/);
  if (longerMatch && typeof longerMatch[1] === "string") {
    const n = parseInt(longerMatch[1], 10);
    if (!isNaN(n)) out.min_length = n + 1;
  }

  // contains letter z / contains the letter z
  const containsLetterMatch = lowered.match(/contain(?:ing|s)? the letter ([a-z])/);
  if (containsLetterMatch && typeof containsLetterMatch[1] === "string") {
    out.contains_character = containsLetterMatch[1];
  } else {
    // generic 'containing the letter x' or 'contain the letter x' or 'containing x'
    const simpleContains = lowered.match(/containing (?:the )?([a-z])/);
    if (simpleContains && typeof simpleContains[1] === "string") out.contains_character = simpleContains[1];
  }

  // If we found nothing reasonable, return null
  if (Object.keys(out).length === 0) return null;
  return out;
}