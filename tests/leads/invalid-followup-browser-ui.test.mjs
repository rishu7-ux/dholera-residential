import assert from "node:assert/strict";
import test from "node:test";

import { inspectLeadEditor, leadEditNavigation } from "../../lib/crm/invalid-followup-browser-ui.mjs";

function element(tagName, textContent, options = {}) {
  return {
    tagName: tagName.toUpperCase(), textContent, disabled: false, readOnly: false, type: "text", ...options,
    getAttribute: (name) => name === "aria-label" ? options.ariaLabel ?? null : null,
    getClientRects: () => options.hidden ? [] : [{}],
  };
}

function documentWith(controls, field = null) {
  return {
    querySelectorAll: (selector) => {
      assert.equal(selector, 'button,a,[role="button"],[role="tab"]');
      return controls;
    },
    querySelector: (selector) => {
      assert.equal(selector, "#field-nextFollowUpAt input");
      return field;
    },
  };
}

test("an already open Payload edit view skips its active Edit tab", () => {
  const state = inspectLeadEditor(documentWith([element("button", "Edit"), element("button", "Save")], element("input", "", { type: "text" })), "/admin/collections/central-leads/id");
  assert.equal(state.fieldEditable, true);
  assert.equal(state.fieldType, "text");
  assert.equal(leadEditNavigation(state), "form-open");
});

test("a separate detail view opens Edit and a missing field remains diagnosable", () => {
  const detail = inspectLeadEditor(documentWith([element("a", "Edit")]), "/admin/collections/central-leads/id");
  assert.equal(leadEditNavigation(detail), "click-edit");
  const missing = inspectLeadEditor(documentWith([element("button", "Save")]), "/admin/collections/central-leads/id");
  assert.equal(leadEditNavigation(missing), "form-open");
  assert.equal(missing.fieldPresent, false);
  assert.equal(missing.hasSaveControl, true);
});

test("hidden Edit and a read-only date never count as an editable form", () => {
  const state = inspectLeadEditor(documentWith([element("a", "Edit", { hidden: true })], element("input", "secret value", { readOnly: true })), "/admin/collections/central-leads/id");
  assert.equal(state.fieldEditable, false);
  assert.equal(state.hasEditControl, false);
  assert.equal(Object.values(state).includes("secret value"), false);
});
