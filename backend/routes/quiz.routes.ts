import { Router } from "express";
import { quizService } from "../services/quiz.service";

const router = Router();

/**
 * GET /api/quiz/progress
 * Get user's progress across all quiz levels
 */
router.get("/progress", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const progress = await quizService.getUserProgress(req.session.userId);
    res.json(progress);
  } catch (error) {
    console.error("Error getting quiz progress:", error);
    res.status(500).json({ error: "Failed to get quiz progress" });
  }
});

/**
 * GET /api/quiz/level/:level
 * Get quiz questions for a specific level
 */
router.get("/level/:level", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const level = parseInt(req.params.level);
    
    if (isNaN(level) || level < 1 || level > 8) {
      return res.status(400).json({ error: "Invalid level" });
    }

    // Check if user can access this level
    const canAccess = await quizService.canAccessLevel(req.session.userId, level);
    if (!canAccess) {
      return res.status(403).json({ 
        error: "Level locked",
        message: "Complete the previous level first"
      });
    }

    const quiz = await quizService.getQuizByLevel(level);
    res.json(quiz);
  } catch (error) {
    console.error("Error getting quiz:", error);
    res.status(500).json({ error: "Failed to get quiz" });
  }
});

/**
 * POST /api/quiz/submit
 * Submit quiz answers and get results
 */
router.post("/submit", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { quizId, answers } = req.body;

    if (!quizId || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Validate answers format
    for (const answer of answers) {
      if (!answer.questionId || !answer.optionId) {
        return res.status(400).json({ error: "Invalid answer format" });
      }
    }

    const result = await quizService.submitQuiz(
      req.session.userId,
      quizId,
      answers
    );

    res.json(result);
  } catch (error) {
    console.error("Error submitting quiz:", error);
    res.status(500).json({ error: "Failed to submit quiz" });
  }
});

/**
 * GET /api/quiz/history/:level
 * Get user's attempt history for a specific level
 */
router.get("/history/:level", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const level = parseInt(req.params.level);
    
    if (isNaN(level) || level < 1 || level > 8) {
      return res.status(400).json({ error: "Invalid level" });
    }

    const history = await quizService.getQuizHistory(req.session.userId, level);
    res.json(history);
  } catch (error) {
    console.error("Error getting quiz history:", error);
    res.status(500).json({ error: "Failed to get quiz history" });
  }
});

/**
 * POST /api/quiz/initialize
 * Initialize quiz progress for new user (unlock Level 1)
 */
router.post("/initialize", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await quizService.initializeUserProgress(req.session.userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error initializing quiz progress:", error);
    res.status(500).json({ error: "Failed to initialize quiz progress" });
  }
});

/**
 * GET /api/quiz/attempt/:attemptId
 * Get detailed results of a specific attempt
 */
router.get("/attempt/:attemptId", async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const attemptId = parseInt(req.params.attemptId);
    
    if (isNaN(attemptId)) {
      return res.status(400).json({ error: "Invalid attempt ID" });
    }

    // TODO: Implement getAttemptDetails in service
    // For now, return basic info
    res.json({ message: "Attempt details endpoint - to be implemented" });
  } catch (error) {
    console.error("Error getting attempt details:", error);
    res.status(500).json({ error: "Failed to get attempt details" });
  }
});

export default router;
