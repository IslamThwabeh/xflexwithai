// Quick script to check which video URLs return 200 vs 404

const VIDEO_BASE = "https://videos.xflexacademy.com";

async function checkUrl(name, url) {
  const normalizedUrl = url.replace(/^https?:\/\/videos\.xflexwithai\.com/i, VIDEO_BASE);
  try {
    const res = await fetch(normalizedUrl, { method: 'HEAD' });
    const status = res.status;
    const ct = res.headers.get('content-type') || '';
    console.log(`${status === 200 ? 'OK' : 'FAIL'} [${status}] ${name}`);
    if (status !== 200) {
      console.log(`  URL: ${normalizedUrl}`);
    }
    return status;
  } catch (e) {
    console.log(`ERR ${name}: ${e.message}`);
    return 0;
  }
}

async function main() {
  // Read seed data directly
  const episodes = [];
  
  // Hard-code the seed URLs by reading them from the file
  // Instead, let's use tsx to import the module
  
  // Test specific URLs to identify the pattern
  const tests = [
    // Episode 1 (works) - from seed
    ["Ep1 seed", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%201%20-%20%D9%85%D8%AD%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D9%83%D9%88%D8%B1%D8%B3.mp4`],
    
    // Episode 4 (broken) - from seed (single digit, with hamza)
    ["Ep4 seed (broken)", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%204%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4`],
    
    // Episode 4 - zero padded, with hamza
    ["Ep4 zero-padded+hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2004%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4`],
    
    // Episode 4 - single digit, no hamza  (الاولى instead of الأولى)
    ["Ep4 no-hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%204%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4`],
    
    // Episode 4 - zero padded, no hamza
    ["Ep4 zero-padded+no-hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2004%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4`],

    // Episode 4 from populate_course_complete.ts (different content: الاطر الزمنية)
    ["Ep4 populate-script", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2004%20-%20%D8%A7%D9%84%D8%A7%D8%B7%D8%B1%20%D8%A7%D9%84%D8%B2%D9%85%D9%86%D9%8A%D8%A9.mp4`],

    // Episode 5 (broken) - from seed
    ["Ep5 seed (broken)", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%205%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84%202.mp4`],

    // Episode 5 - zero padded + hamza
    ["Ep5 zero-padded+hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2005%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84%202.mp4`],
    
    // Episode 5 - no hamza
    ["Ep5 no-hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%205%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84%202.mp4`],

    // Episode 5 - zero padded + no hamza
    ["Ep5 zero-padded+no-hamza", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2005%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84%202.mp4`],

    // Also test episode 6 (works) to confirm pattern
    ["Ep6 seed (works)", `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%206%20-%20%D8%A7%D9%84%D8%B1%D8%A7%D9%81%D8%B9%D8%A9%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%D9%8A%D8%A9.mp4`],
  ];
  
  console.log("Testing URL variations for episodes 4 and 5...\n");
  
  for (const [name, url] of tests) {
    await checkUrl(name, url);
  }
  
  // Decode and show what each URL means
  console.log("\n--- Decoded URLs ---");
  for (const [name, url] of tests) {
    const path = decodeURIComponent(url.replace(VIDEO_BASE, ''));
    console.log(`${name}: ${path}`);
  }
}

main();
