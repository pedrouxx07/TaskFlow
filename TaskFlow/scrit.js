/* script.js — TaskFlow Premium Clean
   Coloque na raiz TaskFlow/script.js
   Lida com as 3 páginas (index, concluidas, configuracoes)
*/

/* ---------- Storage keys ---------- */
const KEY = "taskflow_v2_data";
const KEY_USER = "taskflow_v2_user";
const KEY_THEME = "taskflow_v2_theme";

/* ---------- State ---------- */
let state = {
  tasks: [], // {id,title,description,priority,category,createdAt,concluded,doneAt}
  user: {name: ""},
  theme: "claro"
};

/* ---------- Init ---------- */
function loadState(){
  try {
    const raw = localStorage.getItem(KEY);
    state.tasks = raw ? JSON.parse(raw) : [];
  } catch(e){ state.tasks = []; }
  try {
    const u = localStorage.getItem(KEY_USER);
    state.user = u ? JSON.parse(u) : {name:"Você"};
  } catch(e){ state.user = {name:"Você"}; }
  state.theme = localStorage.getItem(KEY_THEME) || "claro";
}
function saveState(){
  localStorage.setItem(KEY, JSON.stringify(state.tasks));
  localStorage.setItem(KEY_USER, JSON.stringify(state.user));
  localStorage.setItem(KEY_THEME, state.theme);
}

/* ---------- Utils ---------- */
const genId = ()=> Date.now() + Math.floor(Math.random()*999);
const niceDate = d => { if(!d) return "—"; try{ return new Date(d).toLocaleDateString('pt-BR'); }catch{ return d } };
const esc = s => String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const byId = id => document.getElementById(id);

/* ---------- Theme & user ---------- */
function applyTheme(){
  document.body.classList.remove("claro","escuro");
  document.body.classList.add(state.theme === "escuro" ? "escuro" : "claro");
  saveState();
}
function toggleTheme(){
  state.theme = state.theme === "escuro" ? "claro" : "escuro";
  applyTheme();
  toast(`Tema: ${state.theme}`);
}

/* greeting */
function saudacao(){
  const h = new Date().getHours();
  if(h < 12) return "Bom dia";
  if(h < 18) return "Boa tarde";
  return "Boa noite";
}

