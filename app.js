import { appendAuditEvent, applyDecision, canDecide, nextPendingGate, verifyAuditChain } from "./src/governance.mjs";

const people = { requester: "Ajay S", reviewer: "Maya Rao", auditor: "Nina Shah", admin: "Arjun Mehta" };
const seed = [
  {id:"DEC-1042",title:"Approve observability platform renewal",area:"Technology",risk:"High",status:"In review",owner:"Maya Rao",context:"Renew the enterprise platform with a 12-month term while preserving exit and data-portability clauses.",updatedAt:"2026-09-09T08:42:00.000Z",gates:[{id:"finance",label:"Finance review",status:"Approved",actor:"Leena"},{id:"security",label:"Security review",status:"Pending"},{id:"executive",label:"Executive approval",status:"Pending"}]},
  {id:"DEC-1039",title:"Expand supplier credit threshold",area:"Finance",risk:"Critical",status:"In review",owner:"Maya Rao",context:"Increase the temporary credit threshold for a strategic supplier after liquidity and concentration-risk review.",updatedAt:"2026-09-09T07:18:00.000Z",gates:[{id:"risk",label:"Risk review",status:"Pending"},{id:"finance",label:"Finance approval",status:"Pending"},{id:"executive",label:"Executive approval",status:"Pending"}]},
  {id:"DEC-1034",title:"Launch Bengaluru pilot program",area:"Operations",risk:"Medium",status:"Approved",owner:"Arjun Mehta",context:"Launch a controlled 90-day pilot with explicit success metrics, budget guardrails and weekly review checkpoints.",updatedAt:"2026-09-08T15:05:00.000Z",gates:[{id:"ops",label:"Operations review",status:"Approved",actor:"Nina"},{id:"finance",label:"Finance approval",status:"Approved",actor:"Leena"}]},
  {id:"DEC-1028",title:"Select customer-data enrichment vendor",area:"Procurement",risk:"High",status:"Changes requested",owner:"Maya Rao",context:"Select a data-enrichment vendor after privacy, security and commercial diligence.",updatedAt:"2026-09-07T11:20:00.000Z",gates:[{id:"privacy",label:"Privacy review",status:"Changes requested",actor:"Maya",note:"Add retention controls."},{id:"security",label:"Security review",status:"Pending"}]}
];

let requests = structuredClone(seed);
let selectedId = requests[0].id;
let role = "reviewer";
let audit = [];

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const statusClass = (status) => status.toLowerCase().replaceAll(" ", "-");
const toast = (message) => { const node=$("#toast"); node.textContent=message; node.classList.add("show"); setTimeout(()=>node.classList.remove("show"),2400); };

async function seedAudit() {
  for (const item of [
    {requestId:"DEC-1034",action:"Approved",actor:"Arjun Mehta",role:"admin",at:"2026-09-08T15:05:00.000Z",note:"Pilot guardrails accepted."},
    {requestId:"DEC-1042",action:"Finance gate approved",actor:"Leena Das",role:"reviewer",at:"2026-09-09T08:10:00.000Z",note:"Budget verified."},
    {requestId:"DEC-1039",action:"Submitted",actor:"Ajay S",role:"requester",at:"2026-09-09T07:18:00.000Z",note:"Critical review path applied."},
  ]) audit = await appendAuditEvent(audit, item);
}

function renderMetrics() {
  const open=requests.filter((item)=>!["Approved","Rejected"].includes(item.status));
  const completed=requests.filter((item)=>["Approved","Rejected"].includes(item.status));
  $("#metric-open").textContent=open.length;
  $("#metric-waiting").textContent=role==="reviewer"||role==="admin" ? open.filter((item)=>nextPendingGate(item)).length : "—";
  $("#metric-rate").textContent=completed.length ? `${Math.round(completed.filter((item)=>item.status==="Approved").length/completed.length*100)}%` : "—";
  $("#open-count").textContent=open.length;
}

function renderRequests() {
  const query=$("#search").value.trim().toLowerCase();
  const filter=$("#status-filter").value;
  const rows=requests.filter((item)=>(filter==="All statuses"||item.status===filter)&&`${item.id} ${item.title} ${item.area}`.toLowerCase().includes(query));
  $("#request-list").innerHTML=rows.length ? rows.map((item)=>`<button class="request-row ${item.id===selectedId?"selected":""}" data-id="${item.id}"><span><strong>${esc(item.title)}</strong><small>${item.id} · ${esc(item.area)} · Updated ${new Date(item.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></span><span class="badge ${statusClass(item.status)}">${esc(item.status)}</span><span class="risk ${item.risk.toLowerCase()}">${esc(item.risk)} risk</span><span>›</span></button>`).join("") : `<div class="empty-state"><p>No decisions match this view.</p></div>`;
  document.querySelectorAll(".request-row").forEach((row)=>row.addEventListener("click",()=>{selectedId=row.dataset.id;render();}));
}

