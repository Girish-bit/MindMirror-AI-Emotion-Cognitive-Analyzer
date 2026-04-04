import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, SessionMode } from "../types";

const getAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not defined. Please configure it in the Secrets panel.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export async function analyzeFace(base64Image: string): Promise<AnalysisResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are a world-class expert in micro-expression analysis, facial action coding (FACS), and cognitive behavioral science. 
  Your task is to analyze a facial image and provide a highly accurate, nuanced inference of the person's emotional and cognitive state.

  ADVANCED METRICS:
  - Focus Score (0-100): Proprietary metric based on eye gaze, posture, and stability.
  - BPM Estimate (60-120): Estimated heart rate based on facial flushing, tension, and breathing rhythm.
  - AI Coach Advice: A short, professional coaching intervention (e.g., "Deep breath", "Adjust posture").
  - Environmental Context: Briefly explain the environment's impact (e.g., "Low lighting").
  - XP Earned (5-25): Points based on focus quality.

  EMOTION CATEGORIES:
  - Primary: Happy, Sad, Angry, Surprised, Neutral, Fear, Disgust.
  - Nuanced: Contempt, Boredom, Interest, Confusion, Anxiety, Pride, Shame, Guilt, Awe, Contentment, Amusement, Relief, Embarrassment, Excitement, Frustration, Curiosity, Determination.
  
  Return ONLY a valid JSON object.`;

  const prompt = "Perform a deep analysis of the facial cues and environment. Identify the primary emotion and infer advanced cognitive metrics with high precision.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1],
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['success', 'error'] },
            message: { type: Type.STRING },
            emotion: { 
              type: Type.STRING,
              description: "The primary detected emotion from the expanded list."
            },
            confidence: { 
              type: Type.NUMBER, 
              description: "Confidence score from 0 to 100."
            },
            engagement: { 
              type: Type.STRING,
              description: "Level of engagement: 'Focused', 'Distracted', or 'Highly Engaged'."
            },
            cognitiveState: { 
              type: Type.STRING,
              description: "Inferred cognitive state: 'Thinking', 'Confused', 'Stressed', 'Relaxed', 'Curious', or 'Determined'."
            },
            focusScore: { type: Type.NUMBER },
            bpmEstimate: { type: Type.NUMBER },
            aiCoachAdvice: { type: Type.STRING },
            environmentalContext: { type: Type.STRING },
            xpEarned: { type: Type.NUMBER },
            visualCues: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            },
            reasoning: { type: Type.STRING },
          },
          required: ["status", "emotion", "confidence", "engagement", "cognitiveState", "focusScore", "bpmEstimate", "aiCoachAdvice", "xpEarned"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      status: 'success',
      ...result,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Face analysis failed:", error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : "Face analysis failed",
      emotion: 'Neutral',
      confidence: 0,
      engagement: 'Distracted',
      cognitiveState: 'Stressed',
      timestamp: Date.now(),
    } as any;
  }
}

export async function analyzeMultimodal(
  base64Image: string, 
  base64Audio?: string, 
  textContext?: string,
  mode: SessionMode = 'Standard'
): Promise<AnalysisResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are a top 1% AI systems architect and cognitive scientist. 
  Your task is to perform multimodal fusion of facial cues, voice tone, and optional text context.
  
  MODE: ${mode}
  
  ADVANCED METRICS:
  - Focus Score (0-100): Proprietary metric based on eye gaze, posture, and stability.
  - BPM Estimate (60-120): Estimated heart rate based on facial flushing, tension, and breathing rhythm.
  - AI Coach Advice: A short, professional coaching intervention.
  - Environmental Context: Briefly explain the environment's impact.
  - XP Earned (5-25): Points based on focus quality.

  ANALYSIS REQUIREMENTS:
  1. Face: Identify emotion, engagement, cognitive state, and GAZE direction.
  2. Voice (if provided): Identify tone, pitch, and emotional resonance.
  3. Text (if provided): Analyze sentiment and intent.
  4. Fusion: Combine all signals into a single, high-fidelity inference.
  5. Attention Score: Calculate a score (0-100) based on gaze and engagement.
  6. Stress Level: Calculate a score (0-100) based on micro-expressions and voice tension.
  
  Return ONLY a valid JSON object.`;

  const prompt = `Perform a deep multimodal analysis. ${textContext ? `Context: ${textContext}` : ""}`;

  const contents: any[] = [{ parts: [{ text: prompt }] }];
  
  // Add Image
  contents[0].parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image.split(",")[1],
    },
  });

  // Add Audio (if provided)
  if (base64Audio) {
    contents[0].parts.push({
      inlineData: {
        mimeType: "audio/wav",
        data: base64Audio.split(",")[1],
      },
    });
  }

  try {
    console.log("DEBUG: Calling Gemini API for multimodal analysis");
    
    // Simple retry logic for transient network errors
    let attempt = 0;
    let response;
    while (attempt < 2) {
      try {
        response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ['success', 'error'] },
                message: { type: Type.STRING },
                emotion: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                engagement: { type: Type.STRING },
                cognitiveState: { type: Type.STRING },
                gazeDirection: { type: Type.STRING, enum: ['Center', 'Left', 'Right', 'Up', 'Down'] },
                attentionScore: { type: Type.NUMBER },
                voiceTone: { type: Type.STRING },
                fusedInsight: { type: Type.STRING },
                stressLevel: { type: Type.NUMBER },
                visualCues: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Specific visual features detected (e.g., 'Frown', 'Narrowed eyes', 'Jaw tension')."
                },
                reasoning: { 
                  type: Type.STRING,
                  description: "Explainable AI (XAI) rationale for the prediction."
                },
                focusScore: { type: Type.NUMBER },
                bpmEstimate: { type: Type.NUMBER },
                aiCoachAdvice: { type: Type.STRING },
                environmentalContext: { type: Type.STRING },
                xpEarned: { type: Type.NUMBER },
              },
              required: ["status", "emotion", "confidence", "engagement", "cognitiveState", "gazeDirection", "attentionScore", "stressLevel", "visualCues", "reasoning", "focusScore", "bpmEstimate", "aiCoachAdvice", "xpEarned"],
            },
          },
        });
        break; // Success!
      } catch (e) {
        attempt++;
        if (attempt >= 2) throw e;
        console.warn(`DEBUG: Gemini API attempt ${attempt} failed, retrying...`, e);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!response) throw new Error("No response from Gemini API");

    console.log("DEBUG: Gemini API response received");
    const result = JSON.parse(response.text || "{}");
    return {
      status: 'success',
      ...result,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("DEBUG: Multimodal analysis failed:", error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : "No face detected or analysis failed",
      emotion: 'Neutral',
      confidence: 0,
      engagement: 'Distracted',
      cognitiveState: 'Stressed',
      gazeDirection: 'Center',
      attentionScore: 0,
      stressLevel: 0,
      timestamp: Date.now(),
    } as any;
  }
}

