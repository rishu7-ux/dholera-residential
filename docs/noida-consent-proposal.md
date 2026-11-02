# Noida Phase 1 — Consent Wording Proposal (Not Approved)

This is a wording proposal for owner/legal review, not legal advice or authorization to change public forms. This inventory was refreshed on 2026-10-22 against the current local form code and the completed October 20 form QA; the older `noida-consent-inventory.md` predates those controls. No public text or behavior was changed by this document. Keep enquiry-response consent separate from optional marketing consent; marketing must not be required to submit an enquiry. Final wording, translation, contact channels, retention purpose, privacy link, version IDs, and implementation require owner/legal approval.

## Proposed enquiry-response consent

Unchecked, affirmative checkbox when the form is opened:

> I agree that **[legal entity / website brand]** may use my contact details to respond to this enquiry about **[project, if applicable]**. See the [Privacy Notice].

Use this only after legal review confirms the named entity, use purpose, and privacy-notice link. The checkbox must not be prechecked. If the owner/legal reviewer determines that a checkbox is not required for a particular enquiry response, document that decision explicitly and store the correct basis; do not manufacture an affirmative-consent timestamp.

## Proposed optional marketing consent

Separate, unchecked checkbox; never required for form submission:

> Yes, I would like to receive optional project updates and promotional communications from **[legal entity / website brand]** by **[approved channels]**. This is optional and is not required to submit my enquiry. I can withdraw this preference at any time. See the [Privacy Notice].

Only show this control if the owner intends to send marketing. Store its independent value, timestamp, channel, disclosure version, and withdrawal state. An enquiry-response action must never imply marketing consent.

## Form update inventory (pending approval)

| Website / UI forms | Required review/update after approval |
| --- | --- |
| `omana-projects`: global enquiry drawer, project enquiry, Contact Us, Dholera Plots landing form | Review existing enquiry-only wording for named entity, project scope, privacy link, stored version and proof of affirmative action. Add separate optional marketing checkbox only if approved. |
| `omana-projects`: ASK OMANA, English and Hinglish | Preserve the explicit yes/no enquiry-contact gate; approve both exact prompts and translations. Store the actual answer/channel and disclosure version. Marketing must be an independent optional action, not inferred from chatbot consent. |
| `dholera-estate-1`: Contact Us, popup and side enquiry | Active code has required, initially unchecked enquiry-contact checkboxes. Review the exact wording, named entity, privacy link, version and stored proof; decide optional marketing separately. |
| `dholera-estate-2`: Contact Us, popup and side enquiry | Active code has required, initially unchecked enquiry-contact checkboxes. Review the exact wording, named entity, privacy link, version and stored proof; decide optional marketing separately. |
| `dholeraestates`: Contact Us, popup, side and embedded/site forms | Current Contact Us, popup, side, `ContactForm` and `LeadForm` code includes enquiry-contact checkboxes. Verify which embedded controls are mounted; approve exact wording, entity, privacy link, version and proof. |
| `dholeraindustrial`: active `ContactForm`, enquiry modal and side enquiry | Current active controls include required, initially unchecked enquiry-contact checkboxes. Review exact wording, entity, privacy link, version and proof; decide optional marketing separately. |
| `dholeraindustrial`: frontend Contact page | The active page mounts `ContactForm`; older form markup remains elsewhere in the page. Review that markup's reachability before treating it as a separate public control. |

## Evidence and implementation decisions

The current central marker (`website:source:v1`) is an implementation version, not a disclosure snapshot. Before production, approve whether central evidence must contain exact rendered text or immutable text/hash, language, version ID, checkbox/yes-no action, timestamp, channel, purpose, source form, and separate marketing preference/withdrawal timestamp. Keep existing forms untouched until approval. Read the older source-by-source baseline in `docs/noida-consent-inventory.md` together with the October 20 form QA and the refreshed inventory above.
