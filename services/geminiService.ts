
import { GoogleGenAI, Type } from "@google/genai";
import { InvariantType, SolverResult, GroundingSource } from "../types";

export const queryQuantumFallback = async (
  problem: string, 
  highReasoning: boolean = false,
  base64Image?: string
): Promise<SolverResult> => {
  // Use process.env.API_KEY directly for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Detect if user is asking for a formal proof
  const isProofRequest = problem.toLowerCase().includes('prove') || problem.toLowerCase().includes('proof');
  const effectiveReasoning = highReasoning || isProofRequest;

  try {
    const parts: any[] = [
      { text: `Analyze and attempt to solve or prove this mathematical query. 
      If it is a formal proof request (like Riemann Hypothesis), provide a structured "Proof Sketch" or "Current State of Proof" following axiomatic principles.
      Problem/Query: ${problem}` }
    ];

    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        systemInstruction: `You are a world-class theoretical mathematician. 
        For proofs: Use a formal structure: Theorem Statement, Lemma(s), and a Step-by-Step Proof or Proof Sketch. 
        For AIMO: Return the integer answer.
        Output MUST be in JSON format with 'answer', 'reasoning', and 'steps'.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { 
              type: Type.STRING, 
              description: "The final numerical answer, or 'Q.E.D.' followed by the theorem name" 
            },
            reasoning: { type: Type.STRING, description: "Detailed axiomatic reasoning and derivation path" },
            steps: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "The sequence of logical deductions" 
            }
          },
          required: ["answer", "steps", "reasoning"]
        },
        // Maximize budget for proof requests
        thinkingConfig: effectiveReasoning ? { thinkingBudget: 32768 } : undefined,
        tools: [{ googleSearch: {} }]
      }
    });

    const json = JSON.parse(response.text || "{}");
    
    const groundingSources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingSources.push({
            title: chunk.web.title || 'Mathematical Source',
            uri: chunk.web.uri
          });
        }
      });
    }
    
    return {
      answer: json.answer ?? "N/A",
      invariantUsed: InvariantType.QUANTUM_FALLBACK,
      reasoning: json.reasoning,
      steps: json.steps ?? ["Quantum fallback processed successfully."],
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          message: isProofRequest ? "Axiomatic Proof Engine successfully engaged." : "Universal Logic resolved high-level query."
        }
      ]
    };
  } catch (error) {
    return {
      answer: null,
      invariantUsed: null,
      steps: ["Deduction engine failed to reach a conclusion."],
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          message: `Deduction Error: ${error instanceof Error ? error.message : 'Unknown'}`
        }
      ]
    };
  }
};
