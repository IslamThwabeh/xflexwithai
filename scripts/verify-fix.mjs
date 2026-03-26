// Verify that the updated URLs now resolve correctly
const VIDEO_BASE = "https://videos.xflexacademy.com";

const fixedUrls = [
  { id: 4, url: `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%204%20-%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4` },
  { id: 5, url: `${VIDEO_BASE}/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%205%20-%20%D8%AA%D8%A7%D8%A8%D8%B9%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4` },
  { id: 15, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2001%20-%20%D9%85%D8%AD%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9.mp4` },
  { id: 16, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2002%20-%20%D8%AA%D8%B9%D8%B1%D9%81%20%D8%B9%D9%84%D9%89%20%D8%A7%D9%84%D8%B4%D8%A7%D8%B1%D8%AA.mp4` },
  { id: 17, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2003%20-%20%D8%A7%D9%84%D8%AA%D8%B5%D8%AD%D9%8A%D8%AD%20%D9%88%20%D8%A7%D9%84%D8%AA%D8%B0%D8%A8%D8%B0%D8%A8.mp4` },
  { id: 18, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2004%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9.mp4` },
  { id: 19, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2005%20-%20%D8%A7%D9%84%D8%AA%D8%AC%D9%85%D9%8A%D8%B9%20%D9%88%20%D8%A7%D9%84%D8%AA%D8%B5%D8%B1%D9%8A%D9%81.mp4` },
  { id: 20, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2006%20-%20%D8%A7%D9%84%D8%A8%D8%B1%D8%A7%D9%8A%D8%B3%20%D8%A3%D9%83%D8%B4%D9%86.mp4` },
  { id: 21, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2007%20-%20%D8%B3%D8%AA%D9%88%D8%A8%20%D9%84%D9%88%D8%B3.mp4` },
  { id: 22, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2008%20-%20%D9%86%D9%85%D9%88%D8%B0%D8%AC%20%D8%A7%D9%84%D8%B1%D8%A3%D8%B3%20%D9%88%20%D8%A7%D9%84%D9%83%D8%AA%D9%81%D9%8A%D9%86.mp4` },
  { id: 23, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2009%20-%20%D8%A7%D9%84%D9%82%D9%85%D9%85%20%D8%A7%D9%84%D9%85%D8%B2%D8%AF%D9%88%D8%AC%D8%A9.mp4` },
  { id: 24, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2010%20-%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%85%D8%B1%D8%A7%D8%B1%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D9%85%D8%AB%D9%84%D8%AB%D8%A7%D8%AA.mp4` },
  { id: 25, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2011%20-%20%D9%83%D9%8A%D9%81%20%D9%86%D8%B6%D8%B9%20%D8%B3%D8%AA%D9%88%D8%A8%20%D9%84%D9%88%D8%B3%20%D8%A8%D8%B4%D9%83%D9%84%20%D9%85%D8%A8%D8%B3%D8%B7.mp4` },
  { id: 26, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2012%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4` },
  { id: 27, url: `${VIDEO_BASE}/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4` },
];

async function main() {
  let ok = 0, fail = 0;
  for (const { id, url } of fixedUrls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.status === 200) {
        ok++;
        console.log(`OK [200] Episode ${id}`);
      } else {
        fail++;
        console.log(`FAIL [${res.status}] Episode ${id}: ${decodeURIComponent(url.replace(VIDEO_BASE, ''))}`);
      }
    } catch (e) {
      fail++;
      console.log(`ERR Episode ${id}: ${e.message}`);
    }
  }
  console.log(`\nResult: ${ok} OK, ${fail} FAIL out of ${fixedUrls.length} fixed episodes`);
}

main();
