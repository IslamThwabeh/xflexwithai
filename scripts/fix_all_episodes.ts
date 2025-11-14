// Complete fix: Delete all episodes and re-add all 39 with correct data
// Run with: tsx fix_all_episodes.ts

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

// All 39 episodes with CORRECT titles, URLs, and durations from Excel
const allEpisodes = [
  { titleAr: "محتويات الكورس", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%201%20-%20%D9%85%D8%AD%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D9%83%D9%88%D8%B1%D8%B3.mp4", duration: 182, order: 1 },
  { titleAr: "ما هي الأسواق المالية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%202%20-%20%D9%85%D8%A7%20%D9%87%D9%8A%20%D8%A7%D9%84%D8%A3%D8%B3%D9%88%D8%A7%D9%82%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%D9%8A%D8%A9.mp4", duration: 446, order: 2 },
  { titleAr: "شرح أساسيات التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%203%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D8%B3%D8%A7%D8%B3%D9%8A%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", duration: 309, order: 3 },
  { titleAr: "شرح أهم مصطلحات التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%204%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", duration: 448, order: 4 },
  { titleAr: "شرح أهم مصطلحات التداول 2", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%205%20-%20%D8%B4%D8%B1%D8%AD%20%D8%A3%D9%87%D9%85%20%D9%85%D8%B5%D8%B7%D9%84%D8%AD%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84%202.mp4", duration: 1049, order: 5 },
  { titleAr: "الرافعة المالية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%206%20-%20%D8%A7%D9%84%D8%B1%D8%A7%D9%81%D8%B9%D8%A9%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%D9%8A%D8%A9.mp4", duration: 842, order: 6 },
  { titleAr: "الهامش و أنواعه و كل ما يتعلق به", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%207%20-%20%D8%A7%D9%84%D9%87%D8%A7%D9%85%D8%B4%20%D9%88%20%D8%A3%D9%86%D9%88%D8%A7%D8%B9%D9%87%20%D9%88%20%D9%83%D9%84%20%D9%85%D8%A7%20%D9%8A%D8%AA%D8%B9%D9%84%D9%82%20%D8%A8%D9%87.mp4", duration: 534, order: 7 },
  { titleAr: "الامتداد", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%208%20-%20%D8%A7%D9%84%D8%A7%D9%85%D8%AA%D8%AF%D8%A7%D8%AF.mp4", duration: 748, order: 8 },
  { titleAr: "الأوامر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%209%20-%20%D8%A7%D9%84%D8%A3%D9%88%D8%A7%D9%85%D8%B1.mp4", duration: 639, order: 9 },
  { titleAr: "كيفية فتح حساب تجريبي في ميتا تريدر5", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2010%20-%20%D9%83%D9%8A%D9%81%D9%8A%D8%A9%20%D9%81%D8%AA%D8%AD%20%D8%AD%D8%B3%D8%A7%D8%A8%20%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A%20%D9%81%D9%8A%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B15.mp4", duration: 185, order: 10 },
  { titleAr: "كيفية دخول صفقة على ميتا تريدر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2011%20-%20%D9%83%D9%8A%D9%81%D9%8A%D8%A9%20%D8%AF%D8%AE%D9%88%D9%84%20%D8%B5%D9%81%D9%82%D8%A9%20%D8%B9%D9%84%D9%89%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1.mp4", duration: 608, order: 11 },
  { titleAr: "كل ما يتعلق في حساب ميتا تريدر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2012%20-%20%D9%83%D9%84%20%D9%85%D8%A7%20%D9%8A%D8%AA%D8%B9%D9%84%D9%82%20%D9%81%D9%8A%20%D8%AD%D8%B3%D8%A7%D8%A8%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1.mp4", duration: 276, order: 12 },
  { titleAr: "كيفية فتح صفقة على حسابك في ميتا تريدر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2013%20-%20%D9%83%D9%8A%D9%81%D9%8A%D8%A9%20%D9%81%D8%AA%D8%AD%20%D8%B5%D9%81%D9%82%D8%A9%20%D8%B9%D9%84%D9%89%20%D8%AD%D8%B3%D8%A7%D8%A8%D9%83%20%D9%81%D9%8A%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1.mp4", duration: 303, order: 13 },
  { titleAr: "الخاتمة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/1st_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%A3%D9%88%D9%84%D9%89%20-%2014%20-%20%D8%A7%D9%84%D8%AE%D8%A7%D8%AA%D9%85%D8%A9.mp4", duration: 147, order: 14 },
  { titleAr: "محتويات المرحلة الثانية ", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", duration: 645, order: 15 },
  { titleAr: "تعرف على الشارت", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2002%20-%20%D9%85%D9%81%D9%87%D9%88%D9%85%20%D8%A7%D9%84%D8%B9%D8%B1%D8%B6%20%D9%88%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8.mp4", duration: 1675, order: 16 },
  { titleAr: "التصحيح و التذبذب", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2003%20-%20%D8%A7%D9%86%D9%88%D8%A7%D8%B9%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", duration: 521, order: 17 },
  { titleAr: "الدعوم و المقاومة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2004%20-%20%D9%83%D9%8A%D9%81%20%D8%AA%D8%AD%D8%AF%D8%AF%20%D8%A7%D9%84%D8%B3%D9%8A%D9%88%D9%84%D8%A9.mp4", duration: 827, order: 18 },
  { titleAr: "التجميع و اتصريف", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2005%20-%20%D9%83%D9%8A%D9%81%20%D9%8A%D8%AA%D8%AD%D8%B1%D9%83%20%D8%A7%D9%84%D8%B3%D8%B9%D8%B1.mp4", duration: 510, order: 19 },
  { titleAr: "البرايس أكشن", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2006%20-%20%D8%AA%D8%AD%D8%AF%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D8%B1%D9%86%D8%AF.mp4", duration: 734, order: 20 },
  { titleAr: "ستوب لوس", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2007%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA.mp4", duration: 294, order: 21 },
  { titleAr: "نموذج الرأس و الكتفين", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2008%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", duration: 291, order: 22 },
  { titleAr: "القمم المزدوجة", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2009%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9.mp4", duration: 126, order: 23 },
  { titleAr: "الاستمرارية و المثلثات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2010%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AF%D9%8A%D9%86%D8%A7%D9%85%D9%8A%D9%83%D9%8A%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", duration: 269, order: 24 },
  { titleAr: "كيف نضع ستوب لوس بشكل مبسط", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2011%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", duration: 198, order: 25 },
  { titleAr: "المرحلة الخامسة من التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2012%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", duration: 501, order: 26 },
  { titleAr: "المرحلة السادسة من التحليل الفني", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2013%20-%20%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20%D9%85%D9%86%20%D8%AA%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A.mp4", duration: 606, order: 27 },
  { titleAr: "ميتا تريدر أو تريدنق فيو", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2014%20-%20%D8%A7%D9%84%D9%81%D8%B1%D9%82%20%D8%A8%D9%8A%D9%86%20%D9%85%D9%8A%D8%AA%D8%A7%20%D8%AA%D8%B1%D9%8A%D8%AF%D8%B1%20%D9%88%20%D8%AA%D8%B1%D9%8A%D8%AF%D9%86%D9%81%20%D9%81%D9%8A%D9%88.mp4", duration: 926, order: 28 },
  { titleAr: "التحليل الفني بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2015%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%81%D9%86%D9%8A%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", duration: 864, order: 29 },
  { titleAr: "الدعوم و المقاومة بشكل عملي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/2nd_3rd_levels/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%D8%A9%20%D9%88%20%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB%D8%A9%20-%2016%20-%20%D8%A7%D9%84%D8%AF%D8%B9%D9%88%D9%85%20%D9%88%20%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%88%D9%85%D8%A9%20%D8%A8%D8%B4%D9%83%D9%84%20%D8%B9%D9%85%D9%84%D9%8A.mp4", duration: 453, order: 30 },
  { titleAr: "كورس التحليل الأساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", duration: 401, order: 31 },
  { titleAr: "اول مراحل التحليل الأساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2002%20-%20%D8%A7%D9%88%D9%84%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", duration: 620, order: 32 },
  { titleAr: "ثاني و ثالث مراحل التحليل الأساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2003%20-%20%D8%AB%D8%A7%D9%86%D9%8A%20%D9%88%20%D8%AB%D8%A7%D9%84%D8%AB%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", duration: 681, order: 33 },
  { titleAr: "رابع مرحلة في التحليل الأساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2004%20-%20%D8%B1%D8%A7%D8%A8%D8%B9%20%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D9%84%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", duration: 763, order: 34 },
  { titleAr: "اخر مراحل التحليل الأساسي", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/4th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9%D8%A9%20-%2005%20-%20%D8%A7%D8%AE%D8%B1%20%D9%85%D8%B1%D8%A7%D8%AD%D9%84%20%D8%A7%D9%84%D8%AA%D8%AD%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D8%A7%D8%B3%D8%A7%D8%B3%D9%8A.mp4", duration: 735, order: 35 },
  { titleAr: "إدارة رأس المال و المخاطر", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/5th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%B1%D8%A3%D8%B3%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%20%D9%88%20%D8%A7%D9%84%D9%85%D8%AE%D8%A7%D8%B7%D8%B1.mp4", duration: 1127, order: 36 },
  { titleAr: "إدارة التوصيات", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/6th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AA%D9%88%D8%B5%D9%8A%D8%A7%D8%AA.mp4", duration: 755, order: 37 },
  { titleAr: "إدارة العوامل النفسية", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/7th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D8%A9%20%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D8%B9%D8%A9%20-%2001%20-%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%B9%D9%88%D8%A7%D9%85%D9%84%20%D8%A7%D9%84%D9%86%D9%81%D8%B3%D9%8A%D8%A9.mp4", duration: 889, order: 38 },
  { titleAr: "خطة التداول", videoUrl: "https://videos.xflexwithai.com/media/Courses/Trading_Course/8th_level/%D8%A7%D9%84%D9%85%D8%B1%D8%AD%D9%84%D8%A9%20%D8%A7%D9%84%D8%AB%D8%A7%D9%85%D9%86%D8%A9%20-%2001%20-%20%D8%A7%D8%B5%D9%86%D8%B9%20%D8%AE%D8%B7%D8%AA%D9%83%20%D8%A7%D9%84%D8%AE%D8%A7%D8%B5%D8%A9%20%D9%84%D9%84%D8%AA%D8%AF%D8%A7%D9%88%D9%84.mp4", duration: 159, order: 39 },
];

async function fixAllEpisodes() {
  try {
    console.log("🔧 Complete Episode Fix Script");
    console.log("================================\n");
    
    // Get the course
    const courses = await db.select().from(schema.courses).limit(1);
    if (courses.length === 0) {
      console.error("❌ No course found!");
      process.exit(1);
    }
    
    const courseId = courses[0].id;
    console.log(`✅ Found course: ${courses[0].titleEn}`);
    console.log(`📚 Course ID: ${courseId}\n`);
    
    // Delete ALL existing episodes
    console.log("🗑️  Deleting all existing episodes...");
    await db.delete(schema.episodes).where(eq(schema.episodes.courseId, courseId));
    console.log("✅ All old episodes deleted\n");
    
    // Add all 39 episodes with correct data
    console.log("🎬 Adding all 39 episodes with correct titles and durations...\n");
    for (const episode of allEpisodes) {
      await db.insert(schema.episodes).values({
        courseId,
        titleEn: episode.titleAr,
        titleAr: episode.titleAr,
        descriptionEn: "",
        descriptionAr: "",
        videoUrl: episode.videoUrl,
        duration: episode.duration,
        order: episode.order,
        isFree: false,
      });
      console.log(`  ✓ Episode ${episode.order}/39: ${episode.titleAr} (${Math.floor(episode.duration / 60)}:${(episode.duration % 60).toString().padStart(2, '0')})`);
    }
    
    console.log(`\n🎉 SUCCESS! All 39 episodes are now correct!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Old episodes: DELETED`);
    console.log(`   - New episodes: 39 (with correct titles & durations)`);
    console.log(`   - Total course duration: ${Math.floor(allEpisodes.reduce((sum, ep) => sum + ep.duration, 0) / 60)} minutes`);
    console.log(`\n✨ Your course is perfect now!`);
    console.log(`\n🔗 Next steps:`);
    console.log(`   1. Go to https://xflexwithai.com/admin/keys`);
    console.log(`   2. Generate a registration key`);
    console.log(`   3. Activate it and enjoy all 39 videos!`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    await client.end();
    process.exit(1);
  }
}

fixAllEpisodes();
