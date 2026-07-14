const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwyTlQDtXI9xA3-j3xvkXHv7tHXKOhathOvHPx5mTRExUGdCl6BkHIMAaUZXDFCgGJT-w/exec";
const STORAGE_KEY = "pollo-pos-state-v1";
const DEMO_SESSION = { id: "demo-admin", name: "Demo", role: "admin" };

const defaultState = {
  session: DEMO_SESSION,
  currentView: "dashboard",
  syncQueue: [],
  cashRegister: {
    isOpen: false,
    openingAmount: 0,
    currentCash: 0,
    openedAt: null,
    closedAt: null,
  },
  products: [
    { id: "P001", barcode: "750100000001", name: "Pechuga fresca", category: "Pollo", price: 129, wholesalePrice: 119, unitType: "kg", stock: 48.6 },
    { id: "P002", barcode: "750100000002", name: "Pierna y muslo", category: "Pollo", price: 84, wholesalePrice: 77, unitType: "kg", stock: 62.4 },
    { id: "P003", barcode: "750100000003", name: "Alitas marinadas", category: "Preparados", price: 99, wholesalePrice: 92, unitType: "kg", stock: 24.2 },
    { id: "P004", barcode: "750100000004", name: "Huevo blanco 18 pzas", category: "Abarrotes", price: 58, wholesalePrice: 54, unitType: "piece", stock: 72 },
    { id: "P005", barcode: "750100000005", name: "Milanesa empanizada", category: "Preparados", price: 142, wholesalePrice: 134, unitType: "kg", stock: 18.7 },
    { id: "P006", barcode: "750100000006", name: "Nuggets bolsa", category: "Congelados", price: 86, wholesalePrice: 79, unitType: "piece", stock: 33 },
  ],
  customers: [
    { id: "C001", name: "Público general", phone: "", wholesale: false, creditBalance: 0, priceTier: "retail" },
    { id: "C002", name: "Pollería El Centro", phone: "8110000000", wholesale: true, creditBalance: 1450, priceTier: "wholesale" },
  ],
  suppliers: [
    { id: "S001", name: "Avícola del Norte", phone: "8115550000" },
  ],
  expenses: [
    { id: crypto.randomUUID(), concept: "Hielo", amount: 220, date: today(), notes: "Caja chica" },
  ],
  purchases: [
    { id: crypto.randomUUID(), supplierId: "S001", productId: "P004", quantity: 24, unitCost: 48, date: today() },
  ],
  sales: [],
  credits: [
    { id: crypto.randomUUID(), customerId: "C002", type: "sale", amount: 1450, paid: 0, date: today(), notes: "Entrega semanal" },
  ],
  inventoryMovements: [],
  cart: [],
  pos: {
    search: "",
    category: "Todas",
    selectedCustomerId: "C001",
    barcode: "",
    manualWeight: "",
    reportRange: "daily",
  },
};

const state = loadState();

if (!state.inventoryMovements.length) {
  seedInventoryMovements();
}

const permissions = {
  admin: ["dashboard", "pos", "cash", "inventory", "purchases", "expenses", "customers", "credits", "reports", "settings"],
  cashier: ["dashboard", "pos", "cash", "reports"],
};

const views = {
  dashboard: { label: "Resumen" },
  pos: { label: "Punto de venta" },
  cash: { label: "Caja" },
  inventory: { label: "Inventario" },
  purchases: { label: "Compras" },
  expenses: { label: "Gastos" },
  customers: { label: "Clientes" },
  credits: { label: "Fiados" },
  reports: { label: "Reportes" },
  settings: { label: "Respaldo" },
};

const app = document.querySelector("#app");

window.addEventListener("online", flushSyncQueue);
document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

render();

function render() {
  if (!state.session) {
    state.session = structuredClone(DEMO_SESSION);
    persist();
  }
  app.innerHTML = renderShell();
}

