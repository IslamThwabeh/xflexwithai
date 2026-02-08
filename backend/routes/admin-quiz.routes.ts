import { Router } from "express";
import { db } from "../db";
import { 
  quizzes, 
  quizQuestions,
  quizAttempts,
  userQuizProgress,
  users
} from "../database/schema-sqlite.ts";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  if (!req.session?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
};

router.use(requireAdmin);

/**
 * GET /api/admin/quiz/stats
 * Get overall quiz statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const dbInstance = await db();

    // Get total attempts
    const totalAttempts = await dbInstance
      .select({ count: sql<number>`count(*)` })
      .from(quizAttempts);

    // Get pass rate
    const passedAttempts = await dbInstance
      .select({ count: sql<number>`count(*)` })
      .from(quizAttempts)
      .where(eq(quizAttempts.passed, true));

    // Get average scores by level
    const avgScoresByLevel = await dbInstance
      .select({
        level: quizzes.level,
        title: quizzes.title,
        avgScore: sql<number>`avg(${quizAttempts.score})`,
        totalAttempts: sql<number>`count(${quizAttempts.id})`,
        passedAttempts: sql<number>`sum(case when ${quizAttempts.passed} then 1 else 0 end)`
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .groupBy(quizzes.level, quizzes.title)
      .orderBy(quizzes.level);

    // Get completion rate by level
    const totalUsers = await dbInstance
      .select({ count: sql<number>`count(distinct ${users.id})` })
      .from(users);

    const completionByLevel = await dbInstance
      .select({
        level: userQuizProgress.level,
        completedUsers: sql<number>`count(distinct ${userQuizProgress.userId})`
      })
      .from(userQuizProgress)
      .where(eq(userQuizProgress.isPassed, true))
      .groupBy(userQuizProgress.level)
      .orderBy(userQuizProgress.level);

    res.json({
      totalAttempts: totalAttempts[0]?.count || 0,
      passedAttempts: passedAttempts[0]?.count || 0,
      passRate: totalAttempts[0]?.count 
        ? Math.round((passedAttempts[0]?.count / totalAttempts[0]?.count) * 100)
        : 0,
      totalUsers: totalUsers[0]?.count || 0,
      avgScoresByLevel,
      completionByLevel
    });
  } catch (error) {
    console.error("Error getting quiz stats:", error);
    res.status(500).json({ error: "Failed to get quiz statistics" });
  }
});

/**
 * GET /api/admin/quiz/users
 * Get all users' quiz progress
 */
router.get("/users", async (req, res) => {
  try {
    const dbInstance = await db();

    const usersProgress = await dbInstance
      .select({
        userId: users.id,
        username: users.username,
        email: users.email,
        level: userQuizProgress.level,
        isPassed: userQuizProgress.isPassed,
        bestScore: userQuizProgress.bestScore,
        lastAttemptAt: userQuizProgress.lastAttemptAt
      })
      .from(users)
      .leftJoin(userQuizProgress, eq(users.id, userQuizProgress.userId))
      .orderBy(users.username, userQuizProgress.level);

    // Group by user
    const groupedByUser = usersProgress.reduce((acc: any, row) => {
      if (!acc[row.userId]) {
        acc[row.userId] = {
          userId: row.userId,
          username: row.username,
          email: row.email,
          progress: []
        };
      }
      
      if (row.level) {
        acc[row.userId].progress.push({
          level: row.level,
          isPassed: row.isPassed,
          bestScore: row.bestScore,
          lastAttemptAt: row.lastAttemptAt
        });
      }
      
      return acc;
    }, {});

    res.json(Object.values(groupedByUser));
  } catch (error) {
    console.error("Error getting users progress:", error);
    res.status(500).json({ error: "Failed to get users progress" });
  }
});

/**
 * GET /api/admin/quiz/user/:userId
 * Get detailed progress for a specific user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const dbInstance = await db();

    // Get user info
    const user = await dbInstance
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get progress
    const progress = await dbInstance
      .select({
        level: userQuizProgress.level,
        title: quizzes.title,
        isUnlocked: userQuizProgress.isUnlocked,
        isPassed: userQuizProgress.isPassed,
        bestScore: userQuizProgress.bestScore,
        lastAttemptAt: userQuizProgress.lastAttemptAt
      })
      .from(userQuizProgress)
      .innerJoin(quizzes, eq(userQuizProgress.level, quizzes.level))
      .where(eq(userQuizProgress.userId, userId))
      .orderBy(userQuizProgress.level);

    // Get recent attempts
    const recentAttempts = await dbInstance
      .select({
        attemptId: quizAttempts.id,
        level: quizzes.level,
        title: quizzes.title,
        score: quizAttempts.score,
        passed: quizAttempts.passed,
        completedAt: quizAttempts.completedAt
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.completedAt))
      .limit(20);

    res.json({
      user: {
        id: user[0].id,
        username: user[0].username,
        email: user[0].email
      },
      progress,
      recentAttempts
    });
  } catch (error) {
    console.error("Error getting user quiz details:", error);
    res.status(500).json({ error: "Failed to get user quiz details" });
  }
});

/**
 * POST /api/admin/quiz/reset-user-progress
 * Reset a user's quiz progress (for testing or special cases)
 */
router.post("/reset-user-progress", async (req, res) => {
  try {
    const { userId, level } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const dbInstance = await db();

    if (level) {
      // Reset specific level
      await dbInstance
        .delete(userQuizProgress)
        .where(
          sql`${userQuizProgress.userId} = ${userId} AND ${userQuizProgress.level} = ${level}`
        );
    } else {
      // Reset all progress for user
      await dbInstance
        .delete(userQuizProgress)
        .where(eq(userQuizProgress.userId, userId));
      
      // Re-initialize Level 1
      await dbInstance.insert(userQuizProgress).values({
        userId,
        level: 1,
        isUnlocked: true,
        isPassed: false,
        bestScore: 0
      });
    }

    res.json({ success: true, message: "Progress reset successfully" });
  } catch (error) {
    console.error("Error resetting user progress:", error);
    res.status(500).json({ error: "Failed to reset user progress" });
  }
});

/**
 * GET /api/admin/quiz/difficult-questions
 * Get questions with lowest success rates
 */
router.get("/difficult-questions", async (req, res) => {
  try {
    const dbInstance = await db();

    const questionStats = await dbInstance
      .select({
        questionId: quizQuestions.id,
        questionText: quizQuestions.questionText,
        level: quizzes.level,
        title: quizzes.title,
        totalAnswers: sql<number>`count(*)`,
        correctAnswers: sql<number>`sum(case when ${sql`is_correct`} then 1 else 0 end)`,
        successRate: sql<number>`round(avg(case when ${sql`is_correct`} then 100 else 0 end), 2)`
      })
      .from(sql`quiz_answers`)
      .innerJoin(quizQuestions, sql`quiz_answers.question_id = ${quizQuestions.id}`)
      .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
      .groupBy(quizQuestions.id, quizQuestions.questionText, quizzes.level, quizzes.title)
      .orderBy(sql`success_rate ASC`)
      .limit(20);

    res.json(questionStats);
  } catch (error) {
    console.error("Error getting difficult questions:", error);
    res.status(500).json({ error: "Failed to get difficult questions" });
  }
});

export default router;
