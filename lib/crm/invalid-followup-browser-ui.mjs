/** Inspect only control metadata, so protected diagnostics never retain lead values. */
export function inspectLeadEditor(doc, pathname) {
  const visible = (element) => Boolean(element?.getClientRects().length);
  const hasLabel = (element, expected) => element.getAttribute("aria-label") === expected || element.textContent?.trim() === expected;
  const controls = [...doc.querySelectorAll('button,a,[role="button"],[role="tab"]')].filter(visible);
  const edits = controls.filter((element) => hasLabel(element, "Edit"));
  const saves = controls.filter((element) => hasLabel(element, "Save") && element.tagName.toLowerCase() === "button");
  const field = doc.querySelector("#field-nextFollowUpAt input");
  return {
    route: pathname,
    hasEditControl: edits.length === 1,
    editControlCount: edits.length,
    hasSaveControl: saves.length > 0,
    saveEnabled: saves.some((element) => !element.disabled),
    fieldPresent: Boolean(field),
    fieldEditable: Boolean(field && !field.disabled && !field.readOnly),
    fieldType: field?.type || null,
  };
}

export function leadEditNavigation(state) {
  if (state.fieldPresent || state.hasSaveControl) return "form-open";
  if (state.hasEditControl) return "click-edit";
  return "loading";
}
