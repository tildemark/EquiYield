/**
 * Get the API base URL dynamically based on the current environment
 * This allows the frontend to work on both localhost and network access
 */
export function getApiBaseUrl(): string {
  // If explicitly set in environment, use it
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // For client-side, detect from window.location
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Use the same host but port 4000 for the API
    return `http://${hostname}:4000`;
  }

  // Fallback for server-side rendering
  return 'http://localhost:4000';
}
