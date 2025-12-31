
import { GoogleGenAI, Type } from "@google/genai";
import { InvariantType, SolverResult, GroundingSource } from "../types";

export const queryQuantumFallback = async (
  problem: string, 
  highReasoning: boolean = false,
  base64Image?: string
): Promise<SolverResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isProofRequest = problem.toLowerCase().includes('prove') || problem.toLowerCase().includes('proof');
  const effectiveReasoning = highReasoning || isProofRequest;

  try {
    const parts: any[] = [
      { text: `Analyze and attempt to solve or prove this mathematical query using Lumina Logic protocols. 
      If it is a formal proof request, provide a structured "Proof Sketch" following axiomatic principles.
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
        systemInstruction: `You are Lumina Core, a world-class theoretical mathematician and logic traversal engine. 
        For proofs: Use a formal structure: Theorem Statement, Lemma(s), and a Step-by-Step Proof Sketch. 
        For numerical problems: Return the specific integer answer.
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
      steps: json.steps ?? ["Lumina stochastic manifold traversal complete."],
      groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          message: isProofRequest ? "Lumina Proof Manifold successfully engaged." : "Lumina stochastic manifold resolved query."
        }
      ]
    };
  } catch (error) {
    return {
      answer: null,
      invariantUsed: null,
      steps: ["Lumina traversal engine failed to reach a consensus."],
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          message: `Deduction Failure: ${error instanceof Error ? error.message : 'Unknown'}`
        }
      ]
    };
  }
};
