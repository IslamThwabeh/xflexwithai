/**
 * Cloudflare Pages Functions
 * This handles SPA routing by serving index.html for all non-existent routes
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Check if the requested path is a file or directory
  // If it doesn't have a file extension and isn't a known API path, serve the app shell
  if (!url.pathname.includes('.') && 
      !url.pathname.startsWith('/api') &&
      url.pathname !== '/api' &&
      url.pathname !== '/') {
    // Fetch '/' to avoid the Pages canonical redirect from /index.html to /
    return context.env.ASSETS.fetch(new Request(url.origin + '/', request));
  }
  
  // For everything else, use default behavior
  return context.next();
}
