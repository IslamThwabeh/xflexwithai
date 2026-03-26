// Temporary script to list R2 objects in a specific prefix
// Run with: npx wrangler dev scripts/list-r2.js --remote --r2 BUCKET=xflexwithai-videos

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || 'media/Courses/Trading_Course/1st_level/';
    
    const listed = await env.BUCKET.list({ prefix, limit: 100 });
    
    const objects = listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
    }));
    
    return new Response(JSON.stringify({ 
      prefix,
      count: objects.length,
      truncated: listed.truncated,
      objects 
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
