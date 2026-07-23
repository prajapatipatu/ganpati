/* ============================================================
   TRUST REGISTRY - FRONTEND LOGIC
   ============================================================
   SECURITY UPDATE:
   - APPS_SCRIPT_URL and admin username/password are NO LONGER
     stored in this file. They now live only on the server side,
     inside /api/login.js and /api/data.js (as environment
     variables on Vercel).
   - This file calls your own domain's /api/login and /api/data
     endpoints. The browser/console never sees the real Apps
     Script URL or the admin password.

   NEW IN THIS VERSION:
   - ImageURL field have "Choose file" thi photo upload thai
     shake che (photo Google Drive ma save thai, link auto save thay).
   - Add / Update button dabavta pahela dareke field bharel hovi
     joie - nahi to lal border ane error message batavse.
   - Gallery card have Title + photo j batave che (Date nathi
     batavtu); pehla 2 photo "featured" (moti size) ma upar
     batay che, baki badha neeche normal grid ma.
   - Sponsors card have Name + photo j batave che (Contact /
     Amount card par nathi batavta).
   - Badhi jagya e Date "DD/MM/YYYY" format ma batay che.
   ============================================================ */


const CONFIG = {
  MAX_IMAGE_MB: 10
};

const SCHEMA = {
  Members:  [{key:"Year",label:"Year",type:"year"},{key:"Name",label:"Name",type:"text"},{key:"Mobile",label:"Mobile",type:"text"},{key:"Address",label:"Address",type:"text"},{key:"MemberFee",label:"Member Fee",type:"decimal"},{key:"ImageURL",label:"Photo",type:"image"}],
  Income:   [{key:"Year",label:"Year",type:"year"},{key:"Date",label:"Date",type:"date"},{key:"Source",label:"Source",type:"text"},{key:"Amount",label:"Amount",type:"number"},{key:"Note",label:"Note",type:"text"}],
  Expense:  [{key:"Year",label:"Year",type:"year"},{key:"Date",label:"Date",type:"date"},{key:"Category",label:"Category",type:"text"},{key:"Amount",label:"Amount",type:"number"},{key:"Note",label:"Note",type:"text"}],
  Gallery:  [{key:"Year",label:"Year",type:"year"},{key:"Title",label:"Title",type:"text"},{key:"ImageURL",label:"Photo",type:"image"},{key:"Date",label:"Date",type:"date"}],
  Sponsors: [{key:"Year",label:"Year",type:"year"},{key:"Name",label:"Name",type:"text"},{key:"Amount",label:"Amount",type:"number"},{key:"Contact",label:"Contact",type:"text"},{key:"ImageURL",label:"Logo/Photo",type:"image"}]
};

const state = {
  currentYear: String(new Date().getFullYear()),
  currentTab: "Home",
  isAdmin: sessionStorage.getItem("trustAdmin") === "yes",
  data: { Members: [], Income: [], Expense: [], Gallery: [], Sponsors: [] },
  editing: null
};

/* Files chosen (but not yet uploaded) for the currently open form,
   keyed by sheet name then field key. Reset whenever a form panel
   is (re)rendered. */
let pendingImageFiles = {};

/* ---------------- API helpers ---------------- */

/* These now call our OWN domain's /api routes instead of the Apps
   Script URL directly. The real Apps Script URL lives only in the
   server-side environment variable APPS_SCRIPT_URL (see /api/data.js). */

async function apiGet(sheet) {
  const url = `/api/data?sheet=${encodeURIComponent(sheet)}&year=all`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data || [];
}

async function apiPost(sheet, action, data) {
  const headers = { "Content-Type": "application/json" };
  const token = sessionStorage.getItem("trustToken");
  if (token) headers["x-auth-token"] = token;

  const res = await fetch("/api/data", {
    method: "POST",
    headers,
    body: JSON.stringify({ sheet, action, data })
  });
  const json = await res.json();
  if (json.error || json.success === false) throw new Error(json.error || "The data could not be saved.");
  return json;
}

function toast(msg) {
  const host = document.getElementById("toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Photo is not selected."));
    reader.readAsDataURL(file);
  });
}

/* ---------------- Date formatting ---------------- */

