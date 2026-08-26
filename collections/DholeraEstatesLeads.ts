import type { Access, CollectionConfig, Field } from "payload";
const authenticated: Access = ({ req }) => Boolean(req.user);
const access = { create: authenticated, read: authenticated, update: authenticated, delete: authenticated };
const status: Field = { name: "status", type: "select", defaultValue: "new", options: [{label:"New",value:"new"},{label:"Contacted",value:"contacted"},{label:"Follow Up",value:"follow-up"},{label:"Qualified",value:"qualified"},{label:"Closed",value:"closed"}] };

export const DholeraEstatesEnquiries: CollectionConfig = {
  slug: "dholera-estates-enquiries",
  labels: { singular: "Dholera Estates Enquiry", plural: "Dholera Estates Enquiries" },
  admin: { useAsTitle: "name", group: "Dholera Estates Leads", defaultColumns: ["name","email","phone","property","source","status","createdAt"] },
  access,
  fields: [
    {name:"name",type:"text",required:true},{name:"email",type:"email",required:true},{name:"phone",type:"text",required:true},
    {name:"property",type:"text",required:true,defaultValue:"Dholera Estates"},{name:"message",type:"textarea"},
    {name:"source",type:"select",required:true,options:[{label:"Popup Form",value:"dholeraestates-popup-form"},{label:"Side Enquiry",value:"dholeraestates-side-enquiry-form"},{label:"Website Form",value:"dholeraestates-website"}]},status,
  ], timestamps:true,
};

export const DholeraEstatesContactMessages: CollectionConfig = {
  slug: "dholera-estates-contact-messages",
  labels: { singular: "Dholera Estates Contact Message", plural: "Dholera Estates Contact Messages" },
  admin: { useAsTitle:"name", group:"Dholera Estates Leads", defaultColumns:["name","email","phone","budget","status","createdAt"] },
  access,
  fields: [
    {name:"name",type:"text",required:true},{name:"email",type:"email",required:true},{name:"phone",type:"text",required:true},
    {name:"propertyType",type:"select",required:true,options:[{label:"Dholera Estates Residential Plot",value:"dholera-estates"}]},
    {name:"budget",type:"select",required:true,options:[{label:"Below ₹20 Lakhs",value:"below-20-lakhs"},{label:"₹20–₹50 Lakhs",value:"20-50-lakhs"},{label:"₹50 Lakhs–₹1 Crore",value:"50-lakhs-1-crore"},{label:"Above ₹1 Crore",value:"above-1-crore"}]},
    {name:"comments",type:"textarea"},{name:"consent",type:"checkbox",required:true},{name:"source",type:"text",required:true,defaultValue:"dholeraestates-contact-us-page"},status,
  ], timestamps:true,
};
