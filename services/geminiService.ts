
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, AISuggestion } from "../types";

export const geminiService = {
  getAnalysis: async (transactions: Transaction[]): Promise<AISuggestion[]> => {
    if (transactions.length === 0) {
      return [{ tip: "Start adding your expenses to get personalized AI tips!", type: 'info' }];
    }

    const transactionSummary = transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      date: t.date
    }));

    try {
      // Create a fresh instance of GoogleGenAI for each request as per guidelines for Gemini 3 series.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these transactions and provide 3 friendly, short, and actionable financial tips in JSON format.
        Transactions: ${JSON.stringify(transactionSummary)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tip: { type: Type.STRING, description: 'The financial tip/insight.' },
                type: { type: Type.STRING, enum: ['saving', 'warning', 'info'], description: 'Category of tip.' }
              },
              required: ['tip', 'type']
            }
          }
        }
      });

      const text = response.text || "[]";
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini Error:", error);
      return [
        { tip: "Stay consistent with tracking to see long-term patterns.", type: 'info' },
        { tip: "Review your subscriptions; they often go unnoticed.", type: 'saving' }
      ];
    }
  }
};
