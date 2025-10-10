/* script.js - TaskFlow
   Salve na raiz: TaskFlow/script.js
   Funciona para as 3 páginas: pages/index.html, pages/concluidas.html, pages/configuracoes.html
*/

/* ---------- CHAVES E ESTADO ---------- */
const KEY_TASKS = "taskflow_tasks_v1";
const KEY_USER = "taskflow_user_v1";
const KEY_THEME = "taskflow_theme_v1";

let tasks = JSON.parse(localStorage.getItem(KEY_TASKS) || "[]");
let user = JSON.parse(localStorage.getItem(KEY_USER) || "{}");
let theme = localStorage.getItem(KEY_THEME) || "claro";

/* ---------- HELPERS ---------- */
const save = () => {
  localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  localStorage.setItem(KEY_THEME, theme);
};

const notify = (msg, time = 3500) => {
  const n = document.createElement("div");
  n.className = "notificacao";
  n.innerText = msg;
  document.body.appendChild(n);
  setTimeout(() => n.style.opacity = "0", time - 700);
  setTimeout(() => n.remove(), time);
};

const genId = () => Date.now() + Math.floor(Math.random() * 999);

/* format date (yyyy-mm-dd optional) */
const niceDate = d => {
  if(!d) return "—";
  try{
    const dt = new Date(d);
    if(isNaN(dt)) return d;
    return dt.toLocaleDateString('pt-BR');
  }catch(e){ return d; }
};

/* ---------- THEME + USER ---------- */
function applyTheme() {
  document.body.classList.remove("claro","escuro");
  document.body.classList.add(theme === "escuro" ? "escuro" : "claro");
  localStorage.setItem(KEY_THEME, theme);
}
function toggleTheme() {
  theme = theme === "escuro" ? "claro" : "escuro";
  applyTheme();
  notify(`Tema: ${theme === "escuro" ? "Escuro" : "Claro"}`);
}

function ensureUser() {
  if(!user || !user.name){
    const name = prompt("Qual seu nome? (aparecerá no topo)");
    user = { name: (name && name.trim()) ? name.trim() : "Você" };
    localStorage.setItem(KEY_USER, JSON.stringify(user));
  }
}

function updateTopUserName(){
  document.querySelectorAll("#nome-usuario").forEach(el => {
    if(el) el.innerText = user && user.name ? user.name : "Você";
  });
}

