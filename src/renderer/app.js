const app = document.getElementById("appShell");
const setupScreen = document.getElementById("setupScreen");
const view = document.getElementById("view");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const toastEl = document.getElementById("toast");

const money = v => Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc = v => String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const ym = () => today().slice(0,7);
const dateBR = value => {
  if(!value) return "-";
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if(Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
};
const dateTimeBR = value => {
  if(!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("pt-BR");
};
const paymentLabel = m => ({dinheiro:"Dinheiro",cartao:"Cartão",boleto:"Boleto",pix:"PIX",prazo:"A Prazo"}[m]||m||"-");
const expenseLabels = {combustivel:"Combustível",alimentacao:"Alimentação",hospedagem:"Hospedagem",pedagio:"Pedágio",manutencao:"Manutenção",outros:"Outros"};
const categories = ["Alimentos","Bebidas","Laticínios","Frios e Congelados","Hortifruti","Padaria","Outros"];
const units = ["UN","CX","KG","L","PCT","FD"];
const pages = {
  home:["Início","Visão geral do seu negócio"],
  sell:["Nova venda","Registre pedidos em cinco etapas"],
  products:["Produtos","Catálogo, preços e estoque"],
  clients:["Clientes","Cadastro e relacionamento"],
  orders:["Pedidos","Histórico e status das vendas"],
  financial:["Financeiro","Parcelas e recebimentos"],
  expenses:["Despesas","Despesas do negócio"],
  reports:["Relatórios","Indicadores e desempenho"],
  visits:["Rotas e visitas","Agenda, check-in e check-out"],
  assistant:["Assistente","Alertas e insights offline"],
  settings:["Configurações","Perfil, meta, aparência e dados"]
};

let currentPage = "home";
let wizard = {
  step:1, clientId:null, clientName:"", items:[], paymentMethod:"dinheiro",
  installmentCount:1, interestRate:0, observations:""
};

function notify(message, error=false){
  toastEl.textContent=message;
  toastEl.className=`toast ${error?"error":""}`;
  clearTimeout(notify.timer);
  notify.timer=setTimeout(()=>toastEl.classList.add("hidden"),2800);
}
function openModal(title, html, cls=""){
  modalTitle.textContent=title; modalBody.innerHTML=html;
  modal.querySelector(".modal-box").className=`modal-box ${cls}`;
  modal.classList.remove("hidden");
}
function closeModal(){modal.classList.add("hidden")}
document.getElementById("modalClose").onclick=closeModal;
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});

document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.getElementById("backupBtn").onclick=exportBackup;
document.getElementById("quickSearchBtn").onclick=()=>document.querySelector("input[type='search'],input.search")?.focus();
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.querySelector("input[type='search'],input.search")?.focus()}
  if(e.key==="Escape") closeModal();
});

async function init(){
  const theme = localStorage.getItem("giro_theme") || "light";
  applyTheme(theme);
  const status = await window.giro.setup.status();
  if(!status.configured) return showSetup();
  app.classList.remove("hidden");
  await refreshCompany();
  navigate("home");
}
function showSetup(){
  app.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  setupScreen.innerHTML=`
    <div class="setup-card">
      <img class="setup-logo" src="../assets/logo.png">
      <h1 class="setup-title">Giro Vendas</h1>
      <p class="setup-sub">Configure o perfil do vendedor para começar.</p>
      <div class="form-grid">
        <div class="form-group full"><label>Nome do Vendedor *</label><input id="setSeller" placeholder="Seu nome"></div>
        <div class="form-group full"><label>Nome da Empresa *</label><input id="setCompany" placeholder="Nome da empresa"></div>
        <div class="form-group"><label>Categoria</label><select id="setCategory">${categories.map(x=>`<option>${x}</option>`).join("")}</select></div>
        <div class="form-group"><label>Telefone</label><input id="setPhone" placeholder="(00) 00000-0000"></div>
      </div>
      <div class="form-actions"><button class="primary" id="saveSetup">Salvar e começar</button></div>
    </div>`;
  document.getElementById("saveSetup").onclick=async()=>{
    const seller=document.getElementById("setSeller").value.trim();
    const company=document.getElementById("setCompany").value.trim();
    if(seller.length<2||company.length<2){notify("Preencha vendedor e empresa.",true);return}
    await window.giro.setup.save({sellerName:seller,companyName:company,category:document.getElementById("setCategory").value,phone:document.getElementById("setPhone").value});
    setupScreen.classList.add("hidden");app.classList.remove("hidden");
    await refreshCompany();navigate("home");
  };
}
async function refreshCompany(){
  const s=await window.giro.settings.get();
  document.getElementById("companyName").textContent=s.config?.companyName||"";
}
function applyTheme(mode){
  document.documentElement.classList.toggle("dark",mode==="dark");
  if(mode==="system"){
    document.documentElement.classList.toggle("dark",matchMedia("(prefers-color-scheme: dark)").matches);
  }
}
function setTheme(mode){localStorage.setItem("giro_theme",mode);applyTheme(mode)}