/* Converts a date value (as returned by Apps Script, "yyyy-MM-dd",
   or any other parseable date string) into "DD/MM/YYYY" for display.
   Returns "-" for empty values and falls back to the raw (escaped)
   value if it can't be parsed as a date at all. */
function formatDateDDMMYYYY(val) {
  if (val === undefined || val === null || String(val).trim() === "") return "-";

  // Fast path for the "yyyy-MM-dd" strings the backend already sends.
  const isoMatch = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const d = new Date(val);
  if (isNaN(d.getTime())) return escapeHTML(String(val));

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/* ---------------- Load all data ---------------- */

async function loadAllData() {
  const main = document.getElementById("mainContent");
  main.innerHTML = `<p class="loading-note">Data is loading...</p>`;
  try {
    const sheets = Object.keys(state.data);
    const results = await Promise.all(sheets.map(s => apiGet(s)));
    sheets.forEach((s, i) => state.data[s] = results[i]);
    renderYearStrip();
    renderTab();
  } catch (err) {
    main.innerHTML = `<p class="empty-note">Data could not be loaded. Please check whether the Apps Script URL is correct. (${err.message})</p>`;
  }
}

/* ---------------- Year strip ---------------- */

function getAllYears() {
  const years = new Set();
  Object.values(state.data).forEach(rows => rows.forEach(r => { if (r.Year) years.add(String(r.Year)); }));
  years.add(String(new Date().getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

function renderYearStrip() {
  const strip = document.getElementById("yearStrip");
  const years = getAllYears();
  strip.innerHTML = `<span class="year-strip-label">Year</span>` +
    years.map(y => `<button class="year-seal ${y === state.currentYear ? "active" : ""}" data-year="${y}">${y}</button>`).join("") +
    `<button class="year-seal ${state.currentYear === "all" ? "active" : ""}" data-year="all">All</button>`;

  strip.querySelectorAll(".year-seal").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentYear = btn.dataset.year;
      renderYearStrip();
      renderTab();
    });
  });
}

/* ---------------- Tabs ---------------- */

document.getElementById("tabNav").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.currentTab = btn.dataset.tab;
  renderTab();
});

function filteredRows(sheet) {
  let rows = [...(state.data[sheet] || [])];

  if (state.currentYear !== "all") {
    rows = rows.filter(r => String(r.Year) === String(state.currentYear));
  }

  switch (sheet) {
    case "Members":
      rows.sort((a, b) => (parseFloat(b.MemberFee) || 0) - (parseFloat(a.MemberFee) || 0));
      break;

    case "Income":
      rows.sort((a, b) => (parseFloat(b.Amount) || 0) - (parseFloat(a.Amount) || 0));
      break;

    case "Expense":
      rows.sort((a, b) => (parseFloat(b.Amount) || 0) - (parseFloat(a.Amount) || 0));
      break;

    case "Sponsors":
      rows.sort((a, b) => (parseFloat(b.Amount) || 0) - (parseFloat(a.Amount) || 0));
      break;
  }

  return rows;
}

function renderTab() {
  const main = document.getElementById("mainContent");
  if (state.currentTab === "Home") return renderHome(main);
  if (state.currentTab === "Income" || state.currentTab === "Expense") return renderFinance(main, state.currentTab);
  if (state.currentTab === "Members") return renderMembers(main);
  if (state.currentTab === "Gallery") return renderGallery(main);
  if (state.currentTab === "Sponsors") return renderSponsors(main);
}

/* ---------------- Home ---------------- */

function sumField(rows, field) {
  return rows.reduce((t, r) => t + (parseFloat(r[field]) || 0), 0);
}

function sumAmount(rows) {
  return sumField(rows, "Amount");
}