function renderDetail() {
  const item=requests.find((request)=>request.id===selectedId);
  if(!item){$("#detail-panel").innerHTML='<div class="empty-state"><p>Select a decision to review its approval path.</p></div>';return;}
  const gate=nextPendingGate(item), allowed=canDecide(role)&&Boolean(gate);
  $("#detail-panel").innerHTML=`<div class="detail-head"><div><p class="eyebrow">${item.id}</p><h2>${esc(item.title)}</h2><p>${esc(item.area)} · ${esc(item.risk)} risk · Owner ${esc(item.owner)}</p></div><span class="badge ${statusClass(item.status)}">${esc(item.status)}</span></div><div class="context">${esc(item.context)}</div><p class="eyebrow">Approval path</p>${item.gates.map((step,index)=>`<div class="gate ${step.status.toLowerCase()}"><span>${step.status==="Approved"?"✓":index+1}</span><span><strong>${esc(step.label)}</strong><small>${step.actor?`Actioned by ${esc(step.actor)}`:step.status}</small></span><span class="badge ${statusClass(step.status)}">${esc(step.status)}</span></div>`).join("")}<div class="decision-actions"><textarea id="decision-note" placeholder="Add a concise decision note"></textarea><button class="approve" data-action="approve" ${allowed?"":"disabled"}>Approve gate</button><button class="reject" data-action="request_changes" ${allowed?"":"disabled"}>Request changes</button></div><div class="permission-note">Viewing as <strong>${esc(role)}</strong>. ${allowed?`You can act on ${esc(gate.label)}.`:"This role has read-only access to the current decision."}</div>`;
  document.querySelectorAll("[data-action]").forEach((button)=>button.addEventListener("click",()=>decide(button.dataset.action)));
}

function renderAudit() {
  $("#audit-list").innerHTML=[...audit].reverse().map((event)=>`<div class="audit-row"><code>${event.hash.slice(0,12)}…</code><span><strong>${esc(event.action)}</strong><small>${event.requestId} · ${esc(event.note||"No note")}</small></span><span>${esc(event.actor)}<small>${esc(event.role)}</small></span><time>${new Date(event.at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</time></div>`).join("");
}

function render(){renderMetrics();renderRequests();renderDetail();renderAudit();}

async function decide(action){
  const index=requests.findIndex((item)=>item.id===selectedId), note=$("#decision-note").value.trim();
  try{
    requests[index]=applyDecision(requests[index],action,{name:people[role],role},note);
    audit=await appendAuditEvent(audit,{requestId:selectedId,action:action==="approve"?"Approval gate completed":"Changes requested",actor:people[role],role,at:new Date().toISOString(),note});
    render();toast("Decision recorded and audit chain updated.");
  }catch(error){toast(error.message);}
}

$("#role").addEventListener("change",(event)=>{role=event.target.value;render();});
$("#search").addEventListener("input",renderRequests);
$("#status-filter").addEventListener("change",renderRequests);
$("#new-request-button").addEventListener("click",()=>$("#request-dialog").showModal());
$("#request-form").addEventListener("submit",async(event)=>{
  event.preventDefault();const data=new FormData(event.currentTarget);const id=`DEC-${1043+requests.length}`;
  const item={id,title:data.get("title"),area:data.get("area"),risk:data.get("risk"),status:"In review",owner:"Maya Rao",context:data.get("context"),updatedAt:new Date().toISOString(),gates:[{id:"business",label:"Business owner review",status:"Pending"},{id:"risk",label:"Risk and policy review",status:"Pending"},{id:"final",label:"Final approval",status:"Pending"}]};
  requests.unshift(item);selectedId=id;audit=await appendAuditEvent(audit,{requestId:id,action:"Submitted",actor:people[role],role,at:new Date().toISOString(),note:"Governed request created."});
  event.currentTarget.reset();$("#request-dialog").close();render();toast("Governed request created.");
});
$("#verify-button").addEventListener("click",async()=>{const valid=await verifyAuditChain(audit);$("#verification-status").textContent=valid?"● Chain verified":"● Integrity check failed";toast(valid?"Every audit record is cryptographically linked.":"Audit-chain verification failed.");});
document.querySelectorAll(".nav-item").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach((node)=>node.classList.remove("active"));button.classList.add("active");const view=button.dataset.view;if(view==="audit")$("#audit-section").scrollIntoView({behavior:"smooth"});if(view==="requests")$("#request-list").scrollIntoView({behavior:"smooth",block:"center"});document.querySelector(".sidebar").classList.remove("open");}));
$(".mobile-menu").addEventListener("click",()=>$(".sidebar").classList.toggle("open"));

await seedAudit();render();