async function navigate(page){
  if(!pages[page]) return;
  currentPage=page;
  document.querySelectorAll("#nav [data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  document.getElementById("pageTitle").textContent=pages[page][0];
  document.getElementById("pageSubtitle").textContent=pages[page][1];
  ({
    home:renderHome,sell:renderSell,products:renderProducts,clients:renderClients,orders:renderOrders,
    financial:renderFinancial,expenses:renderExpenses,reports:renderReports,visits:renderVisits,
    assistant:renderAssistant,settings:renderSettings
  }[page])();
}
function greet(){
  const h=new Date().getHours();return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite";
}

async function renderHome(){
  const d=await window.giro.dashboard();
  const goalPct=d.goalTarget>0?Math.min(d.goalCurrent/d.goalTarget*100,100):0;
  const max=Math.max(...d.days.map(x=>x.total),1);
  view.innerHTML=`
    <div class="row-between"><div class="muted">${greet()}, ${esc(d.sellerName)}! • ${dateBR(new Date().toISOString())}</div><button class="secondary" data-page="assistant">Ver assistente</button></div>
    ${d.goalTarget>0?`<div class="card" style="margin-top:14px"><div class="row-between"><strong>Meta do Mês</strong><strong>${goalPct.toFixed(0)}%</strong></div><div class="progress" style="margin:10px 0 7px"><span style="width:${goalPct}%"></span></div><span class="muted">${money(d.goalCurrent)} de ${money(d.goalTarget)}</span></div>`:""}
    <div class="cards" style="margin-top:14px">
      <div class="card" data-page="orders"><div class="metric-label">Vendas Hoje (${d.todayCount})</div><div class="metric">${money(d.todaySales)}</div></div>
      <div class="card" data-page="reports"><div class="metric-label">Vendas Mês (${d.monthCount})</div><div class="metric">${money(d.monthSales)}</div></div>
      <div class="card" data-page="clients"><div class="metric-label">Clientes Ativos</div><div class="metric">${d.activeClients}</div></div>
      <div class="card" data-page="financial"><div class="metric-label">A Receber</div><div class="metric">${money(d.overdueAmount)}</div></div>
    </div>
    <div class="grid2">
      <div class="panel"><h2>Últimos 7 dias</h2><div class="bar-chart">
        ${d.days.map(x=>`<div class="bar-col"><div class="bar-val">${x.total?money(x.total):""}</div><div class="bar" style="height:${Math.max(2,(x.total/max)*120)}px"></div><div class="bar-label">${x.label}</div></div>`).join("")}
      </div></div>
      <div class="panel"><h2>Ações rápidas</h2><div class="quick-grid">
        <button class="quick" data-page="sell"><div class="icon">🛒</div><div class="label">Nova venda</div></button>
        <button class="quick" data-page="clients"><div class="icon">♙</div><div class="label">Novo cliente</div></button>
        <button class="quick" data-page="products"><div class="icon">▦</div><div class="label">Novo produto</div></button>
        <button class="quick" data-page="visits"><div class="icon">⌖</div><div class="label">Check-in</div></button>
      </div></div>
    </div>
    ${(d.overdueCount||d.lowStockCount)?`<div class="panel" style="margin-top:16px"><h2>Alertas</h2>${d.overdueCount?`<div class="alert" data-page="financial">⚠ ${d.overdueCount} parcela(s) vencida(s)</div>`:""}${d.lowStockCount?`<div class="alert danger" data-page="products">▦ ${d.lowStockCount} produto(s) com estoque baixo</div>`:""}</div>`:""}`;
  bindDataPageClicks();
  document.querySelectorAll(".card[data-page]").forEach(x=>x.addEventListener("click",()=>navigate(x.dataset.page)));
}
function bindDataPageClicks(){document.querySelectorAll("[data-page]").forEach(b=>{if(!b.__bound){b.__bound=true;b.addEventListener("click",()=>navigate(b.dataset.page))}})}

async function renderProducts(){
  view.innerHTML=`<div class="toolbar"><input id="productSearch" class="search" type="search" placeholder="Buscar produto por nome ou código de barras"><button class="primary" id="addProductBtn">+ Produto</button></div><div id="productTable"></div>`;
  document.getElementById("addProductBtn").onclick=()=>productModal();
  const paint=async()=>{
    const rows=await window.giro.products.list(document.getElementById("productSearch").value);
    document.getElementById("productTable").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Un.</th><th></th></tr></thead><tbody>
      ${rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.barcode||"")}</div></td><td>${esc(p.category||"-")}</td><td>${money(p.price1)}</td><td>${p.stockCurrent<=p.stockMinimum?`<span class="badge red">${p.stockCurrent}</span>`:p.stockCurrent}</td><td>${esc(p.unit)}</td><td><button class="secondary" data-edit-product="${p.id}">Editar</button></td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum produto encontrado.</div></td></tr>`}
    </tbody></table></div>`;
    document.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>productModal(null,b.dataset.editProduct));
  };
  document.getElementById("productSearch").oninput=paint;await paint();
}
async function productModal(obj,id){
  const p=obj||await window.giro.products.get(id)||{};
  openModal(p.id?"Editar produto":"Novo produto",`
    <div class="form-grid">
      <div class="form-group"><label>Nome *</label><input id="pName" value="${esc(p.name||"")}"></div>
      <div class="form-group"><label>Código de barras</label><input id="pBarcode" value="${esc(p.barcode||"")}"></div>
      <div class="form-group"><label>Categoria</label><select id="pCategory">${categories.map(c=>`<option ${p.category===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="form-group"><label>Unidade</label><select id="pUnit">${units.map(u=>`<option ${p.unit===u?"selected":""}>${u}</option>`).join("")}</select></div>
      <div class="form-group"><label>Preço de Venda *</label><input id="pPrice1" type="number" step="0.01" value="${p.price1??0}"></div>
      <div class="form-group"><label>Preço de Custo</label><input id="pPrice2" type="number" step="0.01" value="${p.price2??""}"></div>
      <div class="form-group"><label>Preço Tabela 3</label><input id="pPrice3" type="number" step="0.01" value="${p.price3??""}"></div>
      <div class="form-group"><label>Estoque Atual</label><input id="pStock" type="number" step="1" value="${p.stockCurrent??0}"></div>
      <div class="form-group"><label>Estoque Mínimo</label><input id="pMin" type="number" step="1" value="${p.stockMinimum??0}"></div>
      <div class="form-group full"><label>Descrição</label><textarea id="pDesc">${esc(p.description||"")}</textarea></div>
    </div>
    <div id="marginInfo" class="card" style="margin-top:12px"></div>
    <div class="form-actions"><button class="secondary" id="cancelP">Cancelar</button><button class="primary" id="saveP">Salvar Produto</button></div>`);
  const margin=()=>{const a=Number(document.getElementById("pPrice1").value||0),b=Number(document.getElementById("pPrice2").value||0);document.getElementById("marginInfo").innerHTML=a>0&&b>0?`<strong>Lucro estimado por unidade:</strong> ${money(a-b)} (${((a-b)/a*100).toFixed(1)}%)`:"Informe venda e custo para ver o lucro estimado."};
  ["pPrice1","pPrice2"].forEach(x=>document.getElementById(x).oninput=margin);margin();
  document.getElementById("cancelP").onclick=closeModal;
  document.getElementById("saveP").onclick=async()=>{
    const name=document.getElementById("pName").value.trim();if(name.length<2){notify("Informe o nome do produto.",true);return}
    await window.giro.products.save({id:p.id,name,barcode:document.getElementById("pBarcode").value,category:document.getElementById("pCategory").value,unit:document.getElementById("pUnit").value,
      price1:document.getElementById("pPrice1").value,price2:document.getElementById("pPrice2").value,price3:document.getElementById("pPrice3").value,stockCurrent:document.getElementById("pStock").value,stockMinimum:document.getElementById("pMin").value,description:document.getElementById("pDesc").value});
    closeModal();notify("Produto salvo.");renderProducts();
  };
}

async function renderClients(){
  view.innerHTML=`<div class="toolbar"><input id="clientSearch" class="search" type="search" placeholder="Buscar por nome, telefone ou cidade"><button class="primary" id="addClientBtn">+ Cliente</button></div><div id="clientTable"></div>`;
  document.getElementById("addClientBtn").onclick=()=>clientModal();
  const paint=async()=>{
    const rows=await window.giro.clients.list(document.getElementById("clientSearch").value);
    document.getElementById("clientTable").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Telefone</th><th>Cidade/UF</th><th>CNPJ/CPF</th><th></th></tr></thead><tbody>
    ${rows.map(c=>`<tr><td><strong>${esc(c.nomeFantasia)}</strong><div class="muted">${esc(c.razaoSocial)}</div></td><td>${esc(c.phone)}</td><td>${esc(c.city||"-")}${c.state?" / "+esc(c.state):""}</td><td>${esc(c.cnpjCpf||"-")}</td><td><button class="secondary" data-client="${c.id}">Abrir</button></td></tr>`).join("")||`<tr><td colspan="5"><div class="empty">Nenhum cliente encontrado.</div></td></tr>`}</tbody></table></div>`;
    document.querySelectorAll("[data-client]").forEach(b=>b.onclick=()=>clientDetail(b.dataset.client));
  };
  document.getElementById("clientSearch").oninput=paint;await paint();
}
async function clientModal(obj,id){
  const d=obj?{client:obj}:id?await window.giro.clients.get(id):{client:{}};
  const c=d.client||{};
  openModal(c.id?"Editar cliente":"Novo cliente",`
    <div class="form-grid">
      <div class="form-group"><label>Razão Social *</label><input id="cRazao" value="${esc(c.razaoSocial||"")}"></div>
      <div class="form-group"><label>Nome Fantasia *</label><input id="cFantasia" value="${esc(c.nomeFantasia||"")}"></div>
      <div class="form-group"><label>CNPJ/CPF</label><input id="cDoc" value="${esc(c.cnpjCpf||"")}"></div>
      <div class="form-group"><label>Telefone *</label><input id="cPhone" value="${esc(c.phone||"")}"></div>
      <div class="form-group"><label>E-mail</label><input id="cEmail" value="${esc(c.email||"")}"></div>
      <div class="form-group"><label>CEP</label><input id="cCep" value="${esc(c.cep||"")}"></div>
      <div class="form-group"><label>Rua</label><input id="cStreet" value="${esc(c.street||"")}"></div>
      <div class="form-group"><label>Número</label><input id="cNumber" value="${esc(c.number||"")}"></div>
      <div class="form-group"><label>Complemento</label><input id="cComplement" value="${esc(c.complement||"")}"></div>
      <div class="form-group"><label>Bairro</label><input id="cNeighborhood" value="${esc(c.neighborhood||"")}"></div>
      <div class="form-group"><label>Cidade</label><input id="cCity" value="${esc(c.city||"")}"></div>
      <div class="form-group"><label>UF</label><input id="cState" maxlength="2" value="${esc(c.state||"")}"></div>
      <div class="form-group full"><label>Observações</label><textarea id="cObs">${esc(c.observations||"")}</textarea></div>
    </div>
    <div class="form-actions"><button class="secondary" id="cancelC">Cancelar</button><button class="primary" id="saveC">Salvar Cliente</button></div>`);
  document.getElementById("cancelC").onclick=closeModal;
  document.getElementById("saveC").onclick=async()=>{
    const razao=document.getElementById("cRazao").value.trim(), fantasia=document.getElementById("cFantasia").value.trim(), phone=document.getElementById("cPhone").value.trim();
    if(razao.length<2||fantasia.length<2||phone.length<2){notify("Preencha razão social, nome fantasia e telefone.",true);return}
    await window.giro.clients.save({id:c.id,razaoSocial:razao,nomeFantasia:fantasia,cnpjCpf:document.getElementById("cDoc").value,phone,email:document.getElementById("cEmail").value,cep:document.getElementById("cCep").value,street:document.getElementById("cStreet").value,number:document.getElementById("cNumber").value,complement:document.getElementById("cComplement").value,neighborhood:document.getElementById("cNeighborhood").value,city:document.getElementById("cCity").value,state:document.getElementById("cState").value,observations:document.getElementById("cObs").value});
    closeModal();notify("Cliente salvo.");renderClients();
  };
}
async function clientDetail(id){
  const d=await window.giro.clients.get(id);if(!d)return;
  const c=d.client;
  openModal(c.nomeFantasia,`
    <div class="detail-grid">
      <div class="detail-item"><small>Razão Social</small><strong>${esc(c.razaoSocial)}</strong></div>
      <div class="detail-item"><small>Telefone</small><strong>${esc(c.phone)}</strong></div>
      <div class="detail-item"><small>CNPJ/CPF</small><strong>${esc(c.cnpjCpf||"-")}</strong></div>
      <div class="detail-item"><small>Cidade</small><strong>${esc(c.city||"-")} ${c.state?"/ "+esc(c.state):""}</strong></div>
      <div class="detail-item"><small>E-mail</small><strong>${esc(c.email||"-")}</strong></div>
      <div class="detail-item"><small>Compras registradas</small><strong>${d.sales.length}</strong></div>
    </div>
    <div class="panel" style="margin-top:14px"><h2>Últimos pedidos</h2>${d.sales.slice(0,8).map(s=>`<div class="list-card"><div class="row-between"><strong>#${String(s.orderNumber).padStart(3,"0")} — ${money(s.total)}</strong><span class="badge ${statusClass(s.status)}">${statusLabel(s.status)}</span></div><div class="muted">${dateTimeBR(s.createdAt)} • ${paymentLabel(s.paymentMethod)}</div></div>`).join("")||`<div class="empty">Sem vendas.</div>`}</div>
    <div class="form-actions"><button class="secondary" id="editClient">Editar</button><button class="secondary" id="closeClient">Fechar</button></div>`);
  document.getElementById("closeClient").onclick=closeModal;
  document.getElementById("editClient").onclick=()=>clientModal(c);
}
const statusLabel=s=>({pendente:"Pendente",entregue:"Entregue",cancelado:"Cancelado"}[s]||s);
const statusClass=s=>s==="entregue"?"green":s==="cancelado"?"red":"orange";

async function renderOrders(){
  view.innerHTML=`<div class="toolbar"><input id="orderSearch" class="search" type="search" placeholder="Buscar número ou cliente"><div class="pill-tabs" id="orderFilters">${["all","pendente","entregue","cancelado"].map(s=>`<button class="pill ${s==="all"?"active":""}" data-status="${s}">${s==="all"?"Todos":statusLabel(s)}</button>`).join("")}</div></div><div id="ordersTable"></div>`;
  let status="all";
  const paint=async()=>{
    const rows=await window.giro.sales.list({search:document.getElementById("orderSearch").value,status});
    document.getElementById("ordersTable").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Data</th></tr></thead><tbody>${rows.map(s=>`<tr data-order="${s.id}" class="clickable"><td><strong>#${String(s.orderNumber).padStart(3,"0")}</strong></td><td>${esc(s.clientName)}</td><td>${money(s.total)}</td><td>${esc(paymentLabel(s.paymentMethod))}${s.installmentCount>1?` ${s.installmentCount}x`:""}</td><td><span class="badge ${statusClass(s.status)}">${statusLabel(s.status)}</span></td><td>${dateTimeBR(s.createdAt)}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum pedido.</div></td></tr>`}</tbody></table></div>`;
    document.querySelectorAll("[data-order]").forEach(r=>r.onclick=()=>orderDetail(r.dataset.order));
  };
  document.getElementById("orderSearch").oninput=paint;
  document.querySelectorAll("#orderFilters .pill").forEach(b=>b.onclick=()=>{status=b.dataset.status;document.querySelectorAll("#orderFilters .pill").forEach(x=>x.classList.toggle("active",x===b));paint()});
  await paint();
}
async function orderDetail(id){
  const d=await window.giro.sales.get(id);if(!d)return;
  const s=d.sale;
  const instRows=d.installments?.length?`<div class="panel" style="margin-top:14px"><h2>Parcelas</h2>${d.installments.map(i=>`<div class="list-card"><div class="row-between"><div>Parcela ${i.installmentNumber} • vence ${dateBR(i.dueDate)}</div><strong>${money(i.amount)}</strong></div><div class="muted">${i.status==="paga"?"Pago":"Em aberto"}</div></div>`).join("")}</div>`:"";
  openModal(`Pedido #${String(s.orderNumber).padStart(3,"0")}`,`
    <div class="row-between"><span class="badge ${statusClass(s.status)}">${statusLabel(s.status)}</span><span class="muted">${dateTimeBR(s.createdAt)}</span></div>
    <div class="detail-grid" style="margin-top:14px">
      <div class="detail-item"><small>Cliente</small><strong>${esc(s.clientName)}</strong></div>
      <div class="detail-item"><small>Pagamento</small><strong>${paymentLabel(s.paymentMethod)}${s.installmentCount>1?` em ${s.installmentCount}x`:""}</strong></div>
      <div class="detail-item"><small>Juros</small><strong>${Number(s.interestRate||0).toLocaleString("pt-BR")}%</strong></div>
    </div>
    <div class="panel" style="margin-top:14px"><h2>Itens</h2>${d.items.map(i=>`<div class="list-card"><div class="row-between"><div><strong>${esc(i.productName)}</strong><div class="muted">${i.quantity} ${esc(i.unit)} × ${money(i.unitPrice)} ${i.discount?`• -${i.discount}%`:""}</div></div><strong>${money(i.subtotal)}</strong></div></div>`).join("")}</div>
    <div class="total-box"><div class="total-line"><span>Subtotal</span><strong>${money(s.subtotal)}</strong></div><div class="total-line"><span>Desconto</span><strong>- ${money(s.totalDiscount)}</strong></div><div class="total-line main"><span>Total</span><strong style="color:var(--primary)">${money(s.total)}</strong></div></div>
    ${s.observations?`<div class="panel" style="margin-top:14px"><strong>Observações</strong><div style="margin-top:6px">${esc(s.observations)}</div></div>`:""}
    ${instRows}
    <div class="form-actions">
      <button class="secondary" id="pdfOrder">Gerar PDF</button>
      ${s.status==="pendente"?`<button class="primary" id="deliverOrder">Marcar entregue</button>`:""}
      ${s.status!=="cancelado"?`<button class="secondary" id="cancelOrder">Cancelar pedido</button>`:""}
    </div>`);
  document.getElementById("pdfOrder").onclick=async()=>{const p=await window.giro.orderPdf(id);if(p)notify("PDF salvo com sucesso.")};
  const del=document.getElementById("deliverOrder");if(del)del.onclick=async()=>{await window.giro.sales.updateStatus(id,"entregue");closeModal();notify("Pedido marcado como entregue.");renderOrders()};
  const cancel=document.getElementById("cancelOrder");if(cancel)cancel.onclick=async()=>{if(confirm("Cancelar pedido? O estoque dos itens será restaurado.")){await window.giro.sales.updateStatus(id,"cancelado");closeModal();notify("Pedido cancelado e estoque restaurado.");renderOrders()}};
}

async function renderFinancial(){
  view.innerHTML=`<div class="cards"><div class="card" id="finTotal"><div class="metric-label">Total de parcelas</div><div class="metric">...</div></div><div class="card" id="finOverdue"><div class="metric-label">Vencido</div><div class="metric">...</div></div><div class="card" id="finPending"><div class="metric-label">A Vencer</div><div class="metric">...</div></div><div class="card" id="finPaid"><div class="metric-label">Pago</div><div class="metric">...</div></div></div>
  <div class="toolbar" style="margin-top:18px"><input id="instSearch" class="search" type="search" placeholder="Buscar cliente"><div class="pill-tabs" id="instFilters">${["all","vencida","pendente","paga"].map(s=>`<button class="pill ${s==="all"?"active":""}" data-inst="${s}">${s==="all"?"Todos":s==="paga"?"Pagas":s==="vencida"?"Vencidas":"A vencer"}</button>`).join("")}</div></div><div id="instTable"></div>`;
  let filter="all";
  const paint=async()=>{
    const rows=await window.giro.installments.list({status:filter,search:document.getElementById("instSearch").value});
    const all=await window.giro.installments.list({status:"all"});
    const total=all.reduce((a,i)=>a+Number(i.amount||0),0), overdue=all.filter(i=>i.status==="vencida").reduce((a,i)=>a+Number(i.amount-i.amountPaid||0),0), pending=all.filter(i=>i.status==="pendente").reduce((a,i)=>a+Number(i.amount-i.amountPaid||0),0), paid=all.filter(i=>i.status==="paga").reduce((a,i)=>a+Number(i.amountPaid||0),0);
    document.getElementById("finTotal").querySelector(".metric").textContent=money(total);
    document.getElementById("finOverdue").querySelector(".metric").textContent=money(overdue);
    document.getElementById("finPending").querySelector(".metric").textContent=money(pending);
    document.getElementById("finPaid").querySelector(".metric").textContent=money(paid);
    document.getElementById("instTable").innerHTML=`<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td>#${String(i.orderNumber||0).padStart(3,"0")}</td><td>${esc(i.clientName||"Avulso")}</td><td>${i.installmentNumber}</td><td>${dateBR(i.dueDate)}</td><td>${money(i.amount)}</td><td><span class="badge ${i.status==="paga"?"green":i.status==="vencida"?"red":"orange"}">${i.status==="paga"?"Paga":i.status==="vencida"?"Vencida":"A vencer"}</span></td><td>${i.status!=="paga"?`<button class="secondary" data-pay="${i.id}">Registrar pagamento</button>`:""}</td></tr>`).join("")||`<tr><td colspan="7"><div class="empty">Nenhuma parcela encontrada.</div></td></tr>`}</tbody></table></div>`;
    document.querySelectorAll("[data-pay]").forEach(b=>b.onclick=async()=>{await window.giro.installments.pay(b.dataset.pay,"dinheiro");notify("Pagamento registrado.");paint()});
  };
  document.getElementById("instSearch").oninput=paint;
  document.querySelectorAll("#instFilters .pill").forEach(b=>b.onclick=()=>{filter=b.dataset.inst;document.querySelectorAll("#instFilters .pill").forEach(x=>x.classList.toggle("active",x===b));paint()});
  await paint();
}

async function renderExpenses(){
  const rows=await window.giro.expenses.list();
  const total=rows.reduce((a,e)=>a+Number(e.amount||0),0);
  view.innerHTML=`<div class="cards"><div class="card"><div class="metric-label">Total registrado</div><div class="metric">${money(total)}</div></div><div class="card"><div class="metric-label">Despesas</div><div class="metric">${rows.length}</div></div><div class="card"><div class="metric-label">Este mês</div><div class="metric">${money(rows.filter(e=>e.date?.startsWith(ym())).reduce((a,e)=>a+Number(e.amount||0),0))}</div></div><div class="card"><div class="metric-label">Categoria mais usada</div><div class="metric">${esc(expenseLabels[Object.entries(rows.reduce((m,e)=>(m[e.category]=(m[e.category]||0)+Number(e.amount||0),m),{})).sort((a,b)=>b[1]-a[1])[0]?.[0]]||"-")}</div></div></div>
    <div class="toolbar" style="margin-top:18px"><span class="muted">Registros de despesas</span><button class="primary" id="addExpense">+ Despesa</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td>${esc(e.description)}</td><td>${esc(expenseLabels[e.category]||e.category)}</td><td>${dateBR(e.date)}</td><td>${money(e.amount)}</td><td><button class="secondary" data-del-exp="${e.id}">Excluir</button></td></tr>`).join("")||`<tr><td colspan="5"><div class="empty">Nenhuma despesa.</div></td></tr>`}</tbody></table></div>`;
  document.getElementById("addExpense").onclick=()=>expenseModal();
  document.querySelectorAll("[data-del-exp]").forEach(b=>b.onclick=async()=>{if(confirm("Excluir esta despesa?")){await window.giro.expenses.delete(b.dataset.delExp);notify("Despesa excluída.");renderExpenses()}});
}
function expenseModal(){
  openModal("Nova despesa",`<div class="form-grid">
    <div class="form-group"><label>Descrição *</label><input id="eDesc"></div>
    <div class="form-group"><label>Categoria</label><select id="eCat">${Object.entries(expenseLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></div>
    <div class="form-group"><label>Valor *</label><input id="eAmount" type="number" step="0.01"></div>
    <div class="form-group"><label>Data</label><input id="eDate" type="date" value="${today()}"></div>
    <div class="form-group full"><label>Observações</label><textarea id="eObs"></textarea></div>
  </div><div class="form-actions"><button class="secondary" id="cancelE">Cancelar</button><button class="primary" id="saveE">Salvar</button></div>`);
  document.getElementById("cancelE").onclick=closeModal;
  document.getElementById("saveE").onclick=async()=>{
    const desc=document.getElementById("eDesc").value.trim(), amount=Number(document.getElementById("eAmount").value||0);
    if(desc.length<2||amount<=0){notify("Informe descrição e valor.",true);return}
    await window.giro.expenses.save({description:desc,category:document.getElementById("eCat").value,amount,date:document.getElementById("eDate").value,observations:document.getElementById("eObs").value});
    closeModal();notify("Despesa registrada.");renderExpenses();
  };
}

