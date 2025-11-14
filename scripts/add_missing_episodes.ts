// Script to add missing episodes (completes all 39 episodes)
// Run with: tsx add_missing_episodes.ts

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

// All 39 episodes with their correct data
const allEpisodes = [
  { titleAr: "مقدمة عن التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2001%20-%20%D9%85%D9%82%D8%AF%D9%85%D8%A9%20%D8%B9%D9%86%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", order: 1 },
  { titleAr: "ماهو التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2002%20-%20%D9%85%D8%A7%D9%87%D9%88%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", order: 2 },
  { titleAr: "اساسيات التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2003%20-%20%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", order: 3 },
  { titleAr: "الاطر الزمنية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2004%20-%20%D8%A7%D9%84%D8%A7%D8%B7%D8%B1%20%D8%A7%D9%84%D8%B2%D9%85%D9%86%D9%8A%D8%A9.mp4", order: 4 },
  { titleAr: "هيكل السوق", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2005%20-%20%D9%87%D9%8A%D9%83%D9%84%20%D8%A7%D9%84%D8%B3%D9%88%D9%82.mp4", order: 5 },
  { titleAr: "الترند و التذبذب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2006%20-%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF%20%D9%88%20%D8%A7%D9%84%D8%AA%D8%B0%D8%A8%D8%B0%D8%A8.mp4", order: 6 },
  { titleAr: "اتجاه الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2007%20-%20%D8%A7%D8%AA%D8%AC%D8%A7%D9%87%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", order: 7 },
  { titleAr: "قوة الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A7%D9%88%D9%84%D9%89%20-%2008%20-%20%D9%82%D9%88%D8%A9%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", order: 8 },
  { titleAr: "العرض و الطلب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", order: 9 },
  { titleAr: "مفهوم العرض و الطلب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2002%20-%20%D9%85%D9%81%D9%87%D9%88%D9%85%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", order: 10 },
  { titleAr: "انواع السيولة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2003%20-%20%D8%A7%D9%86%D9%88%D8%A7%D8%B9%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", order: 11 },
  { titleAr: "كيف تحدد السيولة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2004%20-%20%D9%83%D9%8A%D9%81%20%D8%AA%D8%AD%D8%AF%D8%AF%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", order: 12 },
  { titleAr: "كيف يتحرك السعر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2005%20-%20%D9%83%D9%8A%D9%81%20%D9%8A%D8%AA%D8%AD%D8%B1%D9%83%20%D8%A7%D9%84%D8%B3%D8%B9%D8%B1.mp4", order: 13 },
  { titleAr: "تحديد الترند", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2006%20-%20%D8%AA%D8%AD%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", order: 14 },
  { titleAr: "الدعوم و المقاومات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2007%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA.mp4", order: 15 },
  { titleAr: "الدعوم و المقاومات بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2008%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", order: 16 },
  { titleAr: "الدعم و المقاومة الديناميكية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2009%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9.mp4", order: 17 },
  { titleAr: "الدعوم و المقاومات الديناميكية بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2010%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", order: 18 },
  { titleAr: "المرحلة الثالثة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2011%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", order: 19 },
  { titleAr: "المرحلة الرابعة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2012%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", order: 20 },
  { titleAr: "المرحلة الخامسة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", order: 21 },
  { titleAr: "المرحلة السادسة من تعلم التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", order: 22 },
  { titleAr: "الفرق بين ميتا تريدر و تريدنف فيو", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2014%20-%20%D8%A7%D9%84%D9%81%D8%B1%D9%82%20%D8%A8%D9%8A%D9%86%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1%20%D9%88%20%D8%AA%D8%B1%D9%8A%D8%AF%D9%86%D9%81%20%D9%81%D9%8A%D9%88.mp4", order: 23 },
  { titleAr: "التحليل الفني بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2015%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", order: 24 },
  { titleAr: "الدعوم و المقاومة بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2016%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", order: 25 },
  { titleAr: "التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", order: 26 },
  { titleAr: "اول مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2002%20-%20%D8%A7%D9%88%D9%84%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", order: 27 },
  { titleAr: "ثاني و ثالث مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2003%20-%20%D8%AB%D8%A7%D9%86%D9%8A%20%D9%88%20%D8%AB%D8%A7%D9%84%D8%AB%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", order: 28 },
  { titleAr: "رابع مرحلة للتحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2004%20-%20%D8%B1%D8%A7%D8%A8%D8%B9%20%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D9%84%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", order: 29 },
  { titleAr: "اخر مراحل التحليل الاساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2005%20-%20%D8%A7%D8%AE%D8%B1%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", order: 30 },
  { titleAr: "ادارة رأس المال و المخاطر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/5th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%B1%D8%A3%D8%B3%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%20%D9%88%20%D8%A7%D9%84%D9%85%D8%AE%D8%A7%D8%B7%D8%B1.mp4", order: 31 },
  { titleAr: "ادارة التوصيات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/6th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D8%A7%D8%AA.mp4", order: 32 },
  { titleAr: "ادارة العوامل النفسية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/7th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B9%D9%88%D8%A7%D9%85%D9%84%20%D8%A7%D9%84%D9%86%D9%81%D8%B3%D9%8A%D8%A9.mp4", order: 33 },
  { titleAr: "اصنع خطتك الخاصة للتداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/8th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%85%D9%86%D8%A9%20-%2001%20-%20%D8%A7%D8%B5%D9%86%D8%B9%20%D8%AE%D8%B7%D8%AA%D9%83%20%D8%A7%D9%84%D8%AE%D8%A7%D8%B5%D8%A9%20%D9%84%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", order: 34 },
];

async function addMissingEpisodes() {
  try {
    console.log("🚀 Adding missing episodes...\n");
    
    // Get the course
    const courses = await db.select().from(schema.courses).limit(1);
    if (courses.length === 0) {
      console.error("❌ No course found! Please run populate_course_complete.ts first.");
      process.exit(1);
    }
    
    const courseId = courses[0].id;
    console.log(`✅ Found course: ${courses[0].titleEn}`);
    console.log(`📚 Course ID: ${courseId}\n`);
    
    // Get existing episodes
    const existingEpisodes = await db.select().from(schema.episodes)
      .where(eq(schema.episodes.courseId, courseId));
    
    console.log(`📊 Current episodes: ${existingEpisodes.length}/39\n`);
    
    // Find which episodes are missing by checking the order number
    const existingOrders = new Set(existingEpisodes.map(ep => ep.order));
    const missingEpisodes = allEpisodes.filter(ep => !existingOrders.has(ep.order));
    
    if (missingEpisodes.length === 0) {
      console.log("✅ All 39 episodes already exist! Nothing to add.");
      await client.end();
      process.exit(0);
    }
    
    console.log(`🎬 Adding ${missingEpisodes.length} missing episodes...\n`);
    
    let added = 0;
    for (const episode of missingEpisodes) {
      await db.insert(schema.episodes).values({
        courseId,
        titleEn: episode.titleAr,
        titleAr: episode.titleAr,
        descriptionEn: "",
        descriptionAr: "",
        videoUrl: episode.videoUrl,
        duration: 600,
        order: episode.order,
        isFree: false,
      });
      added++;
      console.log(`  ✓ Episode ${episode.order}/39: ${episode.titleAr}`);
    }
    
    console.log(`\n🎉 SUCCESS! Added ${added} episodes!`);
    console.log(`\n📊 Final Summary:`);
    console.log(`   - Total episodes: 39`);
    console.log(`   - Previously existing: ${existingEpisodes.length}`);
    console.log(`   - Newly added: ${added}`);
    console.log(`\n✨ Your course is now complete!`);
    console.log(`\n🔗 Next steps:`);
    console.log(`   1. Go to https://xflexwithai.com/admin/keys`);
    console.log(`   2. Generate a registration key`);
    console.log(`   3. Activate it and watch all 39 videos!`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error adding episodes:", error);
    await client.end();
    process.exit(1);
  }
}

addMissingEpisodes();
