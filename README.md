# Backend Wizards — Stage 1 Task: String Analyzer Service

## 🚀 Overview
This project implements a String Analyzer REST API using Cloudflare Workers (TypeScript) and KV Storage.  
Each submitted string is analyzed, its computed properties are stored, and you can retrieve, filter, or delete records.  
Every string is uniquely identified by its SHA-256 hash.

---

## 🧩 Endpoints

### 1️⃣ Create / Analyze String
POST /strings

Request Body:
{
  "value": "string to analyze"
}

Success Response (201 Created):
{
  "id": "sha256_hash_value",
  "value": "string to analyze",
  "properties": {
    "length": 16,
    "is_palindrome": false,
    "unique_characters": 12,
    "word_count": 3,
    "sha256_hash": "abc123...",
    "character_frequency_map": { "s": 2, "t": 3 }
  },
  "created_at": "2025-10-17T10:00:00Z"
}

Error Responses:
400 Bad Request – Missing or invalid "value"
409 Conflict – String already exists
422 Unprocessable Entity – Invalid data type for "value"

---

### 2️⃣ Get Specific String
GET /strings/{string_value}

Returns the full record for the given string.
Error 404 Not Found if the string does not exist.

---

### 3️⃣ Get All Strings (with Filtering)
GET /strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a

Supported Query Parameters:
- is_palindrome: boolean (true/false)
- min_length: integer
- max_length: integer
- word_count: integer
- contains_character: single character

Response:
{
  "data": [ { ... }, { ... } ],
  "count": 15,
  "filters_applied": {
    "is_palindrome": true,
    "min_length": 5,
    "max_length": 20,
    "word_count": 2,
    "contains_character": "a"
  }
}

Error Response:
400 Bad Request – Invalid query parameter or type

---

### 4️⃣ Natural Language Filtering
GET /strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings

Response:
{
  "data": [ ... ],
  "count": 3,
  "interpreted_query": {
    "original": "all single word palindromic strings",
    "parsed_filters": {
      "word_count": 1,
      "is_palindrome": true
    }
  }
}

Example Supported Queries:
- "all single word palindromic strings"
- "strings longer than 10 characters"
- "palindromic strings that contain the first vowel"
- "strings containing the letter z"

Error Responses:
400 Bad Request – Unable to parse query
422 Unprocessable Entity – Conflicting filters

---

### 5️⃣ Delete String
DELETE /strings/{string_value}

Response:
204 No Content (on success)
404 Not Found (if string does not exist)

---

## 🧮 Computed Properties
length – total number of characters  
is_palindrome – true if string reads the same forwards and backwards (case-insensitive)  
unique_characters – number of distinct characters  
word_count – number of words separated by whitespace  
sha256_hash – unique SHA-256 fingerprint  
character_frequency_map – object showing each character’s occurrence count

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
git clone https://github.com/abijay440/string-analyzer-worker.git
cd string-analyzer-worker

### 2. Install Dependencies
npm install

### 3. Run Locally
npx wrangler dev

Access: http://localhost:8787

### 4. Deploy to Cloudflare
npx wrangler deploy

---

## 🧰 KV Storage Configuration
In your wrangler.toml, add:

[[kv_namespaces]]
binding = "STRINGS_DB"
id = "<your-kv-id>"
preview_id = "<your-kv-preview-id>"

Each analyzed string is stored in KV using its SHA-256 hash as the key.

---

## 🧪 Example Test
curl -X POST "http://localhost:8787/strings" \
     -H "Content-Type: application/json" \
     -d '{"value":"racecar"}'

Expected Response:
{
  "id": "...",
  "value": "racecar",
  "properties": {
    "is_palindrome": true,
    "word_count": 1,
    "length": 7
  },
  "created_at": "..."
}

---

## 🧙 Tech Stack
Runtime: Cloudflare Workers (TypeScript)
Storage: Cloudflare KV
Hashing: Web Crypto API (SHA-256)
Framework: Native Fetch / Web API

---

## 🧑‍💻 Author
Abiodun Jegede  
Full-Stack Developer @ Abisofts  
Email: abiodun@gmail.com  
Stack: TypeScript / Cloudflare Workers / KV Storage
