// Presentation adapter only: no orchestration, provider calls, or persistence.
export const OFFICE_ROOMS = [
  { id: "strategy", departments: ["Strategy", "Research & Ops"], color: "#769783" },
  { id: "concept", departments: ["Concept"], color: "#b39b72" },
  { id: "copy", departments: ["Copy"], color: "#7896ae" },
  { id: "visual", departments: ["Visual"], color: "#bf8679" },
  { id: "web", departments: ["Web & UX", "Motion & Sound"], color: "#9389a7" },
  { id: "review", departments: [], color: "#83977a" },
];

export function officeRoomFor(agent) {
  if (/QA|Consistency|Audit/i.test(agent?.name || "")) return "review";
  return OFFICE_ROOMS.find(room => room.departments.includes(agent?.dept))?.id || "strategy";
}

export function officeModel(nodes = [], agents = []) {
  const byId = new Map(agents.map(agent => [agent.id, agent]));
  const crew = nodes.filter(node => node.kind === "specialist" || (node.kind === "moodboard" && node.specId)).map(node => {
    const agent = byId.get(node.specId) || { id: node.specId || node.id, name: node.title, dept: "Strategy" };
    return { ...agent, node, state: node.state || "queued", room: officeRoomFor(agent) };
  });
  const outputs = nodes.filter(node => node.kind === "deliverable" || node.kind === "moodboard" ||
    (node.kind === "specialist" && !nodes.some(child => child.kind === "deliverable" && child.id.startsWith(node.id + "-d")) &&
      ["done", "flagged"].includes(node.state) && (node.outputText || node.assetUrl)));
  return {
    crew, outputs,
    active: crew.filter(agent => agent.state === "running"),
    finished: crew.filter(agent => ["done", "flagged"].includes(agent.state)).length,
    failed: crew.some(agent => agent.state === "failed"),
    flagged: crew.some(agent => agent.state === "flagged") || outputs.some(node => node.status === "flagged"),
  };
}
