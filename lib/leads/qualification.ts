export const QUALIFICATION_VERSION = "ask-omana-v1";

export type LeadQualification = "hot" | "warm" | "cold" | "needs-review";

export type QualificationInput = {
  initialIntent?: string | null;
  selectedProject?: string | null;
  requirement?: string | null;
  budget?: string | null;
  purchaseTimeline?: string | null;
};

export type QualificationResult = {
  qualification: LeadQualification;
  reasons: string[];
  version: typeof QUALIFICATION_VERSION;
};

const UNKNOWN_PATTERN = /^(?:unknown|unclear|unsure|not sure|n\/a|na|none|skip|general|information only)$/i;
const NO_PURCHASE_PATTERN =
  /\b(?:only (?:need|want) information|just (?:need|want) information|information only|not (?:currently )?planning to (?:buy|purchase|invest)|no (?:current )?(?:plan|intention) to (?:buy|purchase|invest)|not interested in (?:buying|purchasing|investing)|(?:only|just) browsing|research only)\b/i;
const STRONG_BUYING_PATTERN =
  /\b(?:want to|ready to|planning to|plan to|looking to|intend to|interested in) (?:buy|purchase|book|invest)|\b(?:buy|purchase|book|invest) (?:a |an |the )?(?:plot|property|project|home|site)\b/i;
const SITE_VISIT_PATTERN =
  /\b(?:site visit|project visit|property visit|visit (?:the )?(?:site|project|property)|schedule (?:a )?visit|arrange (?:a )?visit|book (?:a )?visit)\b/i;
const CONTACT_PATTERN =
  /\b(?:call me|contact me|speak (?:to|with) (?:sales|an? adviser|an? advisor|the team)|talk (?:to|with) (?:sales|an? adviser|an? advisor|the team)|sales call|arrange (?:a )?call|schedule (?:a )?call)\b/i;
const COMPARISON_PATTERN =
  /\b(?:compar(?:e|ing)|explor(?:e|ing)|considering options|weighing options|not decided|researching projects)\b/i;
const NEAR_TERM_PATTERN =
  /\b(?:today|now|immediately|asap|this week|next week|this month|next month|within (?:the )?(?:next )?(?:\d+|one|two|three) (?:day|days|week|weeks|month|months)|(?:one|two|three|1|2|3) months?)\b/i;
const LATER_TIMELINE_PATTERN =
  /\b(?:several months|later this year|next year|after (?:three|3) months|(?:four|five|six|seven|eight|nine|ten|eleven|twelve|4|5|6|7|8|9|10|11|12) months?)\b/i;

function text(value?: string | null) {
  return value?.trim() || "";
}

function isMeaningful(value?: string | null) {
  const normalized = text(value);
  return normalized.length >= 2 && !UNKNOWN_PATTERN.test(normalized);
}

export function qualifyLead(input: QualificationInput): QualificationResult {
  const initialIntent = text(input.initialIntent);
  const project = text(input.selectedProject);
  const requirement = text(input.requirement);
  const budget = text(input.budget);
  const timeline = text(input.purchaseTimeline);
  const explicitText = [initialIntent, requirement, timeline].filter(Boolean).join(" ");

  const signals = {
    specificInterest: isMeaningful(project),
    clearRequirement: isMeaningful(requirement),
    budgetSupplied: isMeaningful(budget),
    strongBuyingIntent: STRONG_BUYING_PATTERN.test(explicitText),
    siteVisitIntent: SITE_VISIT_PATTERN.test(explicitText),
    contactIntent: CONTACT_PATTERN.test(explicitText),
    comparisonIntent: COMPARISON_PATTERN.test(explicitText),
    nearTerm: NEAR_TERM_PATTERN.test(timeline),
    laterTimeline: LATER_TIMELINE_PATTERN.test(timeline),
    noCurrentPurchase: NO_PURCHASE_PATTERN.test(explicitText),
  };

  if (signals.noCurrentPurchase) {
    return {
      qualification: "cold",
      reasons: ["Customer explicitly stated there is no current purchase intention."],
      version: QUALIFICATION_VERSION,
    };
  }

  const meaningfulPropertyContext = signals.specificInterest || signals.clearRequirement;
  const isHot =
    (signals.nearTerm && meaningfulPropertyContext) ||
    (signals.siteVisitIntent && (meaningfulPropertyContext || signals.strongBuyingIntent)) ||
    (signals.contactIntent && signals.strongBuyingIntent && meaningfulPropertyContext) ||
    (signals.budgetSupplied && signals.strongBuyingIntent && meaningfulPropertyContext);

  if (isHot) {
    const reasons = [
      signals.nearTerm ? "Customer supplied a near-term purchase timeline." : "",
      signals.siteVisitIntent ? "Customer explicitly requested a site or property visit." : "",
      signals.contactIntent ? "Customer explicitly requested contact with sales or an adviser." : "",
      signals.budgetSupplied ? "Customer supplied a budget." : "",
      signals.strongBuyingIntent ? "Customer explicitly expressed buying intent." : "",
      signals.specificInterest ? "Customer supplied a specific project or property interest." : "",
      signals.clearRequirement ? "Customer supplied a clear property requirement." : "",
    ].filter(Boolean);
    return { qualification: "hot", reasons, version: QUALIFICATION_VERSION };
  }

  const isWarm =
    signals.laterTimeline ||
    signals.comparisonIntent ||
    signals.clearRequirement ||
    (signals.strongBuyingIntent && signals.specificInterest);

  if (isWarm) {
    const reasons = [
      signals.laterTimeline ? "Customer supplied a later purchase timeline." : "",
      signals.comparisonIntent ? "Customer is comparing or exploring property options." : "",
      signals.strongBuyingIntent ? "Customer explicitly expressed buying intent." : "",
      signals.specificInterest ? "Customer supplied a specific project or property interest." : "",
      signals.clearRequirement ? "Customer supplied a clear property requirement." : "",
    ].filter(Boolean);
    return { qualification: "warm", reasons, version: QUALIFICATION_VERSION };
  }

  return {
    qualification: "needs-review",
    reasons: ["The supplied information is insufficient for a safe automatic qualification."],
    version: QUALIFICATION_VERSION,
  };
}