/* ---------- Rendering dashboard ---------- */
function renderDashboard(){
  const listEl = byId("listaTarefas");
  if(!listEl) return;
  const q = (byId("busca") && byId("busca").value || "").toLowerCase();
  const filtro = (byId("filtroPrioridade") && byId("filtroPrioridade").value) || "todas";

  const pending = state.tasks.filter(t=> !t.concluded);
  const filtered = pending.filter(t=>{
    if(filtro !== "todas" && t.priority !== filtro) return false;
    if(q && !(t.title.toLowerCase().includes(q) || (t.description||"").toLowerCase().includes(q) || (t.category||"").toLowerCase().includes(q))) return false;
    return true;
  });

  listEl.innerHTML = "";
  if(filtered.length === 0){
    byId("emptyPendentes").style.display = "block";
  } else {
    byId("emptyPendentes").style.display = "none";
    filtered.forEach(task => {
      const li = document.createElement("li");
      li.className = `tarefa prioridade-${task.priority}`;
      li.innerHTML = `
        <div>
          <h3>${esc(task.title)}</h3>
          <p>${esc(task.description)}</p>
          <div class="meta"><small>${esc(task.category||"")}</small><small> • ${niceDate(task.createdAt)}</small></div>
        </div>
        <div class="row-actions">
          <button class="icon-btn btn-edit" data-id="${task.id}" title="Editar">${svgIcon('edit')}</button>
          <button class="icon-btn btn-done" data-id="${task.id}" title="Concluir">${svgIcon('check')}</button>
          <button class="icon-btn btn-delete" data-id="${task.id}" title="Excluir">${svgIcon('trash')}</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  // attach listeners
  listEl.querySelectorAll(".btn-done").forEach(b=> b.onclick = e => {
    const id = Number(b.dataset.id); concludeTask(id);
  });
  listEl.querySelectorAll(".btn-delete").forEach(b=> b.onclick = e => {
    const id = Number(b.dataset.id); removeTask(id);
  });
  listEl.querySelectorAll(".btn-edit").forEach(b=> b.onclick = e => {
    const id = Number(b.dataset.id); openEditModal(id);
  });

  renderProgress();
  renderUrgents();
  rotateMotivation();
  updateUserButtons();
}

/* ---------- Render concluded ---------- */
function renderConcluded(){
  const listEl = byId("listaConcluidas");
  if(!listEl) return;
  const done = state.tasks.filter(t => t.concluded);
  listEl.innerHTML = "";
  if(done.length === 0){
    byId("emptyConcluidas").style.display = "block";
  } else {
    byId("emptyConcluidas").style.display = "none";
    done.forEach(task=>{
      const li = document.createElement("li");
      li.className = `tarefa concluidas prioridade-${task.priority} concluida`;
      li.innerHTML = `
        <div>
          <h3>${esc(task.title)}</h3>
          <p>${esc(task.description)}</p>
          <div class="meta"><small>Concluída: ${niceDate(task.doneAt)}</small></div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-id="${task.id}" data-action="reopen">${svgIcon('undo')}</button>
          <button class="icon-btn" data-id="${task.id}" data-action="trash">${svgIcon('trash')}</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  listEl.querySelectorAll('[data-action="reopen"]').forEach(b=>{
    b.onclick = () => { const id = Number(b.dataset.id); reopenTask(id); };
  });
  listEl.querySelectorAll('[data-action="trash"]').forEach(b=>{
    b.onclick = () => { const id = Number(b.dataset.id); removeTask(id); };
  });
}

/* ---------- Progress & urgentes ---------- */
function renderProgress(){
  const canvas = byId("canvasProgress");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const total = state.tasks.length;
  const done = state.tasks.filter(t=>t.concluded).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  // draw background circle
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const cx = canvas.width/2, cy = canvas.height/2, r = 60;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#e6e6e6';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();

  // animated arc
  const start = -Math.PI/2;
  const end = start + (Math.PI*2)*(pct/100);
  // gradient stroke
  const grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  grad.addColorStop(0, '#6C63FF'); grad.addColorStop(1, '#8b7bff');
  ctx.strokeStyle = grad;
  ctx.beginPath(); ctx.arc(cx,cy,r,start,end); ctx.stroke();

  const pctEl = byId("pctProgresso");
  if(pctEl) pctEl.innerText = `${pct}%`;
  const meta = byId("metaProgresso");
  if(meta) meta.innerText = `${done} de ${total} concluídas`;
}

/* urgent tasks (due soon) — here as example based on createdAt proximity */
function renderUrgents(){
  const list = byId("listaUrgentes");
  if(!list) return;
  // simple: tasks without category "long" and low createdAt older than 7 days -> urgent (demo)
  const urg = state.tasks.filter(t => !t.concluded && t.priority === "alta").slice(0,5);
  list.innerHTML = urg.length ? urg.map(u=>`<li>${esc(u.title)}</li>`).join("") : "<li>Sem urgentes</li>";
}

/* ---------- CRUD ---------- */
function addTask(obj){
  const t = {
    id: genId(),
    title: obj.title,
    description: obj.description || "",
    priority: obj.priority || "media",
    category: obj.category || "",
    createdAt: new Date().toISOString(),
    concluded: false,
    doneAt: null
  };
  state.tasks.unshift(t);
  saveState();
  toastAnim('create');
  renderAll();
  return t;
}
function updateTask(id, data){
  const i = state.tasks.findIndex(x=>x.id===id); if(i<0) return;
  state.tasks[i] = {...state.tasks[i], ...data};
  saveState(); renderAll();
}
function concludeTask(id){
  const i = state.tasks.findIndex(x=>x.id===id); if(i<0) return;
  state.tasks[i].concluded = true;
  state.tasks[i].doneAt = new Date().toISOString();
  saveState();
  playConfetti();
  toast(`Concluída: ${state.tasks[i].title}`);
  renderAll();
}
function reopenTask(id){
  const i = state.tasks.findIndex(x=>x.id===id); if(i<0) return;
  state.tasks[i].concluded = false;
  state.tasks[i].doneAt = null;
  saveState(); renderAll();
}
function removeTask(id){
  const i = state.tasks.findIndex(x=>x.id===id); if(i<0) return;
  if(!confirm(`Deseja excluir "${state.tasks[i].title}"?`)) return;
  const title = state.tasks[i].title;
  state.tasks.splice(i,1);
  saveState();
  toast(`Excluída: ${title}`);
  renderAll();
}

/* ---------- Modal (add/edit) ---------- */
let editingId = null;
function openAddModal(){
  editingId = null;
  const m = byId("modal"); if(!m) return;
  byId("modalTitle").innerText = "Nova tarefa";
  byId("inputTitulo").value = "";
  byId("inputDescricao").value = "";
  byId("inputPrioridade").value = "media";
  byId("inputCategoria").value = "";
  m.style.display = "flex"; m.setAttribute("aria-hidden","false");
}
function openEditModal(id){
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  editingId = id;
  const m = byId("modal");
  byId("modalTitle").innerText = "Editar tarefa";
  byId("inputTitulo").value = t.title;
  byId("inputDescricao").value = t.description;
  byId("inputPrioridade").value = t.priority;
  byId("inputCategoria").value = t.category;
  m.style.display = "flex"; m.setAttribute("aria-hidden","false");
}

/* ---------- UI helpers: toast & small animations ---------- */
function toast(msg, time=2800){
  const n = document.createElement("div"); n.className="toast"; n.innerText = msg;
  Object.assign(n.style,{position:'fixed',right:'20px',bottom:'20px',background:'#222',color:'#fff',padding:'10px 14px',borderRadius:'10px',zIndex:9999,opacity:0});
  document.body.appendChild(n);
  requestAnimationFrame(()=> n.style.opacity=1);
  setTimeout(()=>{ n.style.opacity=0; setTimeout(()=>n.remove(),400) }, time);
}
/* tiny visual animation when creating */
function toastAnim(type){
  // type: 'create' animate quick pulse on btnAdicionar
  const btn = byId("btnAdicionar");
  if(!btn) return;
  btn.animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:420});
}

/* ---------- Confetti (simple) ---------- */
let confettiCtx, confettiCanvas, confettiPieces=[];
function setupConfetti(){
  confettiCanvas = byId("confettiCanvas");
  if(!confettiCanvas) return;
  confettiCtx = confettiCanvas.getContext("2d");
  function resize(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
  window.addEventListener('resize', resize); resize();
}

function playConfetti(){
  if(!confettiCtx) return;
  // spawn pieces
  for(let i=0;i<30;i++){
    confettiPieces.push({
      x: Math.random()*innerWidth,
      y: -10 - Math.random()*200,
      vx: (Math.random()-0.5)*2,
      vy: 2 + Math.random()*3,
      size: 6 + Math.random()*8,
      color: ['#6C63FF','#22C55E','#FFB86B','#EF4444'][Math.floor(Math.random()*4)],
      rot: Math.random()*360,
      rotSpeed: (Math.random()-0.5)*8
    });
  }
  let t0 = performance.now();
  function frame(t){
    const dt = (t - t0)/1000; t0 = t;
    confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    confettiPieces.forEach((p,i)=>{
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.vy += 0.06; p.rot += p.rotSpeed*dt;
      confettiCtx.save();
      confettiCtx.translate(p.x,p.y);
      confettiCtx.rotate(p.rot * Math.PI/180);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      confettiCtx.restore();
    });
    confettiPieces = confettiPieces.filter(p => p.y < innerHeight + 40);
    if(confettiPieces.length) requestAnimationFrame(frame);
    else confettiCtx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  }
  requestAnimationFrame(frame);
}

/* ---------- Motivate rotate ---------- */
const phrases = [
  "O sucesso é feito de pequenas vitórias.",
  "Uma tarefa por vez — você consegue.",
  "Progresso > Perfeição. Continue.",
  "Fez algo hoje? Ótimo — repita amanhã.",
  "Pequenos passos. Grandes resultados."
];
function rotateMotivation(){
  const el = byId("mensagemMotivacional");
  if(!el) return;
  el.innerText = phrases[Math.floor(Math.random()*phrases.length)];
}

/* ---------- Export / Import ---------- */
function exportJSON(){
  const blob = new Blob([JSON.stringify(state.tasks,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'taskflow_tasks.json'; a.click();
  toast('Exportado (.json)');
}
function importJSON(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = ()=> {
    try{
      const arr = JSON.parse(r.result);
      if(Array.isArray(arr)){
        state.tasks = arr;
        saveState(); renderAll(); toast('Importado com sucesso');
      } else alert('JSON inválido');
    }catch(e){ alert('Arquivo inválido'); }
  };
  r.readAsText(file);
}

/* ---------- Edit/save modal wiring ---------- */
function wireModal(){
  const modal = byId("modal");
  if(modal){
    byId("modalClose").onclick = ()=> { modal.style.display='none'; modal.setAttribute('aria-hidden','true'); };
    byId("cancelarBtn").onclick = ()=> { modal.style.display='none'; modal.setAttribute('aria-hidden','true'); };
    byId("salvarBtn").onclick = ()=>{
      const title = byId("inputTitulo").value.trim();
      if(!title) return alert("Coloque um título");
      const obj = {
        title,
        description: byId("inputDescricao").value.trim(),
        priority: byId("inputPrioridade").value,
        category: byId("inputCategoria").value.trim()
      };
      if(editingId){ updateTask(editingId, obj); editingId = null; }
      else addTask(obj);
      modal.style.display='none'; modal.setAttribute('aria-hidden','true');
    };
    modal.onclick = (e)=> { if(e.target === modal){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); } };
  }
}

/* ---------- Edit hooks on list (open edit) - already done in renderDashboard via openEditModal  ---------- */

/* ---------- Helpers UI ---------- */
function updateUserButtons(){
  document.querySelectorAll('.user-btn').forEach(b => {
    if(b) b.innerText = state.user && state.user.name ? state.user.name : "Você";
  });
  const s = byId("saudacao"); if(s) s.innerText = `${saudacao()}, ${state.user.name || "Você"}`;
}

/* ---------- shortcuts ---------- */
function setupShortcuts(){
  document.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase() === 'n' && !isInputFocused()) openAddModal();
    if(e.key.toLowerCase() === 't' && !isInputFocused()) toggleTheme();
    if(e.key.toLowerCase() === 'f' && !isInputFocused()) toggleFocusMode();
  });
}
function isInputFocused(){
  const el = document.activeElement; if(!el) return false;
  return ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
}

/* ---------- Focus mode (highlight first pending or selected) ---------- */
let focusMode = false;
function toggleFocusMode(){
  focusMode = !focusMode;
  if(focusMode){
    const pending = state.tasks.filter(t=>!t.concluded);
    if(pending.length){
      // highlight first by dimming others
      document.body.classList.add('focus-mode');
      const all = document.querySelectorAll('.tarefa'); all.forEach(n=> n.style.opacity = 0.25);
      const first = document.querySelector('.tarefa'); if(first) first.style.opacity = 1;
      toast('Modo foco ativado');
    } else toast('Sem tarefas para focar');
  } else {
    document.body.classList.remove('focus-mode');
    document.querySelectorAll('.tarefa').forEach(n=> n.style.opacity = 1);
    toast('Modo foco desativado');
  }
}

/* ---------- small UI icons as inline SVGs ---------- */
function svgIcon(name){
  const icons = {
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#0f1724" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>`,
    edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 21v-3l11-11 3 3L6 21H3z" stroke="#6C63FF" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 14l-4-4 4-4" stroke="#14213d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20a8 8 0 0 0-8-8H4" stroke="#14213d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  return icons[name] || '';
}

/* ---------- Render all based on page ---------- */
function renderAll(){
  renderDashboard();
  renderConcluded();
  renderProgress();
  updateUserButtons();
}

/* ---------- init wiring ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  loadState();
  if(!state.user || !state.user.name) {
    const n = prompt("Qual seu nome? (vai aparecer no topo)");
    state.user = { name: n && n.trim() ? n.trim() : "Você" };
    saveState();
  }
  applyTheme();
  setupConfetti();
  wireModal();
  setupShortcuts();

  // page detection
  const path = location.pathname.split("/").pop();
  if(path === "" || path === "index.html") {
    // dashboard wiring
    byId("btnAdicionar")?.addEventListener("click", openAddModal);
    byId("btnTema")?.addEventListener("click", toggleTheme);
    byId("busca")?.addEventListener("input", renderDashboard);
    byId("filtroPrioridade")?.addEventListener("change", renderDashboard);
    byId("btnModoFoco")?.addEventListener("click", toggleFocusMode);
    byId("modalClose")?.addEventListener("click", ()=>{ byId("modal").style.display='none' });
    byId("salvarBtn")?.addEventListener("click", ()=>{ /* handled in wireModal */ });
    // modal inputs handled by wireModal
  }
  if(path === "concluidas.html"){
    byId("btnTema")?.addEventListener("click", toggleTheme);
  }
  if(path === "configuracoes.html"){
    // config wiring
    byId("btnTema")?.addEventListener("click", toggleTheme);
    byId("btnSalvarNome")?.addEventListener("click", ()=>{
      const v = byId("inputNomeConfig").value.trim();
      if(!v) return alert("Digite um nome");
      state.user.name = v; saveState(); updateUserButtons(); toast('Nome salvo');
    });
    byId("temaClaro")?.addEventListener("click", ()=>{ state.theme='claro'; applyTheme(); toast('Tema claro');});
    byId("temaEscuro")?.addEventListener("click", ()=>{ state.theme='escuro'; applyTheme(); toast('Tema escuro');});
    byId("btnExport")?.addEventListener("click", exportJSON);
    byId("btnImport")?.addEventListener("click", ()=>byId("fileImport").click());
    byId("fileImport")?.addEventListener("change",(e)=> importJSON(e.target.files[0]));
    byId("btnReset")?.addEventListener("click", ()=>{
      if(confirm("Resetar tudo (tarefas + nome + tema)?")){
        state.tasks=[]; state.user={name:"Você"}; state.theme='claro'; saveState(); location.reload();
      }
    });
  }

  // universal update
  updateUserButtons();
  rotateMotivation();
  setInterval(rotateMotivation, 9000);
  renderAll();
});

/* Polyfills for older browsers */
function byIdSafe(id){ return document.getElementById(id); }
