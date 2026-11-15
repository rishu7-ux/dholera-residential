import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

import {
  ASSIGNMENT_OUTBOX, assignmentEmail, assignmentSource, crmDashboardURL,
  dispatchOneAssignmentNotification, queueAssignmentNotification,
  requeueUnattemptedAssignmentNotification,
} from "../../lib/crm/assignment-notification.ts";

const id = () => new mongoose.Types.ObjectId();
const dashboardURL = "https://noida-crm.example.com/";

function fixture({ email = "staff@example.invalid", active = true } = {}) {
  const lead = id();
  const salesperson = id();
  const jobs = new Map();
  const updates = [];
  const outbox = {
    insertOne: async (job, options) => {
      assert.ok(options.session);
      if (jobs.has(String(job._id))) throw new Error("duplicate notification ID");
      jobs.set(String(job._id), { ...job });
    },
    findOne: async (filter) => [...jobs.values()].find((job) => job.status === filter.status) || null,
    findOneAndUpdate: async (filter, update) => {
      const job = jobs.get(String(filter._id));
      if (!job || job.status !== filter.status) return null;
      Object.assign(job, update.$set);
      job.attempts += update.$inc?.attempts || 0;
      return { ...job };
    },
    updateOne: async (filter, update) => {
      const job = jobs.get(String(filter._id));
      if (!job || job.status !== filter.status) return { matchedCount: 0 };
      Object.assign(job, update.$set);
      if (update.$unset) for (const key of Object.keys(update.$unset)) delete job[key];
      updates.push(job.status);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  const db = { collection: (name) => name === ASSIGNMENT_OUTBOX ? outbox : name === "central-leads"
    ? { findOne: async () => ({ assignedSalesperson: salesperson }) }
    : { findOne: async () => ({ role: "salesperson", active, email, name: "Salesperson <01>" }) } };
  return { db, jobs, updates, lead, salesperson };
}

async function queue(f) {
  await queueAssignmentNotification(f.db, {}, {
    lead: f.lead, salesperson: f.salesperson, source: "Estate 1", assignedAt: new Date("2026-10-30T12:00:00Z"),
  });
}

test("round-robin recipient IDs 01, 02, 10, 01 produce one outbox job each", async () => {
  for (const order of [1, 2, 10, 1]) {
    const f = fixture();
    await queue(f);
    assert.equal(f.jobs.size, 1, `rotation ${order}`);
    assert.equal([...f.jobs.values()][0].salesperson, f.salesperson);
    await assert.rejects(queue(f), /duplicate notification ID/);
  }
});

test("template escapes names and source, omits customer details, and links to exact lead", () => {
  const leadId = String(id());
  const message = assignmentEmail({ name: "A <B>", leadId, source: "Meta <Ads>",
    assignedAt: new Date("2026-10-30T12:00:00Z"), dashboardURL });
  assert.match(message.html, /A &lt;B&gt;/);
  assert.match(message.html, /Meta &lt;Ads&gt;/);
  assert.ok(message.html.includes(`/admin/collections/central-leads/${leadId}`));
  assert.ok(!message.html.includes("phone"));
  assert.equal(assignmentSource("omana-projects", "chatbot", "chat"), "ASK OMANA chatbot");
  assert.equal(assignmentSource("omana-projects", "enquiry", "Facebook Meta"), "Meta Ads");
  assert.throws(() => crmDashboardURL("http://evil.example/"));
  assert.throws(() => crmDashboardURL("https://evil.example/path"));
});

test("one claimed job sends only to its assigned salesperson and records provider acceptance", async () => {
  const f = fixture();
  await queue(f);
  const sent = [];
  const send = async (message) => { sent.push(message); };
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    dispatchOneAssignmentNotification(f.db, { dashboardURL, send })));
  assert.equal(results.filter((status) => status === "accepted-by-provider").length, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "staff@example.invalid");
  assert.equal([...f.jobs.values()][0].attempts, 1);
  assert.equal([...f.jobs.values()][0].status, "accepted-by-provider");
});

test("provider failure leaves the committed job uncertain and never auto-retries", async () => {
  const f = fixture();
  await queue(f);
  let sends = 0;
  const send = async () => { sends++; throw new Error("secret provider error"); };
  assert.equal(await dispatchOneAssignmentNotification(f.db, { dashboardURL, send }), "uncertain");
  assert.equal(await dispatchOneAssignmentNotification(f.db, { dashboardURL, send }), "empty");
  assert.equal(sends, 1);
  assert.equal([...f.jobs.values()][0].status, "uncertain");
});

test("missing or inactive salesperson email blocks before provider attempt", async () => {
  for (const details of [{ email: "" }, { active: false }]) {
    const f = fixture(details);
    await queue(f);
    assert.equal(await dispatchOneAssignmentNotification(f.db, {
      dashboardURL, send: async () => { throw new Error("must not send"); },
    }), "blocked");
    assert.equal([...f.jobs.values()][0].attempts, 0);
  }
});

test("only an unattempted blocked job can be safely requeued", async () => {
  const f = fixture({ email: "" });
  await queue(f);
  assert.equal(await dispatchOneAssignmentNotification(f.db, {
    dashboardURL, send: async () => { throw new Error("must not send"); },
  }), "blocked");
  assert.equal(await requeueUnattemptedAssignmentNotification(f.db, f.lead), true);
  assert.equal([...f.jobs.values()][0].status, "queued");
  assert.equal(await requeueUnattemptedAssignmentNotification(f.db, f.lead), false);
  const job = [...f.jobs.values()][0];
  job.status = "uncertain";
  job.attempts = 1;
  assert.equal(await requeueUnattemptedAssignmentNotification(f.db, f.lead), false);
});
