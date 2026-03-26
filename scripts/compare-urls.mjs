// Compare DB video URLs with actual R2 object keys
const VIDEO_BASE = "https://videos.xflexacademy.com";

async function listR2(prefix) {
  const res = await fetch(`http://localhost:8787/?prefix=${encodeURIComponent(prefix)}`);
  const data = await res.json();
  return data.objects
    .filter(o => o.size > 0) // skip empty "directory" entries
    .map(o => o.key);
}

async function getDbUrls() {
  // These are the decoded filenames from the production DB (already verified above)
  // Extracted from the wrangler d1 query results
  return [
    { id: 1, order: 1, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 1 - محتويات الكورس.mp4" },
    { id: 2, order: 2, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 2 - ما هي الأسواق المالية.mp4" },
    { id: 3, order: 3, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 3 - شرح أساسيات التداول.mp4" },
    { id: 4, order: 4, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 4 - شرح أهم مصطلحات التداول.mp4" },
    { id: 5, order: 5, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 5 - شرح أهم مصطلحات التداول 2.mp4" },
    { id: 6, order: 6, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 6 - الرافعة المالية.mp4" },
    { id: 7, order: 7, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 7 - الهامش و أنواعه و كل ما يتعلق به.mp4" },
    { id: 8, order: 8, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 8 - الامتداد.mp4" },
    { id: 9, order: 9, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 9 - الأوامر.mp4" },
    { id: 10, order: 10, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 10 - كيفية فتح حساب تجريبي في ميتا تريدر5.mp4" },
    { id: 11, order: 11, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 11 - كيفية دخول صفقة على ميتا تريدر.mp4" },
    { id: 12, order: 12, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 12 - كل ما يتعلق في حساب ميتا تريدر.mp4" },
    { id: 13, order: 13, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 13 - كيفية فتح صفقة على حسابك في ميتا تريدر.mp4" },
    { id: 14, order: 14, path: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 14 - الخاتمة.mp4" },
    { id: 15, order: 15, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 01 - العرض و الطلب.mp4" },
    { id: 16, order: 16, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 02 - مفهوم العرض و الطلب.mp4" },
    { id: 17, order: 17, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 03 - انواع السيولة.mp4" },
    { id: 18, order: 18, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 04 - كيف تحدد السيولة.mp4" },
    { id: 19, order: 19, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 05 - كيف يتحرك السعر.mp4" },
    { id: 20, order: 20, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 06 - تحديد الترند.mp4" },
    { id: 21, order: 21, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 07 - الدعوم و المقاومات.mp4" },
    { id: 22, order: 22, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 08 - الدعوم و المقاومات بشكل عملي.mp4" },
    { id: 23, order: 23, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 09 - الدعم و المقاومة الديناميكية.mp4" },
    { id: 24, order: 24, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 10 - الدعوم و المقاومات الديناميكية بشكل عملي.mp4" },
    { id: 25, order: 25, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 11 - المرحلة الثالثة من تعلم التحليل الفني.mp4" },
    { id: 26, order: 26, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 12 - المرحلة الرابعة من تعلم التحليل الفني.mp4" },
    { id: 27, order: 27, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 13 - المرحلة الخامسة من تعلم التحليل الفني.mp4" },
    { id: 28, order: 28, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 14 - الفرق بين ميتا تريدر و تريدنف فيو.mp4" },
    { id: 29, order: 29, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 15 - التحليل الفني بشكل عملي.mp4" },
    { id: 30, order: 30, path: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 16 - الدعوم و المقاومة بشكل عملي.mp4" },
    { id: 31, order: 31, path: "media/Courses/Trading_Course/4th_level/المرحلة الرابعة - 01 - التحليل الاساسي.mp4" },
    { id: 32, order: 32, path: "media/Courses/Trading_Course/4th_level/المرحلة الرابعة - 02 - اول مراحل التحليل الاساسي.mp4" },
    { id: 33, order: 33, path: "media/Courses/Trading_Course/4th_level/المرحلة الرابعة - 03 - ثاني و ثالث مراحل التحليل الاساسي.mp4" },
    { id: 34, order: 34, path: "media/Courses/Trading_Course/4th_level/المرحلة الرابعة - 04 - رابع مرحلة للتحليل الاساسي.mp4" },
    { id: 35, order: 35, path: "media/Courses/Trading_Course/4th_level/المرحلة الرابعة - 05 - اخر مراحل التحليل الاساسي.mp4" },
    { id: 36, order: 36, path: "media/Courses/Trading_Course/5th_level/المرحلة الخامسة - 01 - ادارة رأس المال و المخاطر.mp4" },
    { id: 37, order: 37, path: "media/Courses/Trading_Course/6th_level/المرحة السادسة - 01 - ادارة التوصيات.mp4" },
    { id: 38, order: 38, path: "media/Courses/Trading_Course/7th_level/المرحة السابعة - 01 - ادارة العوامل النفسية.mp4" },
    { id: 39, order: 39, path: "media/Courses/Trading_Course/8th_level/المرحلة الثامنة - 01 - اصنع خطتك الخاصة للتداول.mp4" },
  ];
}

async function main() {
  const prefixes = [
    "media/Courses/Trading_Course/1st_level/",
    "media/Courses/Trading_Course/2nd_3rd_levels/",
    "media/Courses/Trading_Course/4th_level/",
    "media/Courses/Trading_Course/5th_level/",
    "media/Courses/Trading_Course/6th_level/",
    "media/Courses/Trading_Course/7th_level/",
    "media/Courses/Trading_Course/8th_level/",
  ];

  // Collect all R2 keys
  const r2Keys = new Set();
  for (const prefix of prefixes) {
    const keys = await listR2(prefix);
    keys.forEach(k => r2Keys.add(k));
  }

  console.log(`Total R2 objects: ${r2Keys.size}\n`);

  const dbEpisodes = await getDbUrls();
  
  let mismatched = 0;
  let matched = 0;
  
  console.log("=== COMPARISON: DB URL vs R2 Key ===\n");
  
  for (const ep of dbEpisodes) {
    const dbPath = ep.path;
    if (r2Keys.has(dbPath)) {
      matched++;
      // Don't print matches to keep output short
    } else {
      mismatched++;
      // Find the closest R2 key in the same directory
      const dir = dbPath.substring(0, dbPath.lastIndexOf('/') + 1);
      const dbFilename = dbPath.substring(dbPath.lastIndexOf('/') + 1);
      
      // Find R2 keys in the same directory
      const r2InDir = [...r2Keys].filter(k => k.startsWith(dir));
      
      // Extract episode number from DB filename
      const dbMatch = dbFilename.match(/- (\d+) -/);
      const epNum = dbMatch ? dbMatch[1].padStart(2, '0') : null;
      
      // Find matching R2 key by episode number
      const r2Match = r2InDir.find(k => {
        const r2Filename = k.substring(k.lastIndexOf('/') + 1);
        const r2NumMatch = r2Filename.match(/- (\d+) -/);
        return r2NumMatch && r2NumMatch[1].padStart(2, '0') === epNum;
      });
      
      console.log(`MISMATCH Episode ${ep.order} (id=${ep.id}):`);
      console.log(`  DB:  ${dbFilename}`);
      if (r2Match) {
        const r2Filename = r2Match.substring(r2Match.lastIndexOf('/') + 1);
        console.log(`  R2:  ${r2Filename}`);
      } else {
        console.log(`  R2:  ** NO MATCHING FILE FOUND **`);
        console.log(`  Available in dir: ${r2InDir.map(k => k.substring(k.lastIndexOf('/') + 1)).join('\n    ')}`);
      }
      console.log();
    }
  }
  
  console.log(`\nSummary: ${matched} matched, ${mismatched} mismatched out of ${dbEpisodes.length} episodes`);
}

main().catch(console.error);