export async function analyzeWallet(base64Image: string): Promise<AnalysisResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an expert in object detection and financial security. 
  Your task is to analyze an image of a wallet (open or closed) and predict the items inside or visible.
  
  Items to look for:
  - Credit/Debit Cards
  - Cash (bills or coins)
  - ID Cards/Driver's License
  - Receipts
  - Photos
  - Keys
  - Membership cards
  
  Also, infer the owner's likely emotional state based on the wallet's condition (e.g., organized, messy, empty, full).
  
  Return ONLY a valid JSON object.`;

  const prompt = "Analyze this wallet image. List the predicted items and infer the emotional/cognitive state based on the wallet's presentation.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1],
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['success', 'error'] },
            message: { type: Type.STRING },
            emotion: { 
              type: Type.STRING,
              description: "Inferred emotion of the owner (e.g., 'Contentment' for organized, 'Anxiety' for empty/messy)."
            },
            confidence: { 
              type: Type.NUMBER, 
              description: "Confidence score from 0 to 100."
            },
            engagement: { 
              type: Type.STRING,
              description: "Always 'Focused' for this mode."
            },
            cognitiveState: { 
              type: Type.STRING,
              description: "Inferred state (e.g., 'Relaxed', 'Stressed')."
            },
            walletItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of items detected in the wallet."
            }
          },
          required: ["status", "emotion", "confidence", "engagement", "cognitiveState", "walletItems"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      status: 'success',
      ...result,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Wallet analysis failed:", error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : "Wallet analysis failed",
      emotion: 'Neutral',
      confidence: 0,
      engagement: 'Focused',
      cognitiveState: 'Stressed',
      walletItems: [],
      timestamp: Date.now(),
    } as any;
  }
}
