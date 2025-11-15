// server/services/openai.service.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class OpenAIService {
  /**
   * Analyze trading chart from image URL
   */
  static async analyzeChart(
    imageUrl: string,
    analysisType: 'first_analysis' | 'second_analysis' | 'user_analysis',
    timeframe: string = 'M15',
    userAnalysis?: string
  ): Promise<string> {
    try {
      const prompt = this.buildPrompt(analysisType, timeframe, userAnalysis);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: imageUrl,
                  detail: 'high'
                } 
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });
      
      const analysis = response.choices[0].message.content || '';
      
      // Limit to 1024 characters for SendPulse compatibility
      if (analysis.length > 1024) {
        return analysis.substring(0, 1020) + '...';
      }
      
      return analysis;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to analyze chart. Please try again.');
    }
  }
  
  /**
   * Build prompt based on analysis type
   */
  private static buildPrompt(
    analysisType: string,
    timeframe: string,
    userAnalysis?: string
  ): string {
    const basePrompt = `أنت محلل فني محترف للعملات. قم بتحليل الرسم البياني التالي.`;
    
    switch (analysisType) {
      case 'first_analysis':
        return `${basePrompt}
        
الإطار الزمني: ${timeframe}

قدم تحليلاً شاملاً يتضمن:
1. الاتجاه العام (صاعد/هابط/عرضي)
2. مستويات الدعم والمقاومة الرئيسية
3. المؤشرات الفنية المرئية
4. نقاط الدخول والخروج المحتملة
5. إدارة المخاطر (Stop Loss و Take Profit)

اجعل التحليل واضحاً ومختصراً (أقل من 1000 حرف).`;
        
      case 'second_analysis':
        return `${basePrompt}
        
الإطار الزمني: ${timeframe}

هذا هو الإطار الزمني الثاني. قدم:
1. تأكيد أو تعارض مع الإطار الأول
2. نقاط التقاء مهمة
3. توصية نهائية
4. مستويات دخول وخروج محدثة

كن مختصراً (أقل من 1000 حرف).`;
        
      case 'user_analysis':
        return `${basePrompt}
        
الإطار الزمني: ${timeframe}
تحليل المستخدم: ${userAnalysis}

راجع تحليل المستخدم وقدم:
1. نقاط القوة
2. نقاط للتحسين
3. ملاحظات إضافية
4. توصيات نهائية

كن بناءً ومختصراً (أقل من 1000 حرف).`;
        
      default:
        return basePrompt;
    }
  }
}