function renderShell() {
  const userViews = permissions[state.session.role];
  const title = views[state.currentView].label;
  return `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>Pollo POS</h1>
          <p>${state.session.name}</p>
        </div>
        <nav class="nav">
          ${userViews.map((viewId) => `
            <button class="${state.currentView === viewId ? "active" : ""}" data-action="navigate" data-view="${viewId}">
              ${views[viewId].label}
            </button>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <strong>Sincronización</strong>
          <p>${navigator.onLine ? "En línea" : "Offline"} · Cola pendiente: ${state.syncQueue.length}</p>
          <button class="ghost-btn" data-action="sync-now">Sincronizar ahora</button>
        </div>
      </aside>
      <section class="content">
        <header class="topbar">
          <div>
            <h2>${title}</h2>
            <p>${topbarSubtitle()}</p>
          </div>
          <div class="topbar-actions">
            <span class="badge">Caja: ${state.cashRegister.isOpen ? "Abierta" : "Cerrada"}</span>
            <button class="ghost-btn" data-action="open-scale">Leer báscula</button>
            <button class="ghost-btn" data-action="logout">Salir</button>
          </div>
        </header>
        ${renderCurrentView()}
      </section>
    </main>
    <div id="modal-root"></div>
    <div id="ticket-root" class="hidden"></div>
  `;
}

function renderCurrentView() {
  switch (state.currentView) {
    case "dashboard": return renderDashboard();
    case "pos": return renderPOS();
    case "cash": return renderCash();
    case "inventory": return renderInventory();
    case "purchases": return renderPurchases();
    case "expenses": return renderExpenses();
    case "customers": return renderCustomers();
    case "credits": return renderCredits();
    case "reports": return renderReports();
    case "settings": return renderSettings();
    default: return "";
  }
}

function renderDashboard() {
  const todaySales = state.sales.filter((sale) => sale.date === today());
  const totals = summarizeSales(todaySales);
  return `
    <section class="grid dashboard-grid">
      ${renderStat("Ventas del día", formatCurrency(totals.total))}
      ${renderStat("Tickets", String(todaySales.length))}
      ${renderStat("Fiado pendiente", formatCurrency(sum(state.credits.map((item) => item.amount - item.paid))))}
      ${renderStat("Gastos del día", formatCurrency(sum(state.expenses.filter((e) => e.date === today()).map((e) => e.amount))))}
    </section>
    <section class="card">
      <div class="section-header">
        <div>
          <h3>Actividad reciente</h3>
          <p>Resumen operativo del negocio.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            ${recentActivity().map((row) => `
              <tr>
                <td>${row.time}</td>
                <td>${row.type}</td>
                <td>${row.label}</td>
                <td>${row.amount}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPOS() {
  const categories = ["Todas", ...new Set(state.products.map((product) => product.category))];
  const products = filteredProducts();
  return `
    <section class="pos-layout">
      <div class="grid">
        <article class="card">
          <div class="section-header">
            <div>
              <h3>Venta rápida</h3>
              <p>Productos por categoría, código de barras y lectura de báscula.</p>
            </div>
          </div>
          <div class="toolbar">
            <input name="search" data-field="pos.search" placeholder="Buscar producto..." value="${escapeAttr(state.pos.search)}" />
            <input name="barcode" data-field="pos.barcode" placeholder="Escanear código de barras..." value="${escapeAttr(state.pos.barcode)}" />
            <select data-field="pos.selectedCustomerId">
              ${state.customers.map((customer) => `<option value="${customer.id}" ${customer.id === state.pos.selectedCustomerId ? "selected" : ""}>${customer.name}</option>`).join("")}
            </select>
            <button class="ghost-btn" data-action="scan-barcode">Agregar por código</button>
          </div>
          <div class="categories">
            ${categories.map((category) => `
              <button class="${state.pos.category === category ? "active" : ""}" data-action="set-category" data-category="${category}">
                ${category}
              </button>
            `).join("")}
          </div>
          <div class="product-grid">
            ${products.map((product) => `
              <article class="product-card">
                <small>${product.category} · ${product.unitType === "kg" ? "Por kilo" : "Por pieza"}</small>
                <h4>${product.name}</h4>
                <p>${formatCurrency(displayPriceForCustomer(product))}</p>
                <small>Existencia: ${formatStock(product)}</small>
                <button data-action="add-product" data-product-id="${product.id}">Agregar</button>
              </article>
            `).join("") || `<p>No hay productos para ese filtro.</p>`}
          </div>
        </article>
      </div>
      <aside class="cart-panel">
        <div class="section-header">
          <div>
            <h3>Ticket actual</h3>
            <p>${selectedCustomer().name}</p>
          </div>
          <button class="ghost-btn" data-action="clear-cart">Vaciar</button>
        </div>
        <div class="toolbar">
          <input name="manualWeight" data-field="pos.manualWeight" placeholder="Peso manual kg" value="${escapeAttr(state.pos.manualWeight)}" />
          <button class="ghost-btn" data-action="assign-weight">Aplicar peso al último</button>
        </div>
        <div class="cart-list">
          ${state.cart.map((item) => `
            <article class="cart-row">
              <div class="cart-row-top">
                <strong>${item.name}</strong>
                <button class="danger-btn" data-action="remove-cart-item" data-item-id="${item.id}">Quitar</button>
              </div>
              <span>${item.unitType === "kg" ? `${item.quantity.toFixed(3)} kg` : `${item.quantity} pza`}</span>
              <span>${formatCurrency(item.price)} c/u</span>
              <strong>${formatCurrency(item.total)}</strong>
            </article>
          `).join("") || `<p class="helper">Agrega productos para comenzar la venta.</p>`}
        </div>
        ${renderCartSummary()}
        <div class="summary">
          <button class="primary-btn" data-action="complete-sale">Cobrar e imprimir ticket</button>
          <button class="ghost-btn" data-action="mark-credit">Registrar como fiado</button>
        </div>
      </aside>
    </section>
  `;
}

function renderCartSummary() {
  const totals = summarizeSales([{ items: state.cart }]);
  return `
    <div class="summary">
      <div class="summary-line"><span>Subtotal</span><strong>${formatCurrency(totals.subtotal)}</strong></div>
      <div class="summary-line"><span>Descuento mayoreo</span><strong>${formatCurrency(totals.discount)}</strong></div>
      <div class="summary-line total"><span>Total</span><strong>${formatCurrency(totals.total)}</strong></div>
    </div>
  `;
}

function renderCash() {
  const register = state.cashRegister;
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Turno de caja</h3>
            <p>Apertura, fondo inicial y cierre por turno.</p>
          </div>
        </div>
        <form data-form="cash" class="form-grid">
          <label>
            <span>Fondo inicial</span>
            <input type="number" step="0.01" name="amount" placeholder="0.00" required />
          </label>
          <label>
            <span>Acción</span>
            <select name="mode">
              <option value="open">Abrir caja</option>
              <option value="close">Cerrar caja</option>
            </select>
          </label>
          <button class="primary-btn" type="submit">${register.isOpen ? "Registrar movimiento" : "Abrir caja"}</button>
        </form>
      </article>
      <section class="grid dashboard-grid">
        ${renderStat("Estado", register.isOpen ? "Abierta" : "Cerrada")}
        ${renderStat("Fondo actual", formatCurrency(register.currentCash))}
        ${renderStat("Apertura", register.openedAt ? formatDateTime(register.openedAt) : "Sin turno")}
        ${renderStat("Último cierre", register.closedAt ? formatDateTime(register.closedAt) : "N/D")}
      </section>
    </section>
  `;
}

function renderInventory() {
  return `
    <section class="grid">
      <article class="table-card">
        <div class="section-header">
          <div>
            <h3>Inventario</h3>
            <p>Existencias, entradas y salidas.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th>Existencia</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              ${state.products.map((product) => `
                <tr>
                  <td>${product.name}</td>
                  <td>${product.category}</td>
                  <td>${product.unitType === "kg" ? "Kilo" : "Pieza"}</td>
                  <td>${formatStock(product)}</td>
                  <td>${formatCurrency(product.price)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Alta rápida de producto</h3>
            <p>Agrega o actualiza artículos desde administración.</p>
          </div>
        </div>
        <form data-form="product" class="form-grid">
          <input name="name" placeholder="Nombre" required />
          <input name="barcode" placeholder="Código de barras" required />
          <input name="category" placeholder="Categoría" required />
          <input name="price" type="number" step="0.01" placeholder="Precio menudeo" required />
          <input name="wholesalePrice" type="number" step="0.01" placeholder="Precio mayoreo" required />
          <input name="stock" type="number" step="0.001" placeholder="Existencia inicial" required />
          <select name="unitType">
            <option value="kg">Por kilo</option>
            <option value="piece">Por pieza</option>
          </select>
          <button class="primary-btn" type="submit">Guardar producto</button>
        </form>
      </article>
    </section>
  `;
}

function renderPurchases() {
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Compra a proveedor</h3>
            <p>Actualiza inventario al registrar nuevas entradas.</p>
          </div>
        </div>
        <form data-form="purchase" class="form-grid">
          <select name="supplierId">${state.suppliers.map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`).join("")}</select>
          <select name="productId">${state.products.map((product) => `<option value="${product.id}">${product.name}</option>`).join("")}</select>
          <input type="number" step="0.001" name="quantity" placeholder="Cantidad" required />
          <input type="number" step="0.01" name="unitCost" placeholder="Costo unitario" required />
          <button class="primary-btn" type="submit">Registrar compra</button>
        </form>
      </article>
      <article class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              ${state.purchases.map((purchase) => `
                <tr>
                  <td>${purchase.date}</td>
                  <td>${findSupplier(purchase.supplierId)?.name || purchase.supplierId}</td>
                  <td>${findProduct(purchase.productId)?.name || purchase.productId}</td>
                  <td>${purchase.quantity}</td>
                  <td>${formatCurrency(purchase.unitCost)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderExpenses() {
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Gastos</h3>
            <p>Registro operativo del negocio.</p>
          </div>
        </div>
        <form data-form="expense" class="form-grid">
          <input name="concept" placeholder="Concepto" required />
          <input type="number" step="0.01" name="amount" placeholder="Monto" required />
          <input name="notes" class="full-span" placeholder="Notas" />
          <button class="primary-btn" type="submit">Guardar gasto</button>
        </form>
      </article>
      <article class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Notas</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${state.expenses.map((expense) => `
                <tr>
                  <td>${expense.date}</td>
                  <td>${expense.concept}</td>
                  <td>${expense.notes || "-"}</td>
                  <td>${formatCurrency(expense.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderCustomers() {
  if (state.session.role !== "admin") {
    return renderRestricted("Solo administración puede gestionar clientes.");
  }
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Clientes</h3>
            <p>Acceso restringido con precios especiales y mayoreo.</p>
          </div>
        </div>
        <form data-form="customer" class="form-grid">
          <input name="name" placeholder="Nombre" required />
          <input name="phone" placeholder="Teléfono" />
          <select name="wholesale">
            <option value="false">Menudeo</option>
            <option value="true">Mayoreo</option>
          </select>
          <select name="priceTier">
            <option value="retail">Precio menudeo</option>
            <option value="wholesale">Precio mayoreo</option>
          </select>
          <button class="primary-btn" type="submit">Guardar cliente</button>
        </form>
      </article>
      <article class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Saldo</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              ${state.customers.map((customer) => `
                <tr>
                  <td>${customer.name}</td>
                  <td>${customer.wholesale ? "Mayoreo" : "Menudeo"}</td>
                  <td>${formatCurrency(customer.creditBalance)}</td>
                  <td>${customer.priceTier === "wholesale" ? "Mayoreo" : "Menudeo"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderCredits() {
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Fiados</h3>
            <p>Control de créditos, pagos y saldos pendientes.</p>
          </div>
        </div>
        <form data-form="credit-payment" class="form-grid">
          <select name="customerId">${state.customers.filter((customer) => customer.id !== "C001").map((customer) => `<option value="${customer.id}">${customer.name}</option>`).join("")}</select>
          <input type="number" step="0.01" name="amount" placeholder="Monto abonado" required />
          <button class="primary-btn" type="submit">Registrar pago</button>
        </form>
      </article>
      <article class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${state.credits.map((credit) => `
                <tr>
                  <td>${credit.date}</td>
                  <td>${findCustomer(credit.customerId)?.name || credit.customerId}</td>
                  <td>${credit.type === "sale" ? "Venta" : "Pago"}</td>
                  <td>${formatCurrency(credit.amount)}</td>
                  <td>${formatCurrency(credit.paid)}</td>
                  <td>${formatCurrency(credit.amount - credit.paid)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderReports() {
  const report = buildReport(state.pos.reportRange);
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Reportes</h3>
            <p>Diario, semanal y mensual con separación de menudeo y mayoreo.</p>
          </div>
          <div class="toolbar">
            <select data-field="pos.reportRange">
              <option value="daily" ${state.pos.reportRange === "daily" ? "selected" : ""}>Diario</option>
              <option value="weekly" ${state.pos.reportRange === "weekly" ? "selected" : ""}>Semanal</option>
              <option value="monthly" ${state.pos.reportRange === "monthly" ? "selected" : ""}>Mensual</option>
            </select>
          </div>
        </div>
        <section class="grid dashboard-grid">
          ${renderStat("Venta total", formatCurrency(report.total))}
          ${renderStat("Menudeo", formatCurrency(report.retailTotal))}
          ${renderStat("Mayoreo", formatCurrency(report.wholesaleTotal))}
          ${renderStat("Descuentos", formatCurrency(report.discountTotal))}
        </section>
      </article>
      <article class="table-card">
        <div class="section-header">
          <div>
            <h3>Detalle de ventas</h3>
            <p>Separado por canal de venta.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Items</th>
                <th>Descuento</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${report.sales.map((sale) => `
                <tr>
                  <td>${sale.date}</td>
                  <td>${findCustomer(sale.customerId)?.name || sale.customerId}</td>
                  <td>${sale.channel}</td>
                  <td>${sale.items.length}</td>
                  <td>${formatCurrency(sale.totals.discount)}</td>
                  <td>${formatCurrency(sale.totals.total)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="grid">
      <article class="card">
        <div class="section-header">
          <div>
            <h3>Respaldo en la nube</h3>
            <p>Configura Apps Script para copias de seguridad automáticas y sincronización.</p>
          </div>
        </div>
        <div class="form-grid">
          <div class="full-span">
            <p class="helper">1. Publica Apps Script como Web App.</p>
            <p class="helper">2. Pega la URL en APP_SCRIPT_URL dentro de app.js.</p>
            <p class="helper">3. Usa el botón de sincronizar para subir ventas, inventario y catálogos.</p>
          </div>
          <button class="primary-btn" data-action="sync-now">Sincronizar respaldo</button>
        </div>
      </article>
      <article class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cola</th>
                <th>Tipo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${state.syncQueue.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.type}</td>
                  <td>${item.createdAt}</td>
                </tr>
              `).join("") || `<tr><td colspan="3">Sin pendientes.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderRestricted(message) {
  return `<section class="card"><p>${message}</p></section>`;
}

function renderStat(label, value) {
  return `<article class="stat card"><small>${label}</small><strong>${value}</strong></article>`;
}

function handleSubmit(event) {
  const form = event.target;
  const data = new FormData(form);
  if (!form.dataset.form) return;
  event.preventDefault();

  switch (form.dataset.form) {
    case "cash": return updateCash(data);
    case "product": return saveProduct(data);
    case "purchase": return savePurchase(data);
    case "expense": return saveExpense(data);
    case "customer": return saveCustomer(data);
    case "credit-payment": return registerCreditPayment(data);
    default: return;
  }
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;

  switch (action) {
    case "navigate":
      state.currentView = button.dataset.view;
      persist();
      return render();
    case "logout":
      state.session = structuredClone(DEMO_SESSION);
      state.currentView = "dashboard";
      state.cart = [];
      persist();
      return render();
    case "set-category":
      state.pos.category = button.dataset.category;
      persist();
      return render();
    case "add-product":
      return addProductToCart(button.dataset.productId);
    case "remove-cart-item":
      state.cart = state.cart.filter((item) => item.id !== button.dataset.itemId);
      persist();
      return render();
    case "clear-cart":
      state.cart = [];
      persist();
      return render();
    case "assign-weight":
      return applyManualWeight();
    case "complete-sale":
      return completeSale(false);
    case "mark-credit":
      return completeSale(true);
    case "scan-barcode":
      return addByBarcode();
    case "sync-now":
      return flushSyncQueue();
    case "open-scale":
      return readScale();
    default:
      return;
  }
}

function handleChange(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  setByPath(state, field, event.target.value);
  persist();
  render();
}

function handleInput(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  setByPath(state, field, event.target.value);
  persist();
}

function updateCash(formData) {
  const amount = Number(formData.get("amount"));
  const mode = formData.get("mode");
  const now = new Date().toISOString();
  if (mode === "open") {
    state.cashRegister = {
      isOpen: true,
      openingAmount: amount,
      currentCash: amount,
      openedAt: now,
      closedAt: state.cashRegister.closedAt,
    };
    enqueueSync("cash_open", state.cashRegister);
  } else {
    state.cashRegister.isOpen = false;
    state.cashRegister.currentCash = amount;
    state.cashRegister.closedAt = now;
    enqueueSync("cash_close", state.cashRegister);
  }
  persist();
  render();
}

function saveProduct(formData) {
  ensureAdmin();
  const product = {
    id: `P${String(state.products.length + 1).padStart(3, "0")}`,
    barcode: formData.get("barcode"),
    name: formData.get("name"),
    category: formData.get("category"),
    price: Number(formData.get("price")),
    wholesalePrice: Number(formData.get("wholesalePrice")),
    stock: Number(formData.get("stock")),
    unitType: formData.get("unitType"),
  };
  state.products.unshift(product);
  addInventoryMovement(product.id, "adjustment", product.stock, "Alta de producto");
  enqueueSync("product_upsert", product);
  persist();
  render();
}

function savePurchase(formData) {
  const purchase = {
    id: crypto.randomUUID(),
    supplierId: formData.get("supplierId"),
    productId: formData.get("productId"),
    quantity: Number(formData.get("quantity")),
    unitCost: Number(formData.get("unitCost")),
    date: today(),
  };
  state.purchases.unshift(purchase);
  const product = findProduct(purchase.productId);
  product.stock += purchase.quantity;
  addInventoryMovement(product.id, "purchase", purchase.quantity, "Compra a proveedor");
  enqueueSync("purchase_create", purchase);
  persist();
  render();
}

function saveExpense(formData) {
  const expense = {
    id: crypto.randomUUID(),
    concept: formData.get("concept"),
    amount: Number(formData.get("amount")),
    date: today(),
    notes: formData.get("notes"),
  };
  state.expenses.unshift(expense);
  enqueueSync("expense_create", expense);
  persist();
  render();
}

function saveCustomer(formData) {
  ensureAdmin();
  const customer = {
    id: `C${String(state.customers.length + 1).padStart(3, "0")}`,
    name: formData.get("name"),
    phone: formData.get("phone"),
    wholesale: formData.get("wholesale") === "true",
    creditBalance: 0,
    priceTier: formData.get("priceTier"),
  };
  state.customers.unshift(customer);
  enqueueSync("customer_upsert", customer);
  persist();
  render();
}

function registerCreditPayment(formData) {
  const customerId = formData.get("customerId");
  const amount = Number(formData.get("amount"));
  let remaining = amount;

  state.credits
    .filter((credit) => credit.customerId === customerId && credit.amount > credit.paid)
    .forEach((credit) => {
      if (remaining <= 0) return;
      const due = credit.amount - credit.paid;
      const payment = Math.min(remaining, due);
      credit.paid += payment;
      remaining -= payment;
    });

  const customer = findCustomer(customerId);
  customer.creditBalance = Math.max(0, customer.creditBalance - amount);
  enqueueSync("credit_payment", { customerId, amount, date: today() });
  persist();
  render();
}

function addProductToCart(productId) {
  const product = findProduct(productId);
  if (!product) return;
  const quantity = product.unitType === "kg" ? 1 : 1;
  const item = {
    id: crypto.randomUUID(),
    productId: product.id,
    name: product.name,
    unitType: product.unitType,
    quantity,
    price: displayPriceForCustomer(product),
    total: displayPriceForCustomer(product) * quantity,
  };
  state.cart.push(item);
  persist();
  render();
}

function applyManualWeight() {
  const last = state.cart.at(-1);
  const manualWeight = Number(state.pos.manualWeight);
  if (!last || last.unitType !== "kg" || !manualWeight) {
    return alert("Agrega un producto por kilo y captura un peso válido.");
  }
  last.quantity = manualWeight;
  last.total = last.price * last.quantity;
  state.pos.manualWeight = "";
  persist();
  render();
}

async function readScale() {
  const weight = await getWeightFromScale();
  if (!weight) return;
  state.pos.manualWeight = weight.toFixed(3);
  persist();
  render();
}

function addByBarcode() {
  const product = state.products.find((item) => item.barcode === state.pos.barcode.trim());
  if (!product) {
    return alert("No se encontró un producto para ese código.");
  }
  state.pos.barcode = "";
  return addProductToCart(product.id);
}

function completeSale(isCredit) {
  if (!state.cashRegister.isOpen && !isCredit) {
    return alert("Primero abre caja para registrar cobro.");
  }
  if (!state.cart.length) {
    return alert("No hay productos en el ticket.");
  }
  const customer = selectedCustomer();
  const totals = summarizeSales([{ items: state.cart }]);
  const sale = {
    id: crypto.randomUUID(),
    date: today(),
    createdAt: new Date().toISOString(),
    customerId: customer.id,
    channel: customer.wholesale ? "Mayoreo" : "Menudeo",
    items: structuredClone(state.cart),
    totals,
    paymentType: isCredit ? "credit" : "cash",
    cashierId: state.session.id,
  };

  state.sales.unshift(sale);
  sale.items.forEach((item) => {
    const product = findProduct(item.productId);
    product.stock -= item.quantity;
    addInventoryMovement(product.id, "sale", item.quantity * -1, `Venta ${sale.id}`);
  });

  if (isCredit) {
    state.credits.unshift({
      id: crypto.randomUUID(),
      customerId: customer.id,
      type: "sale",
      amount: totals.total,
      paid: 0,
      date: today(),
      notes: `Venta ${sale.id}`,
    });
    customer.creditBalance += totals.total;
  } else {
    state.cashRegister.currentCash += totals.total;
  }

  enqueueSync("sale_create", sale);
  printTicket(sale);
  state.cart = [];
  persist();
  render();
}

function printTicket(sale) {
  const root = document.querySelector("#ticket-root");
  root.classList.remove("hidden");
  root.innerHTML = `
    <article class="ticket">
      <h2>Pollo POS</h2>
      <p>Fecha: ${formatDateTime(sale.createdAt)}</p>
      <p>Cliente: ${findCustomer(sale.customerId)?.name || sale.customerId}</p>
      <hr />
      ${sale.items.map((item) => `<p>${item.name} · ${item.quantity}${item.unitType === "kg" ? "kg" : "pza"} · ${formatCurrency(item.total)}</p>`).join("")}
      <hr />
      <p>Subtotal: ${formatCurrency(sale.totals.subtotal)}</p>
      <p>Descuento: ${formatCurrency(sale.totals.discount)}</p>
      <p>Total: ${formatCurrency(sale.totals.total)}</p>
      <p>Pago: ${sale.paymentType === "credit" ? "Fiado" : "Efectivo"}</p>
    </article>
  `;
  window.print();
  root.classList.add("hidden");
}

function filteredProducts() {
  return state.products.filter((product) => {
    const search = state.pos.search.toLowerCase().trim();
    const matchesSearch = !search || product.name.toLowerCase().includes(search) || product.barcode.includes(search);
    const matchesCategory = state.pos.category === "Todas" || product.category === state.pos.category;
    return matchesSearch && matchesCategory;
  });
}

function topbarSubtitle() {
  switch (state.currentView) {
    case "pos": return "Venta ágil con categorías, código de barras y peso.";
    case "inventory": return "Control de entradas, salidas y existencias.";
    case "reports": return "Menudeo, mayoreo y descuentos por periodo.";
    default: return "Operación lista para móvil, tablet y escritorio.";
  }
}

function summarizeSales(sales) {
  const allItems = sales.flatMap((sale) => sale.items);
  const subtotal = sum(allItems.map((item) => retailReferencePrice(item.productId) * item.quantity));
  const total = sum(allItems.map((item) => item.total));
  return {
    subtotal,
    total,
    discount: Math.max(0, subtotal - total),
  };
}

function buildReport(range) {
  const sales = state.sales.filter((sale) => isInRange(sale.date, range));
  const retailSales = sales.filter((sale) => sale.channel === "Menudeo");
  const wholesaleSales = sales.filter((sale) => sale.channel === "Mayoreo");
  return {
    sales,
    total: sum(sales.map((sale) => sale.totals.total)),
    retailTotal: sum(retailSales.map((sale) => sale.totals.total)),
    wholesaleTotal: sum(wholesaleSales.map((sale) => sale.totals.total)),
    discountTotal: sum(sales.map((sale) => sale.totals.discount)),
  };
}

function recentActivity() {
  return [
    ...state.sales.slice(0, 4).map((sale) => ({
      time: formatTime(sale.createdAt),
      type: "Venta",
      label: findCustomer(sale.customerId)?.name || sale.customerId,
      amount: formatCurrency(sale.totals.total),
    })),
    ...state.expenses.slice(0, 2).map((expense) => ({
      time: expense.date,
      type: "Gasto",
      label: expense.concept,
      amount: formatCurrency(expense.amount),
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));
}

function displayPriceForCustomer(product) {
  return selectedCustomer().priceTier === "wholesale" ? product.wholesalePrice : product.price;
}

function retailReferencePrice(productId) {
  return findProduct(productId)?.price || 0;
}

function selectedCustomer() {
  return findCustomer(state.pos.selectedCustomerId) || state.customers[0];
}

function findProduct(productId) {
  return state.products.find((item) => item.id === productId);
}

function findCustomer(customerId) {
  return state.customers.find((item) => item.id === customerId);
}

function findSupplier(supplierId) {
  return state.suppliers.find((item) => item.id === supplierId);
}

function addInventoryMovement(productId, type, quantity, note) {
  state.inventoryMovements.unshift({
    id: crypto.randomUUID(),
    productId,
    type,
    quantity,
    note,
    date: new Date().toISOString(),
  });
}

function seedInventoryMovements() {
  state.products.forEach((product) => addInventoryMovement(product.id, "seed", product.stock, "Inventario inicial"));
  persist();
}

function enqueueSync(type, payload) {
  state.syncQueue.push({
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
  persist();
}

async function flushSyncQueue() {
  if (!APP_SCRIPT_URL) {
    alert("Configura APP_SCRIPT_URL en app.js para sincronizar con Apps Script.");
    return;
  }
  if (!navigator.onLine || !state.syncQueue.length) return;
  const items = structuredClone(state.syncQueue);
  try {
    const response = await fetch(APP_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "sync", items }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Error de sincronización");
    state.syncQueue = [];
    persist();
    render();
  } catch (error) {
    console.error(error);
    alert("No se pudo sincronizar. La cola se conserva localmente.");
  }
}

async function getWeightFromScale() {
  if ("serial" in navigator) {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      const reader = port.readable.getReader();
      const { value } = await reader.read();
      reader.releaseLock();
      await port.close();
      const text = new TextDecoder().decode(value || new Uint8Array());
      const match = text.match(/(\d+\.\d+)/);
      if (match) return Number(match[1]);
    } catch (error) {
      console.warn("Lectura serial no disponible para esta báscula.", error);
    }
  }

  const simulated = prompt("Ingresa peso leído desde la báscula Torrey en kg:");
  return simulated ? Number(simulated) : null;
}

function ensureAdmin() {
  if (state.session.role !== "admin") {
    throw new Error("Acceso restringido");
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setByPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((acc, key) => acc[key], object);
  target[last] = value;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value || 0);
}

function formatStock(product) {
  return product.unitType === "kg" ? `${product.stock.toFixed(3)} kg` : `${product.stock} pza`;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(new Date(value));
}

function isInRange(dateText, range) {
  const date = new Date(dateText);
  const now = new Date();
  const diffDays = (now - date) / 86400000;
  if (range === "daily") return diffDays < 1;
  if (range === "weekly") return diffDays < 7;
  return diffDays < 31;
}

function escapeAttr(value) {
  return String(value || "").replaceAll('"', "&quot;");
}
