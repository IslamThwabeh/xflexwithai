import { db } from "../db";
import { 
  quizzes, 
  quizQuestions, 
  quizOptions, 
  quizAttempts, 
  quizAnswers,
  userQuizProgress 
} from "../database/schema-sqlite.ts";
import { eq, and, desc } from "drizzle-orm";

export class QuizService {
  /**
   * Get quiz by level with all questions and options
   */
  async getQuizByLevel(level: number) {
    const dbInstance = await db();
    
    // Get quiz
    const quiz = await dbInstance
      .select()
      .from(quizzes)
      .where(eq(quizzes.level, level))
      .limit(1);

    if (!quiz.length) {
      throw new Error(`Quiz not found for level ${level}`);
    }

    // Get questions
    const questions = await dbInstance
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quiz[0].id))
      .orderBy(quizQuestions.orderNum);

    // Get all options for these questions
    const questionIds = questions.map(q => q.id);
    const options = await dbInstance
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, questionIds[0])); // Will get all via IN clause

    // Group options by question
    const questionsWithOptions = questions.map(question => {
      const questionOptions = options.filter(opt => opt.questionId === question.id);
      return {
        ...question,
        options: questionOptions.map(opt => ({
          id: opt.id,
          optionId: opt.optionId,
          text: opt.optionText,
          // Don't send isCorrect to client!
        }))
      };
    });

    return {
      ...quiz[0],
      questions: questionsWithOptions
    };
  }

  /**
   * Check if user can access a quiz level
   */
  async canAccessLevel(userId: number, level: number): Promise<boolean> {
    // Level 1 is always accessible
    if (level === 1) return true;

    const dbInstance = await db();

    // Check if previous level is completed with passing score
    const previousLevel = level - 1;
    const progress = await dbInstance
      .select()
      .from(userQuizProgress)
      .where(
        and(
          eq(userQuizProgress.userId, userId),
          eq(userQuizProgress.level, previousLevel)
        )
      )
      .limit(1);

    if (!progress.length) return false;

    return progress[0].isUnlocked && progress[0].isPassed;
  }

  /**
   * Submit quiz attempt and calculate score
   */
  async submitQuiz(userId: number, quizId: number, answers: { questionId: number; optionId: string }[]) {
    const dbInstance = await db();

    // Get quiz info
    const quiz = await dbInstance
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .limit(1);

    if (!quiz.length) {
      throw new Error("Quiz not found");
    }

    // Get all questions and correct answers
    const questions = await dbInstance
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    const questionIds = questions.map(q => q.id);
    const allOptions = await dbInstance
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, questionIds[0])); // Get all via IN

    // Calculate score
    let correctCount = 0;
    const detailedResults = answers.map(answer => {
      const correctOption = allOptions.find(
        opt => opt.questionId === answer.questionId && opt.isCorrect
      );
      const isCorrect = correctOption?.optionId === answer.optionId;
      if (isCorrect) correctCount++;

      return {
        questionId: answer.questionId,
        selectedOptionId: answer.optionId,
        correctOptionId: correctOption?.optionId,
        isCorrect
      };
    });

    const totalQuestions = questions.length;
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
    const passed = scorePercentage >= quiz[0].passingScore;

    // Create attempt record
    const [attempt] = await dbInstance
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        score: scorePercentage,
        passed,
        completedAt: new Date()
      })
      .returning();

    // Save individual answers
    await dbInstance.insert(quizAnswers).values(
      answers.map(answer => ({
        attemptId: attempt.id,
        questionId: answer.questionId,
        selectedOptionId: answer.optionId,
        isCorrect: detailedResults.find(r => r.questionId === answer.questionId)?.isCorrect || false
      }))
    );

    // Update user progress
    const existingProgress = await dbInstance
      .select()
      .from(userQuizProgress)
      .where(
        and(
          eq(userQuizProgress.userId, userId),
          eq(userQuizProgress.level, quiz[0].level)
        )
      )
      .limit(1);

    if (existingProgress.length) {
      // Update existing progress
      await dbInstance
        .update(userQuizProgress)
        .set({
          isPassed: passed || existingProgress[0].isPassed, // Once passed, always passed
          bestScore: Math.max(scorePercentage, existingProgress[0].bestScore || 0),
          lastAttemptAt: new Date()
        })
        .where(eq(userQuizProgress.id, existingProgress[0].id));
    } else {
      // Create new progress record
      await dbInstance.insert(userQuizProgress).values({
        userId,
        level: quiz[0].level,
        isUnlocked: true,
        isPassed: passed,
        bestScore: scorePercentage,
        lastAttemptAt: new Date()
      });
    }

    // If passed, unlock next level
    if (passed) {
      const nextLevel = quiz[0].level + 1;
      const nextQuiz = await dbInstance
        .select()
        .from(quizzes)
        .where(eq(quizzes.level, nextLevel))
        .limit(1);

      if (nextQuiz.length) {
        const nextProgress = await dbInstance
          .select()
          .from(userQuizProgress)
          .where(
            and(
              eq(userQuizProgress.userId, userId),
              eq(userQuizProgress.level, nextLevel)
            )
          )
          .limit(1);

        if (!nextProgress.length) {
          await dbInstance.insert(userQuizProgress).values({
            userId,
            level: nextLevel,
            isUnlocked: true,
            isPassed: false,
            bestScore: 0
          });
        } else if (!nextProgress[0].isUnlocked) {
          await dbInstance
            .update(userQuizProgress)
            .set({ isUnlocked: true })
            .where(eq(userQuizProgress.id, nextProgress[0].id));
        }
      }
    }

    return {
      attemptId: attempt.id,
      score: scorePercentage,
      passed,
      correctCount,
      totalQuestions,
      passingScore: quiz[0].passingScore,
      detailedResults
    };
  }

  /**
   * Get user's quiz progress for all levels
   */
  async getUserProgress(userId: number) {
    const dbInstance = await db();

    // Get all quizzes
    const allQuizzes = await dbInstance
      .select()
      .from(quizzes)
      .orderBy(quizzes.level);

    // Get user progress
    const progress = await dbInstance
      .select()
      .from(userQuizProgress)
      .where(eq(userQuizProgress.userId, userId));

    // Combine data
    const result = allQuizzes.map(quiz => {
      const userProgress = progress.find(p => p.level === quiz.level);
      
      return {
        level: quiz.level,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        isUnlocked: userProgress?.isUnlocked || quiz.level === 1, // Level 1 always unlocked
        isPassed: userProgress?.isPassed || false,
        bestScore: userProgress?.bestScore || 0,
        lastAttemptAt: userProgress?.lastAttemptAt
      };
    });

    return result;
  }

  /**
   * Get user's quiz attempt history for a specific level
   */
  async getQuizHistory(userId: number, level: number) {
    const dbInstance = await db();

    // Get quiz
    const quiz = await dbInstance
      .select()
      .from(quizzes)
      .where(eq(quizzes.level, level))
      .limit(1);

    if (!quiz.length) {
      throw new Error("Quiz not found");
    }

    // Get attempts
    const attempts = await dbInstance
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.quizId, quiz[0].id)
        )
      )
      .orderBy(desc(quizAttempts.completedAt));

    return attempts;
  }

  /**
   * Initialize Level 1 access for new user
   */
  async initializeUserProgress(userId: number) {
    const dbInstance = await db();

    // Check if already initialized
    const existing = await dbInstance
      .select()
      .from(userQuizProgress)
      .where(
        and(
          eq(userQuizProgress.userId, userId),
          eq(userQuizProgress.level, 1)
        )
      )
      .limit(1);

    if (existing.length) return;

    // Unlock Level 1
    await dbInstance.insert(userQuizProgress).values({
      userId,
      level: 1,
      isUnlocked: true,
      isPassed: false,
      bestScore: 0
    });
  }
}

export const quizService = new QuizService();