async function renderReports(){
  const r=await window.giro.reports();
  const pct=r.monthGoal>0?Math.min(r.monthSales/r.monthGoal*100,100):0;
  const max=Math.max(...r.week.map(x=>x.total),1);
  view.innerHTML=`<div class="cards">
    <div class="card"><div class="metric-label">Vendas Mês</div><div class="metric">${money(r.monthSales)}</div></div>
    <div class="card"><div class="metric-label">Meta</div><div class="metric">${money(r.monthGoal)}</div></div>
    <div class="card"><div class="metric-label">Despesas</div><div class="metric">${money(r.monthExpenses)}</div></div>
    <div class="card"><div class="metric-label">Resultado</div><div class="metric">${money(r.monthSales-r.monthExpenses)}</div></div>
  </div>
  <div class="grid2">
    <div class="panel"><h2>Meta vs Realizado</h2><div class="progress"><span style="width:${pct}%"></span></div><div class="row-between" style="margin-top:8px"><span>${money(r.monthSales)}</span><span>${pct.toFixed(0)}%</span></div></div>
    <div class="panel"><h2>Vendas — últimos 7 dias</h2><div class="bar-chart">${r.week.map(x=>`<div class="bar-col"><div class="bar-val">${x.total?money(x.total):""}</div><div class="bar" style="height:${Math.max(2,x.total/max*120)}px"></div><div class="bar-label">${x.label}</div></div>`).join("")}</div></div>
  </div>
  <div class="grid2">
    <div class="panel"><h2>Top Produtos</h2>${r.topProducts.map((x,i)=>`<div class="list-card"><div class="row-between"><span>${i+1}. ${esc(x.name)}</span><strong>${money(x.total)}</strong></div></div>`).join("")||`<div class="empty">Sem vendas ainda.</div>`}</div>
    <div class="panel"><h2>Top Clientes</h2>${r.topClients.map((x,i)=>`<div class="list-card"><div class="row-between"><span>${i+1}. ${esc(x.name)}</span><strong>${money(x.total)}</strong></div></div>`).join("")||`<div class="empty">Sem vendas ainda.</div>`}</div>
  </div>`;
}