function renderHome(main) {
  const incomeDirect = sumField(filteredRows("Income"), "Amount");
  const memberFeeTotal = sumField(filteredRows("Members"), "MemberFee");
  const sponsorTotal = sumField(filteredRows("Sponsors"), "Amount");
  const income = incomeDirect + memberFeeTotal + sponsorTotal;
  const expense = sumField(filteredRows("Expense"), "Amount");
  const balance = income - expense;
  const memberCount = filteredRows("Members").length;
  const sponsorCount = filteredRows("Sponsors").length;

  main.innerHTML = `
    <div class="summary-row">
      <div class="summary-card income"><div class="label"><b>Total income</b></div><div class="value">Rs. ${income.toLocaleString("en-IN")}</div></div>
      <div class="summary-card expense"><div class="label"><b>Total expense</b></div><div class="value">Rs. ${expense.toLocaleString("en-IN")}</div></div>
      <div class="summary-card balance"><div class="label"><b>Avilabel Balance</b></div><div class="value">Rs. ${balance.toLocaleString("en-IN")}</div></div>
      <div class="summary-card"><div class="label"><b>Total Members</b></div><div class="value">${memberCount}</div></div>
      <div class="summary-card"><div class="label"><b>Total Sponsors</b></div><div class="value">${sponsorCount}</div></div>
    </div>
    <div class="summary-row">
      <div class="summary-card"><div class="label"><b>Other Income</b></div><div class="value">Rs. ${incomeDirect.toLocaleString("en-IN")}</div></div>
      <div class="summary-card"><div class="label"><b>Member Income<b></div><div class="value">Rs. ${memberFeeTotal.toLocaleString("en-IN")}</div></div>
      <div class="summary-card"><div class="label"><b>Sponsor Income<b></div><div class="value">Rs. ${sponsorTotal.toLocaleString("en-IN")}</div></div>
    </div>
    <p class="loading-note">Selected year: ${state.currentYear === "all" ? "All years" : state.currentYear}.</p>
  `;
}

/* ---------------- Members ---------------- */

function renderMembers(main) {
  const rows = filteredRows("Members");
  main.innerHTML = `
    <div class="section-head"><h2>Members</h2></div>
    ${state.isAdmin ? adminFormHTML("Members") : ""}
    <div class="record-grid" id="listArea"></div>
  `;
  const listArea = document.getElementById("listArea");
  if (!rows.length) { listArea.innerHTML = `<div class="empty-note">No members found for this year.</div>`; }
  else {
    listArea.innerHTML = rows.map(r => `
      <div class="record-card">
        ${r.ImageURL ? `<img src="${escapeAttr(r.ImageURL)}" alt="${escapeAttr(r.Name || "")}" onerror="this.style.display='none'">` : ""}
        <h3>${escapeHTML(r.Name || "")}</h3>
        <p class="meta">Mobile: ${escapeHTML(r.Mobile || "-")}</p>
        <p class="meta">Address: ${escapeHTML(r.Address || "-")}</p>
        <p class="meta">Member Fee: ${escapeHTML(r.MemberFee || "-")}</p>
        <p class="meta">Year: ${escapeHTML(String(r.Year || "-"))}</p>
        ${adminActionsHTML("Members", r.ID)}
      </div>
    `).join("");
  }
  if (state.isAdmin) bindAdminEvents("Members");
}

/* ---------------- Income / Expense ---------------- */

function renderFinance(main, sheet) {
  const rows = filteredRows(sheet);
  const total = sumAmount(rows);
  const cls = sheet === "Income" ? "income" : "expense";
  const catLabel = sheet === "Income" ? "Source" : "Category";

  main.innerHTML = `
    <div class="section-head"><h2>${sheet}</h2></div>
    <div class="summary-row">
      <div class="summary-card ${cls}"><div class="label">Total ${sheet.toLowerCase()}</div><div class="value">Rs. ${total.toLocaleString("en-IN")}</div></div>
    </div>
    ${state.isAdmin ? adminFormHTML(sheet) : ""}
    <div class="record-grid" id="listArea"></div>
  `;
  const listArea = document.getElementById("listArea");
  if (!rows.length) { listArea.innerHTML = `<div class="empty-note">No data found for this year.</div>`; }
  else {
    listArea.innerHTML = rows.map(r => `
      <div class="record-card ${cls}">
        <h3>${escapeHTML(r[catLabel] || "")}</h3>
        <p class="meta">Date: ${formatDateDDMMYYYY(r.Date)}</p>
        <p class="meta">Note: ${escapeHTML(r.Note || "-")}</p>
        <p class="amount">Rs. ${Number(r.Amount || 0).toLocaleString("en-IN")}</p>
        ${adminActionsHTML(sheet, r.ID)}
      </div>
    `).join("");
  }
  if (state.isAdmin) bindAdminEvents(sheet);
}

