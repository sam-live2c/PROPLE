/// <reference types="vite/client" />
import { Meilisearch } from 'meilisearch';

// Initialize Meilisearch client
// In a real app, you would host Meilisearch (e.g., on Meilisearch Cloud, AWS, etc.)
// and set these environment variables.
const host = import.meta.env.VITE_MEILISEARCH_HOST || 'http://127.0.0.1:7700';
const apiKey = import.meta.env.VITE_MEILISEARCH_SEARCH_KEY || 'masterKey';

export const meiliClient = new Meilisearch({
  host,
  apiKey,
});

// We create separate logic for searching if Meilisearch is active or reachable.
export const isMeilisearchConfigured = () => {
    return !!import.meta.env.VITE_MEILISEARCH_HOST;
};