async function renderAssistant(){
  const rows=await window.giro.assistant();
  view.innerHTML=rows.length?rows.map(x=>`<div class="panel" style="margin-bottom:10px;border-left:4px solid ${x.type==="danger"?"var(--danger)":x.type==="warning"?"var(--warning)":"var(--primary)"}" ${x.page?`data-page="${x.page}"`:""}><div class="row-between"><div><h2>${esc(x.title)}</h2><div class="muted">${esc(x.description)}</div></div>${x.page?"→":""}</div></div>`).join(""):`<div class="panel"><div class="empty"><div style="font-size:52px">✓</div><h2>Tudo certo!</h2><div>Nenhuma recomendação no momento. Continue vendendo!</div></div></div>`;
  document.querySelectorAll("#view [data-page]").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
}

async function renderVisits(){
  const clients=await window.giro.clients.list("");
  const from=today(), to=(()=>{const d=new Date();d.setDate(d.getDate()+6);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`})();
  const [todayVisits,plans]=await Promise.all([window.giro.visits.today(),window.giro.visits.plans(from,to)]);
  view.innerHTML=`<div class="grid2">
    <div class="panel"><div class="row-between"><h2>Hoje — ${dateBR(today())}</h2><button class="primary" id="checkInBtn">+ Check-in</button></div>
      ${todayVisits.map(v=>`<div class="list-card"><div class="row-between"><strong>${esc(v.clientName||"Cliente")}</strong><span>${v.checkOutAt?`<span class="badge green">Finalizada</span>`:`<span class="badge orange">Em visita</span>`}</span></div><div class="muted">${dateTimeBR(v.checkInAt)} ${v.durationMinutes!=null?`• ${v.durationMinutes} min`:""}</div>${v.checkOutAt?"":`<div class="form-actions" style="justify-content:flex-start"><button class="secondary" data-checkout="${v.id}">Check-out</button></div>`}</div>`).join("")||`<div class="empty">Nenhuma visita hoje.</div>`}
    </div>
    <div class="panel"><div class="row-between"><h2>Plano dos próximos dias</h2><button class="primary" id="addPlanBtn">+ Planejar</button></div>
      ${plans.map(p=>`<div class="list-card"><div class="row-between"><div><strong>${esc(p.clientName||"Cliente")}</strong><div class="muted">${dateBR(p.plannedDate)} ${p.notes?"• "+esc(p.notes):""}</div></div><span class="badge ${p.status==="concluida"?"green":p.status==="cancelada"?"red":"orange"}">${p.status}</span></div>${p.status==="pendente"?`<div class="form-actions" style="justify-content:flex-start"><button class="secondary" data-plan-check="${p.id}" data-plan-client="${p.clientId}">Check-in</button><button class="secondary" data-plan-cancel="${p.id}">Cancelar</button></div>`:""}</div>`).join("")||`<div class="empty">Nenhuma visita planejada.</div>`}
    </div>
  </div>`;
  document.getElementById("checkInBtn").onclick=()=>checkInModal(clients);
  document.getElementById("addPlanBtn").onclick=()=>planModal(clients,from);
  document.querySelectorAll("[data-checkout]").forEach(b=>b.onclick=()=>checkoutModal(b.dataset.checkout));
  document.querySelectorAll("[data-plan-cancel]").forEach(b=>b.onclick=async()=>{await window.giro.visits.cancelPlan(b.dataset.planCancel);notify("Plano cancelado.");renderVisits()});
  document.querySelectorAll("[data-plan-check]").forEach(b=>b.onclick=async()=>{await window.giro.visits.completePlan(b.dataset.planCheck,b.dataset.planClient,"");notify("Visita iniciada pelo plano.");renderVisits()});
}
function getGeo(){
  return new Promise(resolve=>{
    if(!navigator.geolocation)return resolve({latitude:null,longitude:null});
    navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),()=>resolve({latitude:null,longitude:null}),{timeout:3500});
  });
}
function checkInModal(clients){
  openModal("Check-in",`<div class="form-group"><label>Cliente</label><select id="visitClient">${clients.map(c=>`<option value="${c.id}">${esc(c.nomeFantasia)}</option>`).join("")}</select></div><div class="form-actions"><button class="primary" id="doCheckIn">Realizar Check-in</button></div>`);
  document.getElementById("doCheckIn").onclick=async()=>{const geo=await getGeo();await window.giro.visits.checkIn(document.getElementById("visitClient").value,geo.latitude,geo.longitude);closeModal();notify("Check-in realizado.");renderVisits()};
}
function checkoutModal(id){
  openModal("Check-out",`<div class="form-group"><label>Observações</label><textarea id="visitNotes"></textarea></div><div class="form-actions"><button class="primary" id="doCheckout">Finalizar visita</button></div>`);
  document.getElementById("doCheckout").onclick=async()=>{await window.giro.visits.checkOut(id,document.getElementById("visitNotes").value);closeModal();notify("Check-out realizado.");renderVisits()};
}
function planModal(clients,from){
  const d=new Date();d.setDate(d.getDate()+0);
  openModal("Planejar visita",`<div class="form-grid"><div class="form-group"><label>Data</label><input id="planDate" type="date" value="${from}"></div><div class="form-group"><label>Cliente</label><select id="planClient">${clients.map(c=>`<option value="${c.id}">${esc(c.nomeFantasia)}</option>`).join("")}</select></div><div class="form-group full"><label>Observações</label><textarea id="planNotes"></textarea></div></div><div class="form-actions"><button class="primary" id="savePlan">Planejar Visita</button></div>`);
  document.getElementById("savePlan").onclick=async()=>{await window.giro.visits.addPlan({plannedDate:document.getElementById("planDate").value,clientId:document.getElementById("planClient").value,notes:document.getElementById("planNotes").value});closeModal();notify("Visita planejada.");renderVisits()};
}

function renderSettings(){
  window.giro.settings.get().then(s=>{
    const mode=localStorage.getItem("giro_theme")||"light";
    view.innerHTML=`<div class="split">
      <div class="panel"><h2>Perfil</h2><div class="form-group"><label>Nome do Vendedor</label><input id="sSeller" value="${esc(s.config?.sellerName||"")}"></div><div class="form-group"><label>Nome da Empresa</label><input id="sCompany" value="${esc(s.config?.companyName||"")}"></div><div class="form-group"><label>Telefone</label><input id="sPhone" value="${esc(s.config?.phone||"")}"></div><div class="form-actions"><button class="primary" id="saveProfile">Salvar Perfil</button></div></div>
      <div class="panel"><h2>Aparência</h2><div class="pill-tabs" id="themeTabs">${["light","dark","system"].map(x=>`<button class="pill ${mode===x?"active":""}" data-theme="${x}">${x==="light"?"Claro":x==="dark"?"Escuro":"Sistema"}</button>`).join("")}</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><h2>Meta do Mês</h2><div class="form-grid"><div class="form-group"><label>Meta</label><input id="sGoal" type="number" step="0.01" value="${s.goal||0}"></div></div><div class="form-actions"><button class="primary" id="saveGoal">Salvar Meta</button></div></div>
    <div class="panel" style="margin-top:16px"><h2>Dados</h2><div class="row-between" style="gap:10px;flex-wrap:wrap"><button class="secondary" id="exportJson">Exportar Backup JSON</button><button class="secondary" id="importJson">Importar Backup JSON</button><button class="secondary" id="clearData" style="color:var(--danger);border-color:#f2b8b5">Limpar Todos os Dados</button></div><p class="muted">O backup completo inclui configuração, clientes, produtos, vendas, itens, parcelas, visitas, planos, despesas e metas.</p></div>
    <div class="panel" style="margin-top:16px"><h2>Sobre</h2><p><strong>Giro Vendas Desktop 1.2.0</strong></p><p class="muted">Adaptação do projeto mobile original para Windows.</p></div>`;
    document.getElementById("saveProfile").onclick=async()=>{await window.giro.settings.saveProfile({sellerName:document.getElementById("sSeller").value,companyName:document.getElementById("sCompany").value,phone:document.getElementById("sPhone").value});await refreshCompany();notify("Perfil atualizado.")};
    document.getElementById("saveGoal").onclick=async()=>{await window.giro.settings.saveGoal(document.getElementById("sGoal").value);notify("Meta atualizada.")};
    document.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{setTheme(b.dataset.theme);document.querySelectorAll("[data-theme]").forEach(x=>x.classList.toggle("active",x===b))});
    document.getElementById("exportJson").onclick=exportBackup;
    document.getElementById("importJson").onclick=importBackup;
    document.getElementById("clearData").onclick=async()=>{const ok=await window.giro.settings.clearData();if(ok){notify("Dados limpos.");showSetup();}};
  });
}
async function exportBackup(){const p=await window.giro.settings.exportBackup();if(p)notify("Backup exportado com sucesso.")};
async function importBackup(){try{const r=await window.giro.settings.importBackup();if(r){notify(`Importação concluída: ${r.rows} registros.`);await refreshCompany();navigate("home")}}catch(e){notify("Não foi possível importar o backup.",true)}}

function renderSell(){
  wizard=wizard||{};
  if(!wizard.items) wizard={step:1,clientId:null,clientName:"",items:[],paymentMethod:"dinheiro",installmentCount:1,interestRate:0,observations:""};
  renderSellStep();
}
async function renderSellStep(){
  const total=wizard.items.reduce((a,i)=>a+Number(i.subtotal||0),0);
  const discount=wizard.items.reduce((a,i)=>a+(Number(i.quantity||0)*Number(i.unitPrice||0)-Number(i.subtotal||0)),0);
  const titles=["Cliente","Produtos","Carrinho","Pagamento","Confirmação"];
  view.innerHTML=`<div class="stepper">${titles.map((t,i)=>`<div class="step ${wizard.step===i+1?"active":""}">${i+1}. ${t}</div>`).join("")}</div><div id="saleStep"></div>`;
  if(wizard.step===1) return saleStepClient();
  if(wizard.step===2) return saleStepProducts();
  if(wizard.step===3) return saleStepCart(total,discount);
  if(wizard.step===4) return saleStepPayment(total);
  return saleStepConfirmation(total,discount);
}
async function saleStepClient(){
  const clients=await window.giro.clients.list("");
  view.querySelector("#saleStep").innerHTML=`<div class="sale-grid"><div class="panel"><h2>Escolha o cliente</h2><input id="saleClientSearch" class="search" type="search" placeholder="Buscar cliente..." style="width:100%;margin-bottom:10px"><div id="clientChoices"></div></div><div class="panel"><h2>Resumo</h2><p>Cliente selecionado: <strong>${esc(wizard.clientName||"Nenhum")}</strong></p><div class="form-actions"><button class="primary" ${wizard.clientId?"":"disabled"} id="nextClient">Próximo →</button></div></div></div>`;
  const paint=()=>{const q=document.getElementById("saleClientSearch").value.toLowerCase();const arr=clients.filter(c=>c.nomeFantasia.toLowerCase().includes(q));document.getElementById("clientChoices").innerHTML=arr.map(c=>`<button class="list-card" style="width:100%;text-align:left;border:${wizard.clientId===c.id?"2px solid var(--primary)":"1px solid var(--border)"}" data-sale-client="${c.id}"><strong>${esc(c.nomeFantasia)}</strong><div class="muted">${esc(c.phone)} • ${esc(c.city||"")}</div></button>`).join("")||`<div class="empty">Cadastre um cliente primeiro.</div>`;document.querySelectorAll("[data-sale-client]").forEach(b=>b.onclick=()=>{const c=clients.find(x=>x.id===b.dataset.saleClient);wizard.clientId=c.id;wizard.clientName=c.nomeFantasia;saleStepClient()})};
  document.getElementById("saleClientSearch").oninput=paint;paint();
  document.getElementById("nextClient").onclick=()=>{wizard.step=2;renderSellStep()};
}
async function saleStepProducts(){
  const products=await window.giro.products.list("");
  view.querySelector("#saleStep").innerHTML=`<div class="sale-grid"><div class="panel"><div class="row-between"><h2>Adicionar produtos</h2><input id="saleProductSearch" class="search" type="search" placeholder="Nome ou código"></div><div id="saleProducts" class="product-grid" style="margin-top:12px"></div></div><div class="panel"><h2>Resumo</h2>${wizard.items.map(i=>`<div class="list-card"><div class="row-between"><span>${esc(i.productName)}</span><strong>${i.quantity} ${esc(i.unit)}</strong></div><div class="muted">${money(i.subtotal)}</div></div>`).join("")||`<div class="empty">Nenhum produto adicionado.</div>`}<div class="form-actions"><button class="secondary" id="backP">← Voltar</button><button class="primary" id="nextP" ${wizard.items.length?"":"disabled"}>Próximo →</button></div></div></div>`;
  const paint=()=>{const q=document.getElementById("saleProductSearch").value.toLowerCase();const arr=products.filter(p=>p.name.toLowerCase().includes(q)||(p.barcode||"").includes(q));document.getElementById("saleProducts").innerHTML=arr.map(p=>`<button class="product-tile" data-sale-product="${p.id}"><strong>${esc(p.name)}</strong><small>${money(p.price1)} • Estoque: ${p.stockCurrent} ${esc(p.unit)}</small>${wizard.items.find(i=>i.productId===p.id)?`<span class="badge green" style="margin-top:7px">No carrinho</span>`:""}</button>`).join("")||`<div class="empty">Nenhum produto.</div>`;document.querySelectorAll("[data-sale-product]").forEach(b=>b.onclick=()=>addProductModal(products.find(p=>p.id===b.dataset.saleProduct)))};
  document.getElementById("saleProductSearch").oninput=paint;paint();
  document.getElementById("backP").onclick=()=>{wizard.step=1;renderSellStep()};document.getElementById("nextP").onclick=()=>{wizard.step=3;renderSellStep()};
}
function addProductModal(p){
  if(!p)return;
  openModal("Adicionar produto",`<div class="detail-grid"><div class="detail-item"><small>Produto</small><strong>${esc(p.name)}</strong></div><div class="detail-item"><small>Preço</small><strong>${money(p.price1)}</strong></div><div class="detail-item"><small>Estoque</small><strong>${p.stockCurrent} ${esc(p.unit)}</strong></div></div><div class="form-grid" style="margin-top:14px"><div class="form-group"><label>Quantidade</label><input id="spQty" type="number" min="0.01" step="0.01" value="${Math.min(1,Math.max(p.stockCurrent,1))}"></div><div class="form-group"><label>Desconto (%)</label><input id="spDisc" type="number" min="0" step="0.01" value="0"></div></div><div id="spTotal" class="card" style="margin-top:12px"></div><div class="form-actions"><button class="secondary" id="spCancel">Cancelar</button><button class="primary" id="spAdd">Adicionar</button></div>`);
  const calc=()=>{const q=Number(document.getElementById("spQty").value||0),d=Number(document.getElementById("spDisc").value||0),sub=q*p.price1*(1-d/100);document.getElementById("spTotal").innerHTML=`Subtotal: <strong>${money(sub)}</strong>`};["spQty","spDisc"].forEach(x=>document.getElementById(x).oninput=calc);calc();
  document.getElementById("spCancel").onclick=closeModal;document.getElementById("spAdd").onclick=()=>{let q=Number(document.getElementById("spQty").value||0),d=Number(document.getElementById("spDisc").value||0);if(q<=0){notify("Quantidade inválida.",true);return}if(p.stockCurrent>0)q=Math.min(q,p.stockCurrent);const existing=wizard.items.find(i=>i.productId===p.id);const sub=q*p.price1*(1-d/100);if(existing){existing.quantity=q;existing.discount=d;existing.subtotal=sub}else wizard.items.push({productId:p.id,productName:p.name,quantity:q,unitPrice:p.price1,discount:d,subtotal:sub,priceTable:1,unit:p.unit,stockAvailable:p.stockCurrent});closeModal();renderSellStep()};
}
function saleStepCart(total,discount){
  view.querySelector("#saleStep").innerHTML=`<div class="panel"><div class="row-between"><div><h2>Carrinho</h2><div class="muted">${esc(wizard.clientName)}</div></div><button class="secondary" id="backCart">← Produtos</button></div>${wizard.items.map((i,idx)=>`<div class="cart-row"><div><strong>${esc(i.productName)}</strong><div class="muted">${esc(i.unit)} • ${money(i.unitPrice)}</div></div><input data-q="${idx}" type="number" min="0.01" step="0.01" value="${i.quantity}"><input data-d="${idx}" type="number" min="0" step="0.01" value="${i.discount}"><strong>${money(i.subtotal)}</strong><button class="secondary" data-remove="${idx}">Remover</button></div>`).join("")}
    <div class="form-group" style="margin-top:14px"><label>Observações do pedido</label><textarea id="saleObs">${esc(wizard.observations)}</textarea></div><div class="total-box"><div class="total-line"><span>Subtotal</span><strong>${money(total+discount)}</strong></div><div class="total-line"><span>Desconto</span><strong>- ${money(discount)}</strong></div><div class="total-line main"><span>Total</span><strong style="color:var(--primary)">${money(total)}</strong></div></div><div class="form-actions"><button class="secondary" id="backCart2">← Voltar</button><button class="primary" id="nextCart">Próximo →</button></div></div>`;
  document.getElementById("backCart").onclick=()=>{wizard.step=2;renderSellStep()};document.getElementById("backCart2").onclick=()=>{wizard.step=2;renderSellStep()};document.getElementById("nextCart").onclick=()=>{wizard.observations=document.getElementById("saleObs").value;wizard.step=4;renderSellStep()};
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{wizard.items.splice(Number(b.dataset.remove),1);renderSellStep()});
  document.querySelectorAll("[data-q]").forEach(inp=>inp.onchange=()=>{const i=wizard.items[Number(inp.dataset.q)];i.quantity=Number(inp.value)||1;i.subtotal=i.quantity*i.unitPrice*(1-i.discount/100);renderSellStep()});
  document.querySelectorAll("[data-d]").forEach(inp=>inp.onchange=()=>{const i=wizard.items[Number(inp.dataset.d)];i.discount=Math.max(0,Number(inp.value)||0);i.subtotal=i.quantity*i.unitPrice*(1-i.discount/100);renderSellStep()});
}
function saleStepPayment(total){
  const interest=Number(wizard.interestRate||0), totalJ=total*(1+interest/100), inst=Math.max(1,Number(wizard.installmentCount||1)), val=totalJ/inst;
  view.querySelector("#saleStep").innerHTML=`<div class="panel"><div class="row-between"><div><h2>Pagamento</h2><div class="muted">Total do pedido</div><div class="metric" style="color:var(--primary)">${money(total)}</div></div><span class="badge green">Etapa 4/5</span></div><h2 style="margin-top:18px">Forma de pagamento</h2><div class="payment-grid">${["dinheiro","cartao","boleto","pix","prazo"].map(m=>`<button class="pay-card ${wizard.paymentMethod===m?"active":""}" data-pay-method="${m}">${paymentLabel(m)}</button>`).join("")}</div>
  ${["cartao","prazo"].includes(wizard.paymentMethod)?`<div class="form-grid" style="margin-top:16px"><div class="form-group"><label>Número de parcelas</label><input id="saleInst" type="number" min="1" max="99" value="${inst}"></div><div class="form-group"><label>Juros (%)</label><input id="saleInterest" type="number" min="0" step="0.01" value="${interest}"></div></div><div class="card" style="margin-top:14px"><div class="row-between"><span>Total com juros</span><strong>${money(totalJ)}</strong></div>${Array.from({length:inst},(_,i)=>`<div class="list-card" style="margin-top:7px"><div class="row-between"><span>Parcela ${i+1}${wizard.paymentMethod==="prazo"?` • ${dateBR(new Date(Date.now()+86400000*30*(i+1)).toISOString())}`:""}</span><strong>${money(val)}</strong></div></div>`).join("")}</div>`:""}
  <div class="form-actions"><button class="secondary" id="backPay">← Carrinho</button><button class="primary" id="nextPay">Próximo →</button></div></div>`;
  document.querySelectorAll("[data-pay-method]").forEach(b=>b.onclick=()=>{wizard.paymentMethod=b.dataset.payMethod;if(!["cartao","prazo"].includes(wizard.paymentMethod)){wizard.installmentCount=1;wizard.interestRate=0}renderSellStep()});
  const si=document.getElementById("saleInst");if(si)si.oninput=()=>{wizard.installmentCount=Math.max(1,Math.min(99,Number(si.value)||1));renderSellStep()};
  const sr=document.getElementById("saleInterest");if(sr)sr.oninput=()=>{wizard.interestRate=Math.max(0,Number(sr.value)||0);renderSellStep()};
  document.getElementById("backPay").onclick=()=>{wizard.step=3;renderSellStep()};
  document.getElementById("nextPay").onclick=()=>{wizard.step=5;renderSellStep()};
}
async function saleStepConfirmation(total,discount){
  view.querySelector("#saleStep").innerHTML=`<div class="panel" style="max-width:780px;margin:0 auto;text-align:center"><div style="font-size:72px;color:var(--primary)">✓</div><h2>Confirmar pedido</h2><div class="metric" style="color:var(--primary)">${money(total)}</div><p class="muted">${esc(wizard.clientName)} • ${paymentLabel(wizard.paymentMethod)}${wizard.installmentCount>1?` em ${wizard.installmentCount}x`:""}</p><div class="card" style="margin-top:18px;text-align:left"><div class="row-between"><span>Itens</span><strong>${wizard.items.length} produto(s)</strong></div><div class="row-between" style="margin-top:6px"><span>Desconto</span><strong>- ${money(discount)}</strong></div><div class="row-between" style="margin-top:6px"><span>Total</span><strong>${money(total)}</strong></div>${wizard.interestRate>0?`<div class="row-between" style="margin-top:6px"><span>Juros</span><strong>${wizard.interestRate}%</strong></div>`:""}</div><div class="form-actions" style="justify-content:center"><button class="secondary" id="backConf">← Voltar</button><button class="primary" id="confirmSale">Confirmar e salvar pedido</button></div></div>`;
  document.getElementById("backConf").onclick=()=>{wizard.step=4;renderSellStep()};
  document.getElementById("confirmSale").onclick=async()=>{
    try{
      const result=await window.giro.sales.create({clientId:wizard.clientId,items:wizard.items,paymentMethod:wizard.paymentMethod,installmentCount:wizard.installmentCount,interestRate:wizard.interestRate,observations:wizard.observations});
      view.innerHTML=`<div class="panel" style="max-width:680px;margin:30px auto;text-align:center"><div style="font-size:78px;color:var(--primary)">✓</div><h2>Pedido confirmado!</h2><div class="metric" style="color:var(--primary)">#${String(result.orderNumber).padStart(3,"0")}</div><p class="muted">${money(result.total)} • ${esc(wizard.clientName)}</p><div class="form-actions" style="justify-content:center"><button class="secondary" id="pdfNew">Gerar PDF</button><button class="primary" id="goHomeSale">Voltar ao início</button></div><div class="form-actions" style="justify-content:center"><button class="secondary" id="newAgain">Nova venda</button><button class="secondary" id="viewOrder">Ver pedido</button></div></div>`;
      document.getElementById("pdfNew").onclick=async()=>{const p=await window.giro.orderPdf(result.id);if(p)notify("PDF salvo.")};
      document.getElementById("goHomeSale").onclick=()=>{resetWizard();navigate("home")};
      document.getElementById("newAgain").onclick=()=>{resetWizard();navigate("sell")};
      document.getElementById("viewOrder").onclick=()=>{resetWizard();navigate("orders");setTimeout(()=>orderDetail(result.id),0)};
      notify(`Pedido #${String(result.orderNumber).padStart(3,"0")} confirmado.`);
    }catch(e){notify("Erro ao salvar o pedido.",true);console.error(e)}
  };
}
function resetWizard(){wizard={step:1,clientId:null,clientName:"",items:[],paymentMethod:"dinheiro",installmentCount:1,interestRate:0,observations:""}}

init();
