// server/routes/flexai.ts
import { Router } from 'express';
import { unifiedAuth, AuthenticatedRequest } from '../middleware/unified-auth';
import * as dbFunctions from '../db';
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
    
    const db = await dbFunctions.db();
    
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
 * Get current user's FlexAI subscription status
 */
router.get('/subscription', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const db = await dbFunctions.db();
    
    const subscription = await db.query.flexaiSubscriptions.findFirst({
      where: and(
        eq(flexaiSubscriptions.userId, userId),
        eq(flexaiSubscriptions.status, 'active')
      ),
      orderBy: [desc(flexaiSubscriptions.activatedAt)]
    });
    
    if (!subscription) {
      return res.json({ 
        hasSubscription: false,
        message: 'No active subscription found'
      });
    }
    
    // Check if expired
    if (new Date() > new Date(subscription.expiresAt)) {
      await db.update(flexaiSubscriptions)
        .set({ status: 'expired' })
        .where(eq(flexaiSubscriptions.id, subscription.id));
      
      return res.json({ 
        hasSubscription: false,
        message: 'Subscription has expired'
      });
    }
    
    return res.json({ 
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        expiresAt: subscription.expiresAt,
        status: subscription.status,
        activatedAt: subscription.activatedAt
      }
    });
    
  } catch (error: any) {
    console.error('Get subscription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get subscription status'
    });
  }
});

/**
 * POST /api/flexai/analyze
 * Analyze a trading chart image
 * Supports both web uploads and Telegram image URLs
 */
router.post('/analyze', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { image_url, timeframe, last_message } = req.body;
    const userId = req.user!.id;
    const db = await dbFunctions.db();
    
    // Check subscription
    const subscription = await db.query.flexaiSubscriptions.findFirst({
      where: and(
        eq(flexaiSubscriptions.userId, userId),
        eq(flexaiSubscriptions.status, 'active')
      )
    });
    
    if (!subscription || new Date() > new Date(subscription.expiresAt)) {
      // Update status if expired
      if (subscription) {
        await db.update(flexaiSubscriptions)
          .set({ status: 'expired' })
          .where(eq(flexaiSubscriptions.id, subscription.id));
      }
      
      return res.status(403).json({ 
        success: false,
        error: 'Active subscription required. Please redeem a registration key first.'
      });
    }
    
    // Use image_url from SendPulse or last_message
    const imageUrl = image_url || last_message;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        success: false,
        error: 'Image URL is required'
      });
    }
    
    // Save user message
    await db.insert(flexaiMessages).values({
      userId,
      subscriptionId: subscription.id,
      role: 'user',
      content: `Analyze chart (${timeframe || 'unknown timeframe'})`,
      imageUrl,
      timeframe: timeframe || null
    });
    
    // Get OpenAI analysis
    const openaiService = new OpenAIService(process.env.OPENAI_API_KEY!);
    const analysis = await openaiService.analyzeChart(imageUrl, timeframe);
    
    // Save assistant response
    await db.insert(flexaiMessages).values({
      userId,
      subscriptionId: subscription.id,
      role: 'assistant',
      content: analysis.text,
      analysisResult: analysis,
      analysisType: 'chart_analysis',
      timeframe: timeframe || null
    });
    
    // Return format compatible with both web and Telegram
    return res.json({ 
      success: true,
      analysis: analysis.text,
      // Telegram-compatible fields
      message: analysis.text,
      timeframe: timeframe || 'unknown',
      recommendation: analysis.recommendation || 'See analysis above'
    });
    
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to analyze chart'
    });
  }
});

/**
 * GET /api/flexai/history
 * Get conversation history
 */
router.get('/history', unifiedAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const db = await dbFunctions.db();
    
    const history = await db.query.flexaiMessages.findMany({
      where: eq(flexaiMessages.userId, userId),
      orderBy: [desc(flexaiMessages.createdAt)],
      limit
    });
    
    return res.json({ 
      success: true,
      messages: history.reverse() // Oldest first
    });
    
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get conversation history'
    });
  }
});

export default router;
