// server/routes/flexai.ts
import { Router } from 'express';
import { unifiedAuth, AuthenticatedRequest } from '../middleware/unified-auth';
import { db } from '../db';
import { 
  registrationKeys, 
  flexaiSubscriptions, 
  flexaiMessages 
} from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { OpenAIService } from '../services/openai.service';

const router = Router();

/**
 * POST /api/flexai/redeem-key
 * Activate FlexAI subscription with registration key
 * Supports both web and Telegram formats
 */
router.post('/redeem-key', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = req.body;
    const userId = req.user!.id;
    
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration key is required' 
      });
    }
    
    // Find registration key
    const registrationKey = await db.query.registrationKeys.findFirst({
      where: and(
        eq(registrationKeys.keyValue, key),
        eq(registrationKeys.used, false),
        eq(registrationKeys.isActive, true)
      )
    });
    
    if (!registrationKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Key not found or already used' 
      });
    }
    
    // Check if key is for FlexAI (not course)
    // Adjust this based on your key_type values
    if (registrationKey.keyType && registrationKey.keyType !== 'flexai_monthly') {
      return res.status(400).json({ 
        success: false, 
        error: 'This key is not for FlexAI subscription' 
      });
    }
    
    // Calculate expiry (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    // Create subscription
    const [subscription] = await db.insert(flexaiSubscriptions).values({
      userId,
      registrationKeyId: registrationKey.id,
      status: 'active',
      activatedAt: new Date(),
      expiresAt: expiryDate
    }).returning();
    
    // Mark key as used
    await db.update(registrationKeys)
      .set({ 
        used: true, 
        usedBy: userId, 
        usedAt: new Date() 
      })
      .where(eq(registrationKeys.id, registrationKey.id));
    
    // Return format compatible with both web and Telegram
    return res.json({ 
      success: true,
      message: 'FlexAI subscription activated successfully!',
      expiry_date: expiryDate.toISOString(), // For Telegram compatibility
      subscription: {
        id: subscription.id,
        expiresAt: subscription.expiresAt,
        status: subscription.status
      }
    });
    
  } catch (error: any) {
    console.error('Redeem key error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to redeem key'
    });
  }
});

/**
 * GET /api/flexai/subscription
 * Get current subscription status
 */
router.get('/subscription', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const subscription = await db.query.flexaiSubscriptions.findFirst({
      where: and(
        eq(flexaiSubscriptions.userId, userId),
        eq(flexaiSubscriptions.status, 'active')
      ),
      orderBy: [desc(flexaiSubscriptions.createdAt)]
    });
    
    if (!subscription) {
      return res.json({ active: false });
    }
    
    // Check if expired
    const now = new Date();
    if (new Date(subscription.expiresAt) < now) {
      // Mark as expired
      await db.update(flexaiSubscriptions)
        .set({ status: 'expired' })
        .where(eq(flexaiSubscriptions.id, subscription.id));
      
      return res.json({ active: false, expired: true });
    }
    
    return res.json({ 
      active: true, 
      subscription: {
        id: subscription.id,
        expiresAt: subscription.expiresAt,
        status: subscription.status
      }
    });
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/flexai/analyze
 * Analyze trading chart image
 * Supports both web and Telegram formats
 */
router.post('/analyze', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // Support both naming conventions (web and Telegram)
    const imageUrl = req.body.imageUrl || req.body.image_url;
    const analysisType = req.body.analysisType || req.body.action_type || 'first_analysis';
    const timeframe = req.body.timeframe || 'M15';
    const userAnalysis = req.body.userAnalysis || req.body.user_analysis;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'صورة غير صالحة' // Arabic for Telegram compatibility
      });
    }
    
    // Check subscription
    const subscription = await db.query.flexaiSubscriptions.findFirst({
      where: and(
        eq(flexaiSubscriptions.userId, userId),
        eq(flexaiSubscriptions.status, 'active')
      ),
      orderBy: [desc(flexaiSubscriptions.createdAt)]
    });
    
    if (!subscription) {
      return res.status(403).json({ 
        success: false,
        code: 'not_registered',
        message: 'Your account is not registered. Please activate FlexAI subscription.'
      });
    }
    
    // Check expiry
    if (new Date(subscription.expiresAt) < new Date()) {
      // Mark as expired
      await db.update(flexaiSubscriptions)
        .set({ status: 'expired' })
        .where(eq(flexaiSubscriptions.id, subscription.id));
      
      return res.status(403).json({ 
        success: false,
        code: 'expired',
        message: 'Your subscription has expired. Please renew.'
      });
    }
    
    // Perform analysis
    const analysis = await OpenAIService.analyzeChart(
      imageUrl,
      analysisType as any,
      timeframe,
      userAnalysis
    );
    
    // Save user message
    await db.insert(flexaiMessages).values({
      userId,
      subscriptionId: subscription.id,
      role: 'user',
      content: `Chart analysis request - ${analysisType}`,
      imageUrl,
      analysisType,
      timeframe
    });
    
    // Save assistant response
    await db.insert(flexaiMessages).values({
      userId,
      subscriptionId: subscription.id,
      role: 'assistant',
      content: analysis,
      analysisResult: {
        analysisType,
        timeframe,
        timestamp: new Date().toISOString()
      },
      analysisType,
      timeframe
    });
    
    // Determine next action
    const nextAction = analysisType === 'first_analysis' ? 'second_analysis' :
                      analysisType === 'second_analysis' ? 'user_analysis' : undefined;
    
    const nextPrompt = analysisType === 'first_analysis' ? 'الآن أرسل صورة الإطار الزمني الثاني (H4)' :
                      analysisType === 'second_analysis' ? 'يمكنك الآن إرسال تحليلك الشخصي للمراجعة' : undefined;
    
    // Return format compatible with both web and Telegram
    return res.json({ 
      success: true,
      message: `✅ تم تحليل ${timeframe} بنجاح`,
      analysis,
      next_action: nextAction,
      next_prompt: nextPrompt
    });
    
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خدمة الذكاء الاصطناعي غير متوفرة',
      analysis: error.message
    });
  }
});

/**
 * GET /api/flexai/history
 * Get chat history
 */
router.get('/history', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const history = await db.query.flexaiMessages.findMany({
      where: eq(flexaiMessages.userId, userId),
      orderBy: [desc(flexaiMessages.createdAt)],
      limit
    });
    
    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/flexai
 * Health check
 */
router.get('/', (req, res) => {
  const openaiAvailable = !!process.env.OPENAI_API_KEY;
  const status = openaiAvailable ? "✅" : "❌";
  res.send(`FlexAI API is running ${status} - OpenAI: ${openaiAvailable ? 'Available' : 'Not configured'}`);
});

export default router;