/* ---------------- Gallery ---------------- */

/* Builds one gallery card. `featured` cards (the first 2) get a
   larger image via the .featured CSS class; everything else uses
   the regular record-card sizing. Only Title + photo are shown -
   Date is intentionally left off the card. */
function galleryCardHTML(r, featured) {
  return `
    <div class="record-card gallery-card ${featured ? "featured" : ""}">
      ${r.ImageURL ? `<img src="${escapeAttr(r.ImageURL)}" alt="${escapeAttr(r.Title || "")}" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHTML(r.Title || "")}</h3>
      ${adminActionsHTML("Gallery", r.ID)}
    </div>
  `;
}

function renderGallery(main) {
  const rows = filteredRows("Gallery");
  main.innerHTML = `
    <div class="section-head"><h2>Gallery</h2></div>
    ${state.isAdmin ? adminFormHTML("Gallery") : ""}
    <div class="gallery-featured" id="featuredArea"></div>
    <div class="record-grid" id="listArea"></div>
  `;
  const featuredArea = document.getElementById("featuredArea");
  const listArea = document.getElementById("listArea");

  if (!rows.length) {
    featuredArea.innerHTML = "";
    listArea.innerHTML = `<div class="empty-note">No photos found for this year.</div>`;
  } else {
    const featured = rows.slice(0, 2);
    const rest = rows.slice(2);
    featuredArea.innerHTML = featured.map(r => galleryCardHTML(r, true)).join("");
    listArea.innerHTML = rest.map(r => galleryCardHTML(r, false)).join("");
  }
  if (state.isAdmin) bindAdminEvents("Gallery");
}

/* ---------------- Sponsors ---------------- */

/* Builds one sponsor card. `featured` cards (the first 2) get a
   larger image via the .featured CSS class; everything else uses
   the regular record-card sizing. Only Name + photo are shown. */
function sponsorCardHTML(r, featured) {
  return `
    <div class="record-card sponsor-card ${featured ? "featured" : ""}">
      ${r.ImageURL ? `<img src="${escapeAttr(r.ImageURL)}" alt="${escapeAttr(r.Name || "")}" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHTML(r.Name || "")}</h3>
      ${adminActionsHTML("Sponsors", r.ID)}
    </div>
  `;
}

function renderSponsors(main) {
  const rows = filteredRows("Sponsors");
  main.innerHTML = `
    <div class="section-head"><h2>Sponsors</h2></div>
    ${state.isAdmin ? adminFormHTML("Sponsors") : ""}
    <div class="sponsor-featured" id="featuredArea"></div>
    <div class="record-grid" id="listArea"></div>
  `;
  const featuredArea = document.getElementById("featuredArea");
  const listArea = document.getElementById("listArea");

  if (!rows.length) {
    featuredArea.innerHTML = "";
    listArea.innerHTML = `<div class="empty-note">No sponsors found for this year.</div>`;
  } else {
    const featured = rows.slice(0, 2);
    const rest = rows.slice(2);
    featuredArea.innerHTML = featured.map(r => sponsorCardHTML(r, true)).join("");
    listArea.innerHTML = rest.map(r => sponsorCardHTML(r, false)).join("");
  }
  if (state.isAdmin) bindAdminEvents("Sponsors");
}

/* ---------------- Admin form + actions ---------------- */

function adminActionsHTML(sheet, id) {
  if (!state.isAdmin) return "";
  return `
    <div class="card-actions">
      <button class="btn btn-sm" data-edit="${sheet}:${id}">Edit</button>
      <button class="btn btn-sm btn-danger" data-delete="${sheet}:${id}">Delete</button>
    </div>
  `;
}

