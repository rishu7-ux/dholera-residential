import type { RetrievedChunk } from "./types";

const CURRENTNESS_QUESTION_PATTERN = /\b(current|currently|today|latest|right now)\b/i;
const PRICE_QUESTION_PATTERN = /\b(price|pricing|cost|rate|how much|rupees?|inr|lakhs?|crores?)\b/i;

const PRICE_VALUE_PATTERN =
  /(?:₹|\brs\.?\b|\binr\b)\s*\d|\b\d[\d,.]*\s*(?:lakhs?|crores?|per\s+sq\.?\s*(?:yd|yard|ft))\b|\bprice\s+(?:is|at|from|starts?\s+at|on request)\b/i;
const CURRENT_PRICE_LABEL_PATTERN =
  /\b(?:current|latest|today'?s?)\s+(?:price|pricing|cost|rate)\b|\b(?:price|pricing|cost|rate)\s+(?:currently|current|latest)\b/i;
const DATED_VERIFICATION_PATTERN =
  /\b(?:as of|last verified|verified (?:on|at)|updated (?:on|at))\s+(?:today|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,)?\s+\d{4}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})\b/i;

const SENSITIVE_EVIDENCE_RULES = [
  {
    question: /\b(current|currently|today|latest|right now)\b/i,
    evidence: /\b(as of|current|currently|updated|published|last verified)\b/i,
  },
  {
    question: /\b(price|pricing|cost|rate|how much|rupees?|inr|lakhs?|crores?)\b/i,
    evidence: /(₹|\binr\b|\brupees?\b|\bprice\b|\bcost\b|\brate\b|\blakhs?\b|\bcrores?\b)/i,
  },
  {
    question: /\b(available|availability|inventory|sold out|book(?:ing)?)\b/i,
    evidence: /\b(available|availability|inventory|sold out|status|booking)\b/i,
  },
  {
    question: /\b(plot size|sizes?|area|sq\.?\s*(?:yd|yard|ft)|square\s+(?:yard|feet))\b/i,
    evidence: /\b(size|area|sq\.?\s*(?:yd|yard|ft)|square\s+(?:yard|feet))\b/i,
  },
  {
    question: /\b(location|located|where|distance|nearby|address)\b/i,
    evidence: /\b(location|located|village|dholera|distance|road|near|tp[-\s]?\d|address)\b/i,
  },
  {
    question: /\b(approval|approved|legal|title|rera|na status|permission|possession)\b/i,
    evidence: /\b(approval|approved|legal|title|rera|non-agricultural|na\b|permission|possession)\b/i,
  },
  {
    question: /\b(payment plan|installment|finance|loan)\b/i,
    evidence: /\b(payment|installment|finance|loan)\b/i,
  },
  {
    question: /\b(roi|return|appreciation|yield)\b/i,
    evidence: /\b(roi|return|appreciation|yield)\b/i,
  },
] as const;

const PROMPT_INJECTION_PATTERN =
  /\b(ignore (?:all |the )?(?:previous|prior)|system prompt|developer message|reveal (?:your |the )?(?:prompt|instructions)|jailbreak)\b/i;

export function hasRequiredEvidence(question: string, context: string) {
  return SENSITIVE_EVIDENCE_RULES.every(
    (rule) => !rule.question.test(question) || rule.evidence.test(context),
  );
}

export function isPromptInjectionAttempt(question: string) {
  return PROMPT_INJECTION_PATTERN.test(question);
}

export function isCurrentPriceQuestion(question: string) {
  return CURRENTNESS_QUESTION_PATTERN.test(question) && PRICE_QUESTION_PATTERN.test(question);
}

export function hasVerifiedCurrentPriceEvidence(content: string) {
  const evidenceUnits = content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean);

  return evidenceUnits.some(
    (unit) =>
      PRICE_VALUE_PATTERN.test(unit) &&
      (CURRENT_PRICE_LABEL_PATTERN.test(unit) || DATED_VERIFICATION_PATTERN.test(unit)),
  );
}

export function selectGroundingChunks(question: string, chunks: RetrievedChunk[]) {
  if (!isCurrentPriceQuestion(question)) return chunks;

  return chunks.filter((chunk) =>
    hasVerifiedCurrentPriceEvidence(`${chunk.title}\n${chunk.content}`),
  );
}

export function canUseGroundedContext(question: string, context: string) {
  return Boolean(context.trim()) && !isPromptInjectionAttempt(question) && hasRequiredEvidence(question, context);
}

function materialNumbers(value: string) {
  return value.match(/(?:₹\s*)?\d[\d,.]*(?:\s*(?:%|km|m|metres?|sq\.?\s*(?:yd|yard|ft)|lakhs?|crores?))?/gi) ?? [];
}

export function answerNumbersAreGrounded(answer: string, context: string) {
  const normalizedContext = context.toLocaleLowerCase().replace(/\s+/g, " ");
  return materialNumbers(answer).every((number) =>
    normalizedContext.includes(number.toLocaleLowerCase().replace(/\s+/g, " ")),
  );
}
