#!/usr/bin/env tsx
/**
 * Seed courses and episodes into the database
 * Usage: npx tsx scripts/seed-courses.ts
 */

// Sample courses and episodes data
const SAMPLE_COURSES = [
  {
    id: 1,
    titleEn: "Forex Trading Fundamentals",
    titleAr: "أساسيات تداول الفوركس",
    descriptionEn: "Learn the basics of forex trading and currency markets",
    descriptionAr: "تعلم أساسيات تداول الفوركس والعملات",
    level: "beginner",
    price: 29.99,
    isPublished: true,
    episodes: [
      {
        orderIndex: 1,
        titleEn: "What is Forex?",
        titleAr: "ما هو الفوركس؟",
        descriptionEn: "Introduction to the forex market",
        descriptionAr: "مقدمة إلى سوق الفوركس",
        duration: 15,
      },
      {
        orderIndex: 2,
        titleEn: "Understanding Currency Pairs",
        titleAr: "فهم أزواج العملات",
        descriptionEn: "Learn how currency pairs work",
        descriptionAr: "تعلم كيفية عمل أزواج العملات",
        duration: 20,
      },
      {
        orderIndex: 3,
        titleEn: "Pips and Spreads",
        titleAr: "نقاط الضي والفوارق",
        descriptionEn: "Master pips and spreads in forex",
        descriptionAr: "احترف نقاط الضي والفوارق في الفوركس",
        duration: 18,
      },
    ],
  },
  {
    id: 2,
    titleEn: "Technical Analysis for Traders",
    titleAr: "التحليل الفني للمتداولين",
    descriptionEn: "Master technical analysis and chart patterns",
    descriptionAr: "احترف التحليل الفني وأنماط الرسوم البيانية",
    level: "intermediate",
    price: 49.99,
    isPublished: true,
    episodes: [
      {
        orderIndex: 1,
        titleEn: "Reading Charts",
        titleAr: "قراءة الرسوم البيانية",
        descriptionEn: "Learn to read and interpret price charts",
        descriptionAr: "تعلم قراءة وتفسير رسوم الأسعار",
        duration: 25,
      },
      {
        orderIndex: 2,
        titleEn: "Support and Resistance",
        titleAr: "الدعم والمقاومة",
        descriptionEn: "Identify support and resistance levels",
        descriptionAr: "تحديد مستويات الدعم والمقاومة",
        duration: 22,
      },
      {
        orderIndex: 3,
        titleEn: "Candlestick Patterns",
        titleAr: "أنماط الشموع",
        descriptionEn: "Learn powerful candlestick patterns",
        descriptionAr: "تعلم أنماط الشموع القوية",
        duration: 30,
      },
    ],
  },
  {
    id: 3,
    titleEn: "Advanced Trading Strategies",
    titleAr: "استراتيجيات التداول المتقدمة",
    descriptionEn: "Develop professional trading strategies",
    descriptionAr: "تطوير استراتيجيات تداول احترافية",
    level: "advanced",
    price: 79.99,
    isPublished: false,
    episodes: [
      {
        orderIndex: 1,
        titleEn: "Risk Management",
        titleAr: "إدارة المخاطر",
        descriptionEn: "Learn professional risk management",
        descriptionAr: "تعلم إدارة المخاطر الاحترافية",
        duration: 28,
      },
    ],
  },
];

function generateInsertStatements() {
  console.log("📋 Database Seeding Script");
  console.log("=".repeat(60));
  console.log("\n⚠️  This script generates SQL INSERT statements.");
  console.log("Copy and paste them into your Cloudflare D1 dashboard.\n");

  console.log("-- ============================================");
  console.log("-- Insert Sample Courses");
  console.log("-- ============================================\n");

  // Insert courses
  SAMPLE_COURSES.forEach((course) => {
    console.log(`INSERT INTO courses (id, title, description, price, currency, level, isPublished, createdAt, updatedAt)`);
    console.log(`VALUES (`);
    console.log(`  ${course.id},`);
    console.log(`  '${course.titleEn}',`);
    console.log(`  '${course.descriptionEn}',`);
    console.log(`  ${course.price},`);
    console.log(`  'USD',`);
    console.log(`  '${course.level}',`);
    console.log(`  ${course.isPublished ? 1 : 0},`);
    console.log(`  datetime('now'),`);
    console.log(`  datetime('now')`);
    console.log(`);`);
    console.log();
  });

  console.log("\n-- ============================================");
  console.log("-- Insert Sample Episodes");
  console.log("-- ============================================\n");

  // Insert episodes
  SAMPLE_COURSES.forEach((course) => {
    course.episodes.forEach((episode, index) => {
      const episodeId = `${course.id}${index + 1}`;
      console.log(`INSERT INTO episodes (courseId, title, description, duration, orderIndex, createdAt, updatedAt)`);
      console.log(`VALUES (`);
      console.log(`  ${course.id},`);
      console.log(`  '${episode.titleEn}',`);
      console.log(`  '${episode.descriptionEn}',`);
      console.log(`  ${episode.duration},`);
      console.log(`  ${episode.orderIndex},`);
      console.log(`  datetime('now'),`);
      console.log(`  datetime('now')`);
      console.log(`);`);
      console.log();
    });
  });

  console.log("\n-- ============================================");
  console.log("-- Summary");
  console.log("-- ============================================");
  console.log(`-- Total Courses: ${SAMPLE_COURSES.length}`);
  console.log(`-- Total Episodes: ${SAMPLE_COURSES.reduce((sum, c) => sum + c.episodes.length, 0)}`);
  console.log(
    `-- Published Courses: ${SAMPLE_COURSES.filter((c) => c.isPublished).length}`
  );
}

// Generate and output SQL
generateInsertStatements();

console.log("\n\n✅ SQL statements generated above!");
console.log("📌 Steps to seed your database:\n");
console.log("1. Go to: https://dash.cloudflare.com/");
console.log("2. Select your account → Workers & Pages");
console.log("3. Go to D1 (below Functions)");
console.log("4. Select your database (xflexwithai)");
console.log("5. Open the SQL console");
console.log("6. Copy and paste the INSERT statements above");
console.log("7. Press Execute\n");
