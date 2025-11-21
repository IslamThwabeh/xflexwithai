import { Router } from "express";
import { db } from "../../db";
import { 
  quizzes, questions, options, userQuizProgress, 
  quizAttempts, users 
} from "../../db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

const router = Router();

// GET /api/admin/quiz/stats - Get comprehensive quiz statistics
router.get("/stats", async (req, res) => {
  try {
    // Total attempts
    const totalAttemptsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizAttempts);
    const totalAttempts = Number(totalAttemptsResult[0]?.count || 0);

    // Total users who have attempted quizzes
    const totalUsersResult = await db
      .select({ count: sql<number>`count(DISTINCT user_id)` })
      .from(quizAttempts);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    // Average score across all attempts
    const avgScoreResult = await db
      .select({ avg: sql<number>`AVG(score)` })
      .from(quizAttempts);
    const averageScore = Math.round(Number(avgScoreResult[0]?.avg || 0));

    // Pass rate (attempts with score >= 50)
    const passedAttemptsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizAttempts)
      .where(sql`score >= 50`);
    const passedAttempts = Number(passedAttemptsResult[0]?.count || 0);
    const passRate = totalAttempts > 0 
      ? Math.round((passedAttempts / totalAttempts) * 100) 
      : 0;

    // Level statistics
    const allQuizzes = await db.select().from(quizzes).orderBy(quizzes.level);
    
    const levelStats = await Promise.all(
      allQuizzes.map(async (quiz) => {
        // Attempts for this level
        const levelAttemptsResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizId, quiz.id));
        const attempts = Number(levelAttemptsResult[0]?.count || 0);

        // Average score for this level
        const levelAvgResult = await db
          .select({ avg: sql<number>`AVG(score)` })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizId, quiz.id));
        const avgScore = Math.round(Number(levelAvgResult[0]?.avg || 0));

        // Pass rate for this level
        const levelPassedResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(quizAttempts)
          .where(and(
            eq(quizAttempts.quizId, quiz.id),
            sql`score >= 50`
          ));
        const passed = Number(levelPassedResult[0]?.count || 0);
        const levelPassRate = attempts > 0 
          ? Math.round((passed / attempts) * 100) 
          : 0;

        // Completion rate (users who unlocked this level)
        const unlockedUsersResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(userQuizProgress)
          .where(sql`${quiz.level} = ANY(unlocked_levels)`);
        const unlockedUsers = Number(unlockedUsersResult[0]?.count || 0);
        const completionRate = totalUsers > 0 
          ? Math.round((unlockedUsers / totalUsers) * 100) 
          : 0;

        return {
          level: quiz.level,
          title: quiz.title,
          attempts,
          avgScore,
          passRate: levelPassRate,
          completionRate,
        };
      })
    );

    // Difficult questions (lowest correct rate)
    // We need to calculate correct rate per question from quiz attempts
    const allQuestions = await db
      .select({
        id: questions.id,
        text: questions.questionText,
        quizId: questions.quizId,
      })
      .from(questions);

    const questionStats = await Promise.all(
      allQuestions.map(async (q) => {
        // Get all attempts for this quiz
        const attempts = await db
          .select({
            selectedOptions: quizAttempts.selectedOptions,
          })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizId, q.quizId));

        // Get correct option for this question
        const correctOption = await db
          .select({ id: options.id })
          .from(options)
          .where(and(
            eq(options.questionId, q.id),
            eq(options.isCorrect, true)
          ))
          .limit(1);

        if (!correctOption.length || !attempts.length) {
          return null;
        }

        const correctOptionId = correctOption[0].id;
        let correctCount = 0;

        // Check each attempt
        attempts.forEach((attempt) => {
          const selected = attempt.selectedOptions as Record<string, number>;
          if (selected[q.id.toString()] === correctOptionId) {
            correctCount++;
          }
        });

        const correctRate = Math.round((correctCount / attempts.length) * 100);

        return {
          questionId: q.id,
          questionText: q.text,
          quizId: q.quizId,
          correctRate,
          totalAttempts: attempts.length,
        };
      })
    );

    // Filter out nulls and get quiz level for each question
    const validQuestionStats = questionStats.filter((q) => q !== null);
    
    const difficultQuestions = await Promise.all(
      validQuestionStats
        .sort((a, b) => a!.correctRate - b!.correctRate)
        .slice(0, 5)
        .map(async (q) => {
          const quiz = await db
            .select({ level: quizzes.level })
            .from(quizzes)
            .where(eq(quizzes.id, q!.quizId))
            .limit(1);

          return {
            questionId: q!.questionId,
            questionText: q!.questionText,
            level: quiz[0]?.level || 0,
            correctRate: q!.correctRate,
            totalAttempts: q!.totalAttempts,
          };
        })
    );

    // Recent activity
    const recentActivity = await db
      .select({
        userId: quizAttempts.userId,
        username: users.username,
        level: quizzes.level,
        score: quizAttempts.score,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .innerJoin(users, eq(quizAttempts.userId, users.id))
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .orderBy(desc(quizAttempts.completedAt))
      .limit(10);

    const formattedActivity = recentActivity.map((a) => ({
      userId: a.userId,
      username: a.username,
      level: a.level,
      score: a.score,
      passed: a.score >= 50,
      completedAt: a.completedAt.toISOString(),
    }));

    res.json({
      totalAttempts,
      totalUsers,
      averageScore,
      passRate,
      levelStats,
      difficultQuestions,
      recentActivity: formattedActivity,
    });
  } catch (error) {
    console.error("Error fetching quiz stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// GET /api/admin/quiz/users - Get all users with their quiz progress
router.get("/users", async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users);

    const userProgressData = await Promise.all(
      allUsers.map(async (user) => {
        // Get progress
        const progress = await db
          .select()
          .from(userQuizProgress)
          .where(eq(userQuizProgress.userId, user.id))
          .limit(1);

        const userProgress = progress[0];

        // Get all attempts
        const attempts = await db
          .select({
            quizId: quizAttempts.quizId,
            score: quizAttempts.score,
            completedAt: quizAttempts.completedAt,
          })
          .from(quizAttempts)
          .where(eq(quizAttempts.userId, user.id))
          .orderBy(desc(quizAttempts.completedAt));

        // Calculate best scores per level
        const bestScores: Record<number, number> = {};
        const quizLevelMap: Record<number, number> = {};

        // Get quiz levels
        const allQuizzes = await db.select().from(quizzes);
        allQuizzes.forEach((q) => {
          quizLevelMap[q.id] = q.level;
        });

        attempts.forEach((attempt) => {
          const level = quizLevelMap[attempt.quizId];
          if (level) {
            if (!bestScores[level] || attempt.score > bestScores[level]) {
              bestScores[level] = attempt.score;
            }
          }
        });

        // Count completed levels (score >= 50)
        const completedLevels = Object.values(bestScores).filter(
          (score) => score >= 50
        ).length;

        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          totalAttempts: attempts.length,
          completedLevels,
          bestScores,
          unlockedLevels: userProgress?.unlockedLevels || [1],
          lastActivity: attempts[0]?.completedAt?.toISOString() || null,
        };
      })
    );

    res.json(userProgressData);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/quiz/reset-user-progress - Reset a user's quiz progress
router.post("/reset-user-progress", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Delete all quiz attempts
    await db.delete(quizAttempts).where(eq(quizAttempts.userId, userId));

    // Reset progress to level 1 only
    await db
      .update(userQuizProgress)
      .set({ unlockedLevels: [1] })
      .where(eq(userQuizProgress.userId, userId));

    res.json({ message: "User progress reset successfully" });
  } catch (error) {
    console.error("Error resetting user progress:", error);
    res.status(500).json({ error: "Failed to reset progress" });
  }
});

