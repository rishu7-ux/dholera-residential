import type { ChatTurn } from "./types";
import { UNVERIFIED_ANSWER } from "./constants";

export function buildRetrievalQuery(question: string, history: ChatTurn[]) {
  const recent = history.slice(-6).map((turn) => `${turn.role}: ${turn.content}`);
  return [...recent, `user: ${question}`].join("\n").slice(-2_400);
}

export function unverifiedAnswerFor(question: string) {
  if (/\p{Script=Devanagari}/u.test(question)) {
    return "माफ़ कीजिए, Omana Projects के स्वीकृत स्रोतों से मैं अभी इस जानकारी की पुष्टि नहीं कर सकता। नवीनतम सत्यापित जानकारी के लिए मैं आपको Omana के अधिकृत सलाहकार से संपर्क करने में मदद कर सकता हूँ।";
  }
  if (/\b(?:kya|kaise|batao|bataiye|chahiye|iska|iski|iske|mein|hai|plot ka|price kya)\b/i.test(question)) {
    return "Sorry, Omana Projects ke approved sources se main abhi is information ko verify nahi kar sakta. Latest confirmed details ke liye main aapko authorised Omana adviser se connect karne mein help kar sakta hoon.";
  }
  return UNVERIFIED_ANSWER;
}
