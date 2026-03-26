// Generate SQL UPDATE statements to fix video URLs in production DB
// Maps DB episode IDs to the correct R2 object keys

const VIDEO_BASE = "https://videos.xflexwithai.com"; // stored with legacy domain, normalizeVideoUrl handles rewrite

const fixes = [
  {
    id: 4,
    oldTitle: "شرح أهم مصطلحات التداول",
    newTitle: "أهم مصطلحات التداول",
    r2Key: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 4 - أهم مصطلحات التداول.mp4",
  },
  {
    id: 5,
    oldTitle: "شرح أهم مصطلحات التداول 2",
    newTitle: "تابع أهم مصطلحات التداول",
    r2Key: "media/Courses/Trading_Course/1st_level/المرحلة الأولى - 5 - تابع أهم مصطلحات التداول.mp4",
  },
  {
    id: 15,
    oldTitle: "العرض و الطلب",
    newTitle: "محتويات المرحلة الثانية",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 01 - محتويات المرحلة الثانية.mp4",
  },
  {
    id: 16,
    oldTitle: "مفهوم العرض و الطلب",
    newTitle: "تعرف على الشارت",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 02 - تعرف على الشارت.mp4",
  },
  {
    id: 17,
    oldTitle: "انواع السيولة",
    newTitle: "التصحيح و التذبذب",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 03 - التصحيح و التذبذب.mp4",
  },
  {
    id: 18,
    oldTitle: "كيف تحدد السيولة",
    newTitle: "الدعوم و المقاومة",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 04 - الدعوم و المقاومة.mp4",
  },
  {
    id: 19,
    oldTitle: "كيف يتحرك السعر",
    newTitle: "التجميع و التصريف",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 05 - التجميع و التصريف.mp4",
  },
  {
    id: 20,
    oldTitle: "تحديد الترند",
    newTitle: "البرايس أكشن",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 06 - البرايس أكشن.mp4",
  },
  {
    id: 21,
    oldTitle: "الدعوم و المقاومات",
    newTitle: "ستوب لوس",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 07 - ستوب لوس.mp4",
  },
  {
    id: 22,
    oldTitle: "الدعوم و المقاومات بشكل عملي",
    newTitle: "نموذج الرأس و الكتفين",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 08 - نموذج الرأس و الكتفين.mp4",
  },
  {
    id: 23,
    oldTitle: "الدعم و المقاومة الديناميكية",
    newTitle: "القمم المزدوجة",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 09 - القمم المزدوجة.mp4",
  },
  {
    id: 24,
    oldTitle: "الدعوم و المقاومات الديناميكية بشكل عملي",
    newTitle: "الاستمرارية و المثلثات",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 10 - الاستمرارية و المثلثات.mp4",
  },
  {
    id: 25,
    oldTitle: "المرحلة الثالثة من تعلم التحليل الفني",
    newTitle: "كيف نضع ستوب لوس بشكل مبسط",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 11 - كيف نضع ستوب لوس بشكل مبسط.mp4",
  },
  {
    id: 26,
    oldTitle: "المرحلة الرابعة من تعلم التحليل الفني",
    newTitle: "المرحلة الخامسة من تعلم التحليل الفني",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 12 - المرحلة الخامسة من تعلم التحليل الفني.mp4",
  },
  {
    id: 27,
    oldTitle: "المرحلة الخامسة من تعلم التحليل الفني",
    newTitle: "المرحلة السادسة من تعلم التحليل الفني",
    r2Key: "media/Courses/Trading_Course/2nd_3rd_levels/المرحلة الثانية و الثالثة - 13 - المرحلة السادسة من تعلم التحليل الفني.mp4",
  },
];

// Generate SQL statements
console.log("-- Fix video URLs to match actual R2 object keys");
console.log("-- Total fixes: " + fixes.length);
console.log();

for (const fix of fixes) {
  const encodedKey = encodeURIComponent(fix.r2Key).replace(/%2F/g, '/');
  const newUrl = `${VIDEO_BASE}/${encodedKey}`;
  
  // Update both videoUrl and titleAr
  console.log(`-- Episode ${fix.id}: "${fix.oldTitle}" -> "${fix.newTitle}"`);
  console.log(`UPDATE episodes SET videoUrl = '${newUrl}', titleAr = '${fix.newTitle}' WHERE id = ${fix.id};`);
  console.log();
}