/* ---------- RENDER - DASHBOARD ---------- */
function renderDashboard(){
  // only runs on index.html
  const listEl = document.getElementById("lista-tarefas");
  if(!listEl) return;

  // pending tasks
  const pending = tasks.filter(t=> !t.concluded);
  listEl.innerHTML = "";

  if(pending.length === 0){
    listEl.innerHTML = `<div class="vazio">Nenhuma tarefa pendente. Clique em "+" para adicionar.</div>`;
  } else {
    pending.forEach(t => {
      const li = document.createElement("li");
      li.className = `tarefa prioridade-${t.priority}`;
      li.innerHTML = `
        <h3>${escapeHtml(t.title)}</h3>
        <p>${escapeHtml(t.description || "")}</p>
        <div class="meta">
          <small>Prioridade: ${capitalize(t.priority)}</small>
          <small> • Criada: ${niceDate(t.createdAt)}</small>
        </div>
        <div class="acoes">
          <button class="btn acao-editar" data-id="${t.id}">✏️ Editar</button>
          <button class="btn acao-concluir" data-id="${t.id}">✔️ Concluir</button>
          <button class="btn acao-excluir" data-id="${t.id}">🗑️</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  // attach listeners
  listEl.querySelectorAll(".acao-concluir").forEach(btn=>{
    btn.onclick = e => {
      const id = Number(btn.dataset.id);
      markConcluded(id);
    };
  });
  listEl.querySelectorAll(".acao-excluir").forEach(btn=>{
    btn.onclick = e => {
      const id = Number(btn.dataset.id);
      removeTaskById(id);
    };
  });
  listEl.querySelectorAll(".acao-editar").forEach(btn=>{
    btn.onclick = e => {
      const id = Number(btn.dataset.id);
      openEditModal(id);
    };
  });

  renderProgress();
}

/* ---------- RENDER - CONCLUÍDAS ---------- */
function renderConcluded(){
  const listEl = document.getElementById("lista-concluidas");
  if(!listEl) return;
  const done = tasks.filter(t=> t.concluded);
  listEl.innerHTML = "";
  if(done.length === 0){
    listEl.innerHTML = `<div class="vazio">Nenhuma tarefa concluída ainda.</div>`;
  } else {
    done.forEach(t => {
      const li = document.createElement("li");
      li.className = `tarefa concluida prioridade-${t.priority}`;
      li.innerHTML = `
        <h3>${escapeHtml(t.title)}</h3>
        <p>${escapeHtml(t.description || "")}</p>
        <div class="meta">
          <small>Concluída em: ${niceDate(t.doneAt)}</small>
        </div>
        <div class="acoes">
          <button class="btn" data-id="${t.id}" data-action="reopen">↩️ Reabrir</button>
          <button class="btn acao-excluir" data-id="${t.id}">🗑️ Excluir</button>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  listEl.querySelectorAll('[data-action="reopen"]').forEach(b=>{
    b.onclick = () => {
      const id = Number(b.dataset.id);
      reopenTask(id);
    };
  });
  listEl.querySelectorAll(".acao-excluir").forEach(b=>{
    b.onclick = () => {
      const id = Number(b.dataset.id);
      removeTaskById(id);
    };
  });
}

/* ---------- CRUD ---------- */
function addTask(obj){
  const t = {
    id: genId(),
    title: obj.title,
    description: obj.description || "",
    priority: obj.priority || "media",
    createdAt: new Date().toISOString(),
    concluded: false,
    doneAt: null
  };
  tasks.unshift(t);
  save();
  notify("Tarefa criada ✔");
  renderAll();
  return t;
}

function updateTask(id, data){
  const i = tasks.findIndex(x=>x.id===id);
  if(i<0) return;
  tasks[i] = { ...tasks[i], ...data };
  save();
  renderAll();
}

function markConcluded(id){
  const i = tasks.findIndex(x=>x.id===id);
  if(i<0) return;
  tasks[i].concluded = true;
  tasks[i].doneAt = new Date().toISOString();
  save();
  notify(`"${tasks[i].title}" concluída 🎉`);
  renderAll();
}

function reopenTask(id){
  const i = tasks.findIndex(x=>x.id===id);
  if(i<0) return;
  tasks[i].concluded = false;
  tasks[i].doneAt = null;
  save();
  notify(`"${tasks[i].title}" reaberta`);
  renderAll();
}

function removeTaskById(id){
  const i = tasks.findIndex(x=>x.id===id);
  if(i<0) return;
  const title = tasks[i].title;
  if(!confirm(`Excluir "${title}"?`)) return;
  tasks.splice(i,1);
  save();
  notify(`"${title}" removida`);
  renderAll();
}

/* ---------- MODAL (index) ---------- */
function openAddModal(){
  const m = document.getElementById("modal-tarefa");
  if(!m) return;
  m.style.display = "flex";
  // clear fields
  const ti = document.getElementById("titulo-tarefa");
  const de = document.getElementById("descricao-tarefa");
  const pr = document.getElementById("prioridade-tarefa");
  ti.value = ""; de.value = ""; pr.value = "media";
  // save button logic
  document.getElementById("salvar-tarefa").onclick = () => {
    const title = ti.value.trim();
    if(!title){ alert("Adicione um título!"); return; }
    addTask({ title, description: de.value.trim(), priority: pr.value });
    m.style.display = "none";
  };
  document.getElementById("cancelar-tarefa").onclick = () => { m.style.display = "none"; };
  // close by clicking outside
  m.onclick = (ev) => { if(ev.target === m) m.style.display = "none"; };
}

function openEditModal(id){
  const m = document.getElementById("modal-tarefa");
  if(!m) return;
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  m.style.display = "flex";
  const ti = document.getElementById("titulo-tarefa");
  const de = document.getElementById("descricao-tarefa");
  const pr = document.getElementById("prioridade-tarefa");
  ti.value = t.title; de.value = t.description; pr.value = t.priority;
  document.getElementById("salvar-tarefa").onclick = () => {
    const title = ti.value.trim();
    if(!title){ alert("Adicione um título!"); return; }
    updateTask(id, { title, description: de.value.trim(), priority: pr.value });
    m.style.display = "none";
  };
  document.getElementById("cancelar-tarefa").onclick = () => { m.style.display = "none"; };
}

/* ---------- PROGRESS ---------- */
function renderProgress(){
  const total = tasks.length;
  const done = tasks.filter(t=>t.concluded).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  const progressEl = document.getElementById("progresso-barra");
  if(progressEl) progressEl.setAttribute("style", `stroke-dasharray: ${pct} 100`);
  const pctTxt = document.getElementById("porcentagem-progresso");
  if(pctTxt) pctTxt.innerText = `${pct}%`;
}

/* ---------- MOTIVATIONAL ROTATION ---------- */
const phrases = [
  "O sucesso é feito de pequenas vitórias diárias.",
  "Uma tarefa por vez — siga tranquilo.",
  "Progresso > Perfeição. Continue.",
  "Fez algo hoje? Ótimo. Repita amanhã.",
  "Pequenos passos. Grandes resultados."
];
function rotatePhrase(){
  const el = document.getElementById("mensagem-motivacional");
  if(!el) return;
  el.innerText = phrases[Math.floor(Math.random()*phrases.length)];
}

/* ---------- CONFIG PAGE HOOKS ---------- */
function setupConfigPage(){
  // elements
  const saveNameBtn = document.getElementById("salvar-nome");
  const nameInput = document.getElementById("novo-nome");
  const btnClear = document.getElementById("limpar-tarefas");
  const btnReset = document.getElementById("resetar-tudo");
  const themeLight = document.getElementById("tema-claro");
  const themeDark = document.getElementById("tema-escuro");

  if(nameInput) nameInput.value = user.name || "";

  if(saveNameBtn){
    saveNameBtn.onclick = () => {
      const val = nameInput.value.trim();
      if(!val){ alert("Digite um nome válido."); return; }
      user.name = val; save(); updateTopUserName(); notify("Nome atualizado");
    };
  }
  if(btnClear) btnClear.onclick = () => {
    if(confirm("Deseja remover todas as tarefas? Isso NÃO altera seu nome ou tema.")){
      tasks = []; save(); renderAll();
      notify("Todas as tarefas foram removidas");
    }
  };
  if(btnReset) btnReset.onclick = () => {
    if(confirm("Resetar tudo (tarefas, nome e tema)?")){
      tasks = []; user = {}; theme = "claro"; save();
      notify("Aplicativo redefinido. Recarregando...");
      setTimeout(()=> location.reload(), 800);
    }
  };
  if(themeLight) themeLight.onclick = ()=>{ theme = "claro"; applyTheme(); notify("Tema: claro"); };
  if(themeDark) themeDark.onclick = ()=>{ theme = "escuro"; applyTheme(); notify("Tema: escuro"); };
}

/* ---------- UTIL ---------- */
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function capitalize(s){ if(!s) return ""; return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- RENDER ALL (safely) ---------- */
function renderAll(){
  renderDashboard();
  renderConcluded();
  renderProgress();
  updateTopUserName();
}

/* ---------- STARTUP ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // apply theme
  if(theme !== "escuro") theme = "claro";
  applyTheme();

  // ensure user name
  ensureUser();
  updateTopUserName();

  // attach top-level theme toggle if present
  document.querySelectorAll("#tema-toggle").forEach(btn=>{
    btn.onclick = toggleTheme;
  });

  // dashboard-specific
  const addBtn = document.getElementById("botao-adicionar");
  if(addBtn) addBtn.onclick = openAddModal;

  // modal open/close wiring: salvar/cancel already attached inside openAddModal/edit

  // attachments for pages
  rotatePhrase();
  setInterval(rotatePhrase, 8000); // mudar a cada 8s

  // config page hooks
  setupConfigPage();

  // initial render
  renderAll();
});
