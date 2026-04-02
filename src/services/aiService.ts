import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeFace(base64Image: string): Promise<AnalysisResult> {
  const model = "gemini-3.1-flash-lite-preview";
  
  const systemInstruction = `You are a world-class expert in micro-expression analysis, facial action coding (FACS), and cognitive behavioral science. 
  Your task is to analyze a facial image and provide a highly accurate, nuanced inference of the person's emotional and cognitive state.

  EMOTION CATEGORIES (Select the most accurate):
  - Primary: Happy, Sad, Angry, Surprised, Neutral, Fear, Disgust.
  - Nuanced: Contempt, Boredom, Interest, Confusion, Anxiety, Pride, Shame, Guilt, Awe, Contentment, Amusement, Relief, Embarrassment, Excitement, Frustration, Curiosity, Determination.

  CRITICAL GUIDELINES:
  - Emotion: Identify the dominant emotion from the list above. Look for micro-expressions (e.g., lip corner tightening for Contempt, pupil dilation for Interest).
  - Confidence: Provide a realistic confidence score (0-100) based on the clarity of facial features and intensity of the expression.
  - Engagement: Infer based on gaze direction, head tilt, and muscle tension.
    - 'Highly Engaged': Intense focus, forward lean, direct gaze, minimal blinking.
    - 'Focused': Steady attention, neutral posture, consistent gaze.
    - 'Distracted': Gaze aversion, relaxed or slumped posture, frequent blinking.
  - Cognitive State:
    - 'Thinking': Brow furrowed slightly, eyes narrowed or looking away, hand-to-face contact.
    - 'Confused': Asymmetrical brow, tilted head, lip biting.
    - 'Stressed': Tightened jaw, flared nostrils, visible tension in neck/forehead.
    - 'Relaxed': Smooth facial features, open posture, soft gaze.
    - 'Determined': Firm jaw, steady gaze, slight brow furrow.
    - 'Curious': Tilted head, raised eyebrows, slight smile.
    
  Return ONLY a valid JSON object. Do not include any markdown formatting or explanations.`;

  const prompt = "Perform a deep analysis of the facial cues in this image. Identify the primary emotion from the expanded list and infer the cognitive and engagement states with high precision.";

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
          },
          required: ["emotion", "confidence", "engagement", "cognitiveState"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      ...result,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Face analysis failed:", error);
    throw error;
  }
}

export async function analyzeWallet(base64Image: string): Promise<AnalysisResult> {
  const model = "gemini-3.1-flash-lite-preview";
  
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
          required: ["emotion", "confidence", "engagement", "cognitiveState", "walletItems"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      ...result,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Wallet analysis failed:", error);
    throw error;
  }
}
