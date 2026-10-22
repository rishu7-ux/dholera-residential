import type { CollectionConfig } from "payload";

import { crmContentHidden, crmLeadRead, crmLeadUpdate, crmOfficeRead, crmTeamRead, superAdminField, superAdminOnly } from "../lib/crm/access";
import { validateLeadOperationUpdate } from "../lib/crm/lead-operations";

export const CrmOffices: CollectionConfig = {
  slug: "crm-offices",
  labels: { singular: "CRM Office", plural: "CRM Offices" },
  admin: { useAsTitle: "name", group: "Sales CRM", hidden: crmContentHidden },
  access: { create: superAdminOnly, read: crmOfficeRead, update: superAdminOnly, delete: superAdminOnly },
  fields: [
    { name: "name", type: "text", required: true, unique: true },
    { name: "code", type: "text", required: true, unique: true, index: true },
    { name: "active", type: "checkbox", required: true, defaultValue: true },
  ],
  timestamps: true,
};

export const CrmTeams: CollectionConfig = {
  slug: "crm-teams",
  labels: { singular: "CRM Team", plural: "CRM Teams" },
  admin: { useAsTitle: "name", group: "Sales CRM", hidden: crmContentHidden },
  access: { create: superAdminOnly, read: crmTeamRead, update: superAdminOnly, delete: superAdminOnly },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "office", type: "relationship", relationTo: "crm-offices", required: true, unique: true, index: true },
    { name: "teamLeader", type: "relationship", relationTo: "users", required: true, unique: true, index: true },
    { name: "salespeople", type: "relationship", relationTo: "users", hasMany: true, index: true },
    { name: "active", type: "checkbox", required: true, defaultValue: true },
  ],
  timestamps: true,
};

const leadStatuses = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Follow Up", value: "follow-up" },
  { label: "Qualified", value: "qualified" },
  { label: "Converted", value: "converted" },
  { label: "Lost", value: "lost" },
];

