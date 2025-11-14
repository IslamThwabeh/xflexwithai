// Complete script to populate course and all 39 episodes
// Run with: tsx populate_course_complete.ts

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const courseData = {
  titleEn: "XFlex Trading Academy - Complete Trading Course",
  titleAr: "أكاديمية XFlex للتداول - دورة التداول الكاملة",
  descriptionEn: "A comprehensive trading course covering all aspects of technical analysis, market structure, supply and demand, liquidity, and trading psychology. Learn from beginner to advanced level with 39 detailed video lessons organized in 8 progressive levels.",
  descriptionAr: "دورة تداول شاملة تغطي جميع جوانب التحليل الفني، هيكل السوق، العرض والطلب، السيولة، وعلم نفس التداول. تعلم من المستوى المبتدئ إلى المتقدم مع 39 درس فيديو مفصل منظم في 8 مستويات تدريجية.",
  price: 0,
  currency: "USD" as const,
  isPublished: true,
  level: "beginner" as const,
  duration: 0,
};

const episodes = [
  { titleAr: "مقدمة عن التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2001%20-%20%D9%85%D9%82%D8%AF%D9%85%D8%A9%20%D8%B9%D9%86%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", level: "المرحلة الأولى" },
  { titleAr: "ماهو التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2002%20-%20%D9%85%D8%A7%D9%87%D9%88%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", level: "المرحلة الأولى" },
  { titleAr: "اساسيات التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2003%20-%20%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", level: "المرحلة الأولى" },
  { titleAr: "الاطر الزمنية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2004%20-%20%D8%A7%D9%84%D8%A7%D8%B7%D8%B1%20%D8%A7%D9%84%D8%B2%D9%85%D9%86%D9%8A%D8%A9.mp4", level: "المرحلة الأولى" },
  { titleAr: "هيكل السوق", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2005%20-%20%D9%87%D9%8A%D9%83%D9%84%20%D8%A7%D9%84%D8%B3%D9%88%D9%82.mp4", level: "المرحلة الأولى" },
  { titleAr: "الترند و التذبذب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2006%20-%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF%20%D9%88%20%D8%A7%D9%84%D8%AA%D8%B0%D8%A8%D8%B0%D8%A8.mp4", level: "المرحلة الأولى" },
  { titleAr: "اتجاه الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2007%20-%20%D8%A7%D8%AA%D8%AC%D8%A7%D9%87%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", level: "المرحلة الأولى" },
  { titleAr: "قوة الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2008%20-%20%D9%82%D9%88%D8%A9%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", level: "المرحلة الأولى" },
  { titleAr: "العرض و الطلب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "مفهوم العرض و الطلب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2002%20-%20%D9%85%D9%81%D9%87%D9%88%D9%85%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "انواع السيولة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2003%20-%20%D8%A7%D9%86%D9%88%D8%A7%D8%B9%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "كيف تحدد السيولة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2004%20-%20%D9%83%D9%8A%D9%81%20%D8%AA%D8%AD%D8%AF%D8%AF%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "كيف يتحرك السعر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2005%20-%20%D9%83%D9%8A%D9%81%20%D9%8A%D8%AA%D8%AD%D8%B1%D9%83%20%D8%A7%D9%84%D8%B3%D8%B9%D8%B1.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "تحديد الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2006%20-%20%D8%AA%D8%AD%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الدعوم و المقاومات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2007%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الدعوم و المقاومات بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2008%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الدعم و المقاومة الديناميكية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2009%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الدعوم و المقاومات الديناميكية بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2010%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "المرحلة الثالثة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2011%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "المرحلة الرابعة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2012%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "المرحلة الخامسة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "المرحلة السادسة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الفرق بين ميتا تريدر و تريدنف فيو", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2014%20-%20%D8%A7%D9%84%D9%81%D8%B1%D9%82%20%D8%A8%D9%8A%D9%86%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1%20%D9%88%20%D8%AA%D8%B1%D9%8A%D8%AF%D9%86%D9%81%20%D9%81%D9%8A%D9%88.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "التحليل الفني بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2015%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "الدعوم و المقاومة بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2016%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", level: "المرحلة الثانية و الثالثة" },
  { titleAr: "التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", level: "المرحلة الرابعة" },
  { titleAr: "اول مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2002%20-%20%D8%A7%D9%88%D9%84%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", level: "المرحلة الرابعة" },
  { titleAr: "ثاني و ثالث مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2003%20-%20%D8%AB%D8%A7%D9%86%D9%8A%20%D9%88%20%D8%AB%D8%A7%D9%84%D8%AB%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", level: "المرحلة الرابعة" },
  { titleAr: "رابع مرحلة للتحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2004%20-%20%D8%B1%D8%A7%D8%A8%D8%B9%20%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D9%84%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", level: "المرحلة الرابعة" },
  { titleAr: "اخر مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2005%20-%20%D8%A7%D8%AE%D8%B1%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", level: "المرحلة الرابعة" },
  { titleAr: "ادارة رأس المال و المخاطر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/5th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%B1%D8%A3%D8%B3%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%20%D9%88%20%D8%A7%D9%84%D9%85%D8%AE%D8%A7%D8%B7%D8%B1.mp4", level: "المرحلة الخامسة" },
  { titleAr: "ادارة التوصيات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/6th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D8%A7%D8%AA.mp4", level: "المرحلة السادسة" },
  { titleAr: "ادارة العوامل النفسية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/7th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B9%D9%88%D8%A7%D9%85%D9%84%20%D8%A7%D9%84%D9%86%D9%81%D8%B3%D9%8A%D8%A9.mp4", level: "المرحلة السابعة" },
  { titleAr: "اصنع خطتك الخاصة للتداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/8th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%85%D9%86%D8%A9%20-%2001%20-%20%D8%A7%D8%B5%D9%86%D8%B9%20%D8%AE%D8%B7%D8%AA%D9%83%20%D8%A7%D9%84%D8%AE%D8%A7%D8%B5%D8%A9%20%D9%84%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", level: "المرحلة الثامنة" },
];

async function populateCourseData() {
  try {
    console.log("🚀 Starting course data population...\n");
    
    // Check if course already exists
    const existingCourses = await db.select().from(schema.courses).limit(1);
    if (existingCourses.length > 0) {
      console.log("⚠️  Course already exists! Skipping course creation.");
      console.log(`✅ Existing course ID: ${existingCourses[0].id}`);
      console.log(`📚 Course: ${existingCourses[0].titleEn}\n`);
      
      // Check episodes
      const existingEpisodes = await db.select().from(schema.episodes).where(eq(schema.episodes.courseId, existingCourses[0].id));
      console.log(`📊 Found ${existingEpisodes.length} existing episodes`);
      
      if (existingEpisodes.length === 39) {
        console.log("✅ All 39 episodes already exist!");
        console.log("\n🎉 Course system is ready to use!");
        process.exit(0);
      } else {
        console.log(`⚠️  Only ${existingEpisodes.length}/39 episodes exist. Please check your database.`);
        process.exit(1);
      }
    }
    
    console.log("📚 Creating course...");
    const [course] = await db.insert(schema.courses).values(courseData).returning();
    console.log(`✅ Course created with ID: ${course.id}`);
    console.log(`   Title: ${course.titleEn}\n`);

    console.log(`🎬 Creating ${episodes.length} episodes...`);
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      await db.insert(schema.episodes).values({
        courseId: course.id,
        titleEn: episode.titleAr,
        titleAr: episode.titleAr,
        descriptionEn: "",
        descriptionAr: "",
        videoUrl: episode.videoUrl,
        duration: 600, // Default 10 minutes
        order: i + 1,
        isFree: false,
      });
      console.log(`  ✓ Episode ${i + 1}/39: ${episode.titleAr}`);
    }
    
    console.log(`\n🎉 SUCCESS! Course data populated successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - 1 course created`);
    console.log(`   - 39 episodes created`);
    console.log(`   - Organized in 8 levels`);
    console.log(`\n✨ Your course is ready to use!`);
    console.log(`\n🔗 Next steps:`);
    console.log(`   1. Go to https://xflexwithai.com/admin/keys`);
    console.log(`   2. Generate a registration key`);
    console.log(`   3. Activate the key at https://xflexwithai.com/activate-key`);
    console.log(`   4. Watch videos at https://xflexwithai.com/course/1`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error populating course data:", error);
    await client.end();
    process.exit(1);
  }
}

// Import eq function
import { eq } from "drizzle-orm";

// Run the script
populateCourseData();
