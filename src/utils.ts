// src/utils.ts
// Utility functions for String Analyzer Service

// Compute SHA-256 hash of a string
export async function computeSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Check if a string is palindrome (case-insensitive)
export function isPalindrome(value: string): boolean {
  const cleaned = value.replace(/[\W_]/g, "").toLowerCase();
  return cleaned === cleaned.split("").reverse().join("");
}

// Count unique characters in the string
export function countUniqueChars(value: string): number {
  return new Set(value).size;
}

// Count words (split by whitespace)
export function countWords(value: string): number {
  const words = value.trim().split(/\s+/);
  return value.trim() === "" ? 0 : words.length;
}

// Character frequency map
export function getCharFrequency(value: string): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const char of value) {
    freq[char] = (freq[char] || 0) + 1;
  }
  return freq;
}

// Analyze a given string and return all computed properties
export async function analyzeString(value: string) {
  const sha256_hash = await computeSHA256(value);
  const analysis = {
    length: value.length,
    is_palindrome: isPalindrome(value),
    unique_characters: countUniqueChars(value),
    word_count: countWords(value),
    sha256_hash,
    character_frequency_map: getCharFrequency(value)
  };
  return analysis;
}