export const CentralLeads: CollectionConfig = {
  slug: "central-leads",
  labels: { singular: "Central Lead", plural: "Central Leads" },
  admin: {
    useAsTitle: "name",
    group: "Sales CRM",
    defaultColumns: ["name", "phone", "website", "source", "assignedSalesperson", "status", "nextFollowUpAt", "createdAt"],
  },
  access: {
    create: superAdminOnly,
    read: crmLeadRead,
    update: crmLeadUpdate,
    delete: superAdminOnly,
  },
  hooks: {
    beforeChange: [({ data, originalDoc, operation }) => {
      if (operation === "update") validateLeadOperationUpdate(data, originalDoc || {});
      return data;
    }],
    afterChange: [async ({ doc, previousDoc, operation, req }) => {
      if (operation !== "update") return doc;
      const actor = req.user?.id;
      const events: Array<{ event: "status-changed" | "note-added" | "follow-up-scheduled" | "assigned" | "reassigned"; details: Record<string, unknown> }> = [];
      if (doc.status !== previousDoc?.status) {
        events.push({ event: "status-changed", details: { from: previousDoc?.status || "new", to: doc.status } });
      }
      if ((doc.notes ?? "") !== (previousDoc?.notes ?? "")) {
        events.push({ event: "note-added", details: { action: doc.notes ? "updated" : "cleared", note: doc.notes || "" } });
      }
      if (doc.nextFollowUpAt !== previousDoc?.nextFollowUpAt) {
        events.push({ event: "follow-up-scheduled", details: { from: previousDoc?.nextFollowUpAt || null, to: doc.nextFollowUpAt || null } });
      }
      const relationKey = (value: unknown) => value && typeof value === "object" && "id" in value
        ? String((value as { id: string | number }).id)
        : value == null ? "" : String(value);
      if (relationKey(doc.assignedSalesperson) !== relationKey(previousDoc?.assignedSalesperson)) {
        events.push({ event: previousDoc?.assignedSalesperson ? "reassigned" : "assigned", details: {
          from: relationKey(previousDoc?.assignedSalesperson) || null,
          to: relationKey(doc.assignedSalesperson) || null,
          mode: "manual",
        } });
      }
      if (events.length && doc.office) {
        for (const item of events) {
          await req.payload.create({
            collection: "crm-activities",
            overrideAccess: true,
            req,
            data: {
              lead: doc.id,
              office: typeof doc.office === "object" ? doc.office.id : doc.office,
              assignedSalesperson: typeof doc.assignedSalesperson === "object" ? doc.assignedSalesperson.id : doc.assignedSalesperson,
              actor,
              event: item.event,
              details: item.details,
            },
          });
        }
      }
      return doc;
    }],
  },
  fields: [
    { name: "name", type: "text", required: true, access: { update: superAdminField } },
    { name: "email", type: "email", access: { update: superAdminField } },
    { name: "phone", type: "text", required: true, access: { update: superAdminField } },
    { name: "website", type: "select", required: true, access: { update: superAdminField }, options: [
      { label: "Omana Projects", value: "omana-projects" },
      { label: "Dholera Estate 1", value: "dholera-estate-1" },
      { label: "Dholera Estate 2", value: "dholera-estate-2" },
      { label: "Dholera Estates", value: "dholeraestates" },
      { label: "Dholera Industrial", value: "dholeraindustrial" },
    ] },
    { name: "leadType", type: "select", required: true, access: { update: superAdminField }, options: [
      { label: "Enquiry", value: "enquiry" },
      { label: "Contact", value: "contact" },
      { label: "Google Ads", value: "google-ads" },
      { label: "ASK OMANA", value: "chatbot" },
    ] },
    { name: "source", type: "text", required: true, access: { update: superAdminField } },
    { name: "project", type: "text", access: { update: superAdminField } },
    { name: "message", type: "textarea", access: { update: superAdminField } },
    { name: "budget", type: "text", access: { update: superAdminField } },
    { name: "page", type: "text", access: { update: superAdminField } },
    { name: "consent", type: "checkbox", required: true, access: { update: superAdminField } },
    { name: "consentRecordedAt", type: "date", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "consentDisclosureVersion", type: "text", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "idempotencyKey", type: "text", required: true, unique: true, index: true, access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "office", type: "relationship", relationTo: "crm-offices", required: true, index: true, access: { update: superAdminField } },
    { name: "team", type: "relationship", relationTo: "crm-teams", index: true, access: { update: superAdminField } },
    { name: "assignedSalesperson", type: "relationship", relationTo: "users", index: true, access: { update: superAdminField } },
    { name: "assignedAt", type: "date", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "assignmentSequence", type: "number", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "unassignedReason", type: "text", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "legacyCollection", type: "text", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "legacyId", type: "text", access: { update: superAdminField }, admin: { readOnly: true } },
    { name: "status", type: "select", required: true, defaultValue: "new", options: leadStatuses },
    { name: "lastContactedAt", type: "date" },
    { name: "nextFollowUpAt", type: "date" },
    { name: "notes", type: "textarea" },
    { name: "attribution", type: "json", access: { update: superAdminField }, admin: { readOnly: true } },
  ],
  timestamps: true,
};

export const CrmActivities: CollectionConfig = {
  slug: "crm-activities",
  labels: { singular: "CRM Activity", plural: "CRM Activities" },
  admin: { useAsTitle: "event", group: "Sales CRM", defaultColumns: ["lead", "event", "actor", "createdAt"] },
  access: { create: () => false, read: crmLeadRead, update: () => false, delete: superAdminOnly },
  fields: [
    { name: "lead", type: "relationship", relationTo: "central-leads", required: true, index: true },
    { name: "office", type: "relationship", relationTo: "crm-offices", required: true, index: true },
    { name: "assignedSalesperson", type: "relationship", relationTo: "users", index: true },
    { name: "actor", type: "relationship", relationTo: "users" },
    { name: "event", type: "select", required: true, options: [
      { label: "Created", value: "created" },
      { label: "Assigned", value: "assigned" },
      { label: "Reassigned", value: "reassigned" },
      { label: "Status Changed", value: "status-changed" },
      { label: "Note Added", value: "note-added" },
      { label: "Follow Up Scheduled", value: "follow-up-scheduled" },
    ] },
    { name: "details", type: "json" },
  ],
  timestamps: true,
};