function adminFormHTML(sheet) {
  const editingRecord = (state.editing && state.editing.sheet === sheet)
    ? state.data[sheet].find(r => String(r.ID) === String(state.editing.id))
    : null;
  const fields = SCHEMA[sheet];

  // Fresh form panel -> forget any file picked for a previous panel.
  pendingImageFiles[sheet] = {};

  const fieldsHTML = fields.map(f => {
    const existingVal = editingRecord ? editingRecord[f.key] : (f.type === "year" ? (state.currentYear === "all" ? new Date().getFullYear() : state.currentYear) : "");

    if (f.type === "image") {
      return `
        <div class="field field-image" data-field-wrap="${f.key}">
          <label>${f.label}</label>
          <div class="image-upload-row">
            <img class="image-preview ${existingVal ? "" : "hidden"}" data-preview="${f.key}" src="${escapeAttr(existingVal || "")}" onerror="this.classList.add('hidden')">
            <input type="file" accept="image/*" data-field-file="${f.key}">
          </div>
          <input type="hidden" data-field="${f.key}" value="${escapeAttr(existingVal || "")}">
          <p class="field-hint">Select Photo(JPG/PNG, max ${CONFIG.MAX_IMAGE_MB}MB).${editingRecord && existingVal ? " If you do not select a new photo, the existing photo will remain unchanged.." : ""}</p>
        </div>
      `;
    }

    const inputType = f.type === "year" ? "number" : f.type;
    return `
      <div class="field" data-field-wrap="${f.key}">
        <label>${f.label}</label>
        <input type="${inputType}" data-field="${f.key}" value="${escapeAttr(existingVal || "")}">
      </div>
    `;
  }).join("");

  return `
    <div class="form-panel" id="formPanel-${sheet}">
      <h3>${editingRecord ? "Update" : "Add New"} - ${sheet}</h3>
      <div class="form-grid">${fieldsHTML}</div>
      <p class="form-error" id="formError-${sheet}"></p>
      <div class="form-actions">
        <button class="btn btn-primary" id="saveBtn-${sheet}">${editingRecord ? "Update" : "Add"}</button>
        ${editingRecord ? `<button class="btn" id="cancelEdit-${sheet}">Cancel</button>` : ""}
      </div>
    </div>
  `;
}

function bindAdminEvents(sheet) {
  const panel = document.getElementById(`formPanel-${sheet}`);
  if (panel) {
    document.getElementById(`saveBtn-${sheet}`).addEventListener("click", () => saveRecord(sheet));
    const cancelBtn = document.getElementById(`cancelEdit-${sheet}`);
    if (cancelBtn) cancelBtn.addEventListener("click", () => {
      state.editing = null;
      pendingImageFiles[sheet] = {};
      renderTab();
    });

    panel.querySelectorAll("[data-field-file]").forEach(fileInput => {
      fileInput.addEventListener("change", (e) => {
        const key = fileInput.dataset.fieldFile;
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > CONFIG.MAX_IMAGE_MB * 1024 * 1024) {
          toast(`The file size must not exceed ${CONFIG.MAX_IMAGE_MB}MB.`);
          fileInput.value = "";
          return;
        }

        pendingImageFiles[sheet] = pendingImageFiles[sheet] || {};
        pendingImageFiles[sheet][key] = file;

        const preview = panel.querySelector(`[data-preview="${key}"]`);
        if (preview) {
          const reader = new FileReader();
          reader.onload = () => {
            preview.src = reader.result;
            preview.classList.remove("hidden");
          };
          reader.readAsDataURL(file);
        }

        const wrap = panel.querySelector(`[data-field-wrap="${key}"]`);
        if (wrap) wrap.classList.remove("invalid");
      });
    });
  }

  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [s, id] = btn.dataset.edit.split(":");
      state.editing = { sheet: s, id };
      renderTab();
      document.getElementById(`formPanel-${s}`)?.scrollIntoView({ behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const [s, id] = btn.dataset.delete.split(":");
      if (!confirm("Are you sure you want to delete this record?")) return;
      try {
        await apiPost(s, "delete", { ID: id });
        state.data[s] = await apiGet(s);
        toast("Deleted successfully.");
        renderTab();
      } catch (err) { toast("Error: " + err.message); }
    });
  });
}

/* ---------------- Validation ---------------- */