// GET /api/admin/quiz/questions - Get all questions with options
router.get("/questions", async (req, res) => {
  try {
    const allQuizzes = await db
      .select()
      .from(quizzes)
      .orderBy(quizzes.level);

    const quizzesWithQuestions = await Promise.all(
      allQuizzes.map(async (quiz) => {
        const quizQuestions = await db
          .select()
          .from(questions)
          .where(eq(questions.quizId, quiz.id))
          .orderBy(questions.id);

        const questionsWithOptions = await Promise.all(
          quizQuestions.map(async (question) => {
            const questionOptions = await db
              .select()
              .from(options)
              .where(eq(options.questionId, question.id))
              .orderBy(options.id);

            // Calculate question stats
            const attempts = await db
              .select({
                selectedOptions: quizAttempts.selectedOptions,
              })
              .from(quizAttempts)
              .where(eq(quizAttempts.quizId, quiz.id));

            const correctOption = questionOptions.find((o) => o.isCorrect);
            let correctCount = 0;

            if (correctOption && attempts.length > 0) {
              attempts.forEach((attempt) => {
                const selected = attempt.selectedOptions as Record<string, number>;
                if (selected[question.id.toString()] === correctOption.id) {
                  correctCount++;
                }
              });
            }

            const correctRate = attempts.length > 0
              ? Math.round((correctCount / attempts.length) * 100)
              : undefined;

            return {
              id: question.id,
              quizId: question.quizId,
              level: quiz.level,
              questionText: question.questionText,
              options: questionOptions.map((opt) => ({
                id: opt.id,
                optionText: opt.optionText,
                isCorrect: opt.isCorrect,
              })),
              correctRate,
              totalAttempts: attempts.length,
            };
          })
        );

        return {
          id: quiz.id,
          level: quiz.level,
          title: quiz.title,
          questions: questionsWithOptions,
        };
      })
    );

    res.json(quizzesWithQuestions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

// PUT /api/admin/quiz/questions/:id - Update a question and its options
router.put("/questions/:id", async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    const { questionText, options: updatedOptions } = req.body;

    if (!questionText || !updatedOptions || !Array.isArray(updatedOptions)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // Validate at least one correct answer
    const hasCorrect = updatedOptions.some((opt) => opt.isCorrect);
    if (!hasCorrect) {
      return res.status(400).json({ error: "At least one option must be correct" });
    }

    // Update question text
    await db
      .update(questions)
      .set({ questionText })
      .where(eq(questions.id, questionId));

    // Update each option
    for (const option of updatedOptions) {
      await db
        .update(options)
        .set({
          optionText: option.optionText,
          isCorrect: option.isCorrect,
        })
        .where(eq(options.id, option.id));
    }

    res.json({ message: "Question updated successfully" });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ error: "Failed to update question" });
  }
});

export default router;