function validateForm(sheet) {
  const panel = document.getElementById(`formPanel-${sheet}`);
  const fields = SCHEMA[sheet];
  let allOk = true;
  let firstInvalid = null;

  fields.forEach(f => {
    const wrap = panel.querySelector(`[data-field-wrap="${f.key}"]`);
    if (!wrap) return;
    wrap.classList.remove("invalid");

    let filled;
    if (f.type === "image") {
      const hidden = wrap.querySelector(`[data-field="${f.key}"]`);
      const hasExisting = !!(hidden && hidden.value && hidden.value.trim() !== "");
      const hasPending = !!(pendingImageFiles[sheet] && pendingImageFiles[sheet][f.key]);
      filled = hasExisting || hasPending;
    } else {
      const input = wrap.querySelector(`[data-field="${f.key}"]`);
      filled = !!(input && String(input.value).trim() !== "");
    }

    if (!filled) {
      wrap.classList.add("invalid");
      allOk = false;
      if (!firstInvalid) firstInvalid = wrap;
    }
  });

  return { ok: allOk, firstInvalid };
}

async function saveRecord(sheet) {
  const panel = document.getElementById(`formPanel-${sheet}`);
  const errorEl = document.getElementById(`formError-${sheet}`);
  errorEl.textContent = "";

  const { ok, firstInvalid } = validateForm(sheet);
  if (!ok) {
    errorEl.textContent = "All fields are required.";
    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const inputs = panel.querySelectorAll("[data-field]");
  const payload = {};
  inputs.forEach(inp => payload[inp.dataset.field] = inp.value);

  if (state.editing && state.editing.sheet === sheet) {
    payload.ID = state.editing.id;
  }

  const saveBtn = document.getElementById(`saveBtn-${sheet}`);
  const originalBtnText = saveBtn.textContent;
  saveBtn.disabled = true;

  try {
    // Upload any newly chosen photos to Drive first, and swap the
    // hidden field's value for the returned public URL.
    const pending = pendingImageFiles[sheet] || {};
    for (const fieldKey of Object.keys(pending)) {
      const file = pending[fieldKey];
      if (!file) continue;
      saveBtn.textContent = "Uploading photo...";
      const base64 = await fileToBase64(file);
      const uploadRes = await apiPost(sheet, "uploadImage", {
        base64,
        mimeType: file.type || "image/jpeg",
        fileName: file.name || `photo-${Date.now()}.jpg`
      });
      payload[fieldKey] = uploadRes.url;
    }

    saveBtn.textContent = "Saving...";

    if (state.editing && state.editing.sheet === sheet) {
      await apiPost(sheet, "update", payload);
      toast("Updated successfully.");
    } else {
      await apiPost(sheet, "add", payload);
      toast("Record added successfully.");
    }

    state.editing = null;
    pendingImageFiles[sheet] = {};
    state.data[sheet] = await apiGet(sheet);
    renderYearStrip();
    renderTab();
  } catch (err) {
    errorEl.textContent = "Error: " + err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalBtnText;
  }
}

/* ---------------- Login / Logout ---------------- */

const loginModal = document.getElementById("loginModal");

document.getElementById("loginBtn").addEventListener("click", () => {
  loginModal.classList.remove("hidden");
  document.getElementById("loginError").textContent = "";
});
document.getElementById("loginCancel").addEventListener("click", () => loginModal.classList.add("hidden"));

document.getElementById("loginSubmit").addEventListener("click", async () => {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  const submitBtn = document.getElementById("loginSubmit");
  const errorEl = document.getElementById("loginError");
  errorEl.textContent = "";
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Login failed");

    sessionStorage.setItem("trustToken", json.token);
    state.isAdmin = true;
    sessionStorage.setItem("trustAdmin", "yes");
    loginModal.classList.add("hidden");
    updateAuthUI();
    renderTab();
    toast("Login successful.");
  } catch (err) {
    errorEl.textContent = "Username and password is wrong.";
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  state.isAdmin = false;
  sessionStorage.removeItem("trustAdmin");
  sessionStorage.removeItem("trustToken");
  updateAuthUI();
  renderTab();
  toast("Logout successful.");
});

function updateAuthUI() {
  document.getElementById("loginBtn").classList.toggle("hidden", state.isAdmin);
  document.getElementById("logoutBtn").classList.toggle("hidden", !state.isAdmin);
}

/* ---------------- Utils ---------------- */

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function escapeAttr(str) { return escapeHTML(str); }

/* ---------------- Init ---------------- */

updateAuthUI();
loadAllData();