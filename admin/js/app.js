import {
  auth,
  browserSessionPersistence,
  httpsCallable,
  setPersistence,
  signIn,
  signOut,
  functions,
} from "./firebase.js";
import { onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const sections = {
  overview: { title: "Overview" },
  partners: {
    title: "Partner management",
    description: "Approved and pending sports facility accounts.",
    statusField: "status",
    statuses: ["active", "pending", "suspended"],
  },
  companies: {
    title: "Corporate management",
    description: "Corporate customer accounts and their current status.",
    statusField: "status",
    statuses: ["active", "pending", "suspended"],
  },
  partnerInquiries: {
    title: "Partner requests",
    description: "Review facility inquiries and keep an internal follow-up history.",
    statusField: "status",
    statuses: ["new", "contacted", "under_review", "approved", "rejected"],
  },
  corporateInquiries: {
    title: "Corporate requests",
    description: "Review corporate inquiries and keep an internal follow-up history.",
    statusField: "status",
    statuses: ["new", "contacted", "under_review", "approved", "rejected"],
  },
  customers: {
    title: "Customer management",
    description: "Customer profiles and account status. Membership balances are read-only here.",
    statusField: "accountStatus",
    statuses: ["active", "suspended", "disabled"],
  },
  memberships: {
    title: "Memberships",
    description: "Membership entitlements across individual and corporate accounts.",
    statusField: "status",
    statuses: ["active", "expired", "suspended", "cancelled"],
  },
  checkIns: {
    title: "Check-ins",
    description: "Recorded venue visits and pass redemptions.",
    statusField: "status",
    statuses: ["successful", "reversed"],
  },
  admins: {
    title: "Administrator accounts",
    description: "Provisioned Super Admin access grants.",
  },
};

const statusLabels = {
  new: "New",
  contacted: "Contacted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
  disabled: "Disabled",
  revoked: "Revoked",
  expired: "Expired",
  cancelled: "Cancelled",
  successful: "Successful",
  reversed: "Reversed",
  verified: "Verified",
};

const authScreen = document.querySelector("#auth-screen");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const content = document.querySelector("#content");
const pageTitle = document.querySelector("#page-title");
const dialog = document.querySelector("#detail-dialog");
const dialogBody = document.querySelector("#dialog-body");
const dialogTitle = document.querySelector("#dialog-title");
const sidebar = document.querySelector("#sidebar");
const adminEmail = document.querySelector("#admin-email");

let activeSection = "overview";
let recordState = null;
let overviewData = null;

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined && text !== null) result.textContent = String(text);
  return result;
}

function setLoginMessage(message) {
  loginMessage.textContent = message ?? "";
}

function showLogin(message = "") {
  dashboard.hidden = true;
  authScreen.hidden = false;
  setLoginMessage(message);
}

function showDashboard(user) {
  authScreen.hidden = true;
  dashboard.hidden = false;
  adminEmail.textContent = user.email ?? user.uid;
}

async function callFunction(name, data = {}) {
  try {
    const result = await httpsCallable(functions, name)(data);
    return result.data;
  } catch (error) {
    if (error.code === "functions/permission-denied") {
      await signOut(auth);
    }
    throw error;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PK").format(Number(value) || 0);
}

function formatMoney(paisa) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(Number(paisa) / 100);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelFor(value) {
  if (statusLabels[value]) return statusLabels[value];
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makeButton(label, className, onClick) {
  const button = node("button", `button ${className}`, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function setLoading(message = "Loading records…") {
  content.replaceChildren(node("p", "loading-state", message));
}

function showError(message, retry) {
  const wrapper = node("div", "error-state");
  wrapper.append(node("p", "", message));
  if (retry) {
    wrapper.append(makeButton("Try again", "button-secondary", retry));
  }
  content.replaceChildren(wrapper);
}

function updateRequestBadges(data) {
  const partnerBadge = document.querySelector("#partner-request-count");
  const corporateBadge = document.querySelector("#corporate-request-count");
  partnerBadge.textContent = formatNumber(data.pendingPartnerRequests);
  corporateBadge.textContent = formatNumber(data.pendingCorporateRequests);
  partnerBadge.hidden = !data.pendingPartnerRequests;
  corporateBadge.hidden = !data.pendingCorporateRequests;
}

function metricCard(label, value, note = "") {
  const card = node("article", "metric-card");
  card.append(node("p", "metric-label", label));
  card.append(node("p", "metric-value", value));
  if (note) card.append(node("p", "metric-note", note));
  return card;
}

function sectionLink(label, section) {
  const button = node("button", "quick-link");
  button.type = "button";
  button.append(node("span", "", label), node("span", "", "View →"));
  button.addEventListener("click", () => openSection(section));
  return button;
}

function renderOverview(data) {
  overviewData = data;
  updateRequestBadges(data);

  const heading = node("div", "section-heading");
  const intro = node("div");
  intro.append(
    node("h2", "", "Platform snapshot"),
    node("p", "", "Live counts from the Sportspass Firebase project."),
  );
  heading.append(intro);

  const grid = node("div", "metric-grid");
  [
    metricCard("Total partners", formatNumber(data.totalPartners)),
    metricCard("Active partners", formatNumber(data.activePartners)),
    metricCard("Partner requests to review", formatNumber(data.pendingPartnerRequests)),
    metricCard("Corporate companies", formatNumber(data.totalCompanies)),
    metricCard("Active corporate accounts", formatNumber(data.activeCompanies)),
    metricCard("Corporate requests to review", formatNumber(data.pendingCorporateRequests)),
    metricCard("Customers", formatNumber(data.totalCustomers)),
    metricCard("Active memberships", formatNumber(data.activeMemberships)),
    metricCard("Recorded check-ins", formatNumber(data.totalCheckIns)),
    metricCard(
      "Verified payment revenue",
      data.revenuePaisa === null ? "—" : formatMoney(data.revenuePaisa),
      data.verifiedPayments
        ? `${formatNumber(data.verifiedPayments)} verified payment records`
        : "No verified payment data",
    ),
  ].forEach((card) => grid.append(card));

  const panels = node("div", "overview-grid");
  const partnerPanel = node("section", "panel");
  partnerPanel.append(
    node("h3", "", "Partner operations"),
    node("p", "subtle", "Review requests and manage facility accounts."),
  );
  const partnerLinks = node("div", "quick-list");
  partnerLinks.append(
    sectionLink("Partner requests", "partnerInquiries"),
    sectionLink("Partner accounts", "partners"),
  );
  partnerPanel.append(partnerLinks);

  const companyPanel = node("section", "panel");
  companyPanel.append(
    node("h3", "", "Corporate operations"),
    node("p", "subtle", "Review company inquiries and manage accounts."),
  );
  const companyLinks = node("div", "quick-list");
  companyLinks.append(
    sectionLink("Corporate requests", "corporateInquiries"),
    sectionLink("Corporate accounts", "companies"),
  );
  companyPanel.append(companyLinks);
  panels.append(partnerPanel, companyPanel);

  content.replaceChildren(heading, grid, panels);
}

async function loadOverview() {
  setLoading("Loading live platform totals…");
  try {
    const data = await callFunction("getAdminOverview");
    renderOverview(data);
  } catch (error) {
    showError(`Could not load the overview: ${error.message}`, loadOverview);
  }
}

function nameFor(section, record) {
  if (section === "partnerInquiries") {
    return [record.firstName, record.lastName].filter(Boolean).join(" ") ||
      record.facilityName || "Partner request";
  }
  if (section === "corporateInquiries") {
    return record.firstName || record.companyName || record.company ||
      "Corporate request";
  }
  if (section === "partners") {
    return record.displayName || record.businessName || record.name ||
      record.legalName || "Partner";
  }
  if (section === "companies") {
    return record.companyName || record.name || record.legalName || "Company";
  }
  if (section === "customers") {
    return record.fullName ||
      [record.firstName, record.lastName].filter(Boolean).join(" ") ||
      record.email || "Customer";
  }
  if (section === "memberships") {
    return record.planSnapshot?.name || record.planId || "Membership";
  }
  if (section === "checkIns") return record.branchId || "Venue check-in";
  return record.displayName || record.email || record.uid || record.id;
}

function emailFor(record) {
  return record.email || record.userId || record.uid || "—";
}

function statusFor(section, record) {
  return record.accountStatus || record.status || "—";
}

function dateFor(section, record) {
  return record.createdAt || record.checkedInAt || record.startsAt;
}

function statusPill(status) {
  const value = String(status || "unknown");
  return node("span", `status-pill status-${value}`, labelFor(value));
}

function recordSummary(section, record) {
  if (section === "partnerInquiries") return record.facilityName || record.email || "";
  if (section === "corporateInquiries") {
    return `${record.companyName || record.company || ""}${
      record.employeeCount ? ` · ${record.employeeCount} employees` : ""
    }`;
  }
  if (section === "memberships") {
    return `${labelFor(record.type || "individual")} · ${record.passesRemaining ?? "—"} passes`;
  }
  if (section === "checkIns") return `Branch ${record.branchId || "—"}`;
  if (section === "partners" || section === "companies") {
    return record.email || record.phone || record.phoneNumber || "";
  }
  return record.phoneNumber || "";
}

function makeTable(section, state) {
  const wrapper = node("div", "table-panel");
  const toolbar = node("div", "table-toolbar");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search loaded records";
  search.setAttribute("aria-label", "Search loaded records");
  search.value = state.search;
  const filter = document.createElement("select");
  filter.setAttribute("aria-label", "Filter records by status");
  const allOption = node("option", "", "All statuses");
  allOption.value = "";
  filter.append(allOption);
  for (const status of sections[section].statuses || []) {
    const option = node("option", "", labelFor(status));
    option.value = status;
    option.selected = state.status === status;
    filter.append(option);
  }
  filter.disabled = !sections[section].statuses;
  toolbar.append(search, filter);

  const tableWrap = node("div", "table-wrap");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Name / record", "Email or account", "Status", "Created", "Actions"].forEach(
    (label) => headerRow.append(node("th", "", label)),
  );
  thead.append(headerRow);
  const tbody = document.createElement("tbody");

  const needle = state.search.trim().toLowerCase();
  const records = state.records.filter((record) => {
    if (!needle) return true;
    return JSON.stringify(record).toLowerCase().includes(needle);
  });

  for (const record of records) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const primary = node("div", "record-primary");
    primary.append(
      node("strong", "", nameFor(section, record)),
      node("span", "record-secondary", recordSummary(section, record)),
    );
    nameCell.append(primary);
    row.append(nameCell, node("td", "", emailFor(record)));

    const statusCell = document.createElement("td");
    statusCell.append(statusPill(statusFor(section, record)));
    row.append(statusCell, node("td", "", formatDate(dateFor(section, record))));

    const actions = node("div", "table-actions");
    actions.append(
      makeButton("View", "button-secondary button-small", () =>
        openRecord(section, record),
      ),
    );
    if (section === "partnerInquiries" || section === "corporateInquiries") {
      actions.append(
        makeButton("Review", "button-primary button-small", () =>
          openInquiry(section, record.id),
        ),
      );
    }
    if (
      (section === "partners" || section === "companies") &&
      ["active", "suspended"].includes(record.status)
    ) {
      const nextStatus = record.status === "active" ? "suspended" : "active";
      actions.append(
        makeButton(
          nextStatus === "suspended" ? "Suspend" : "Activate",
          nextStatus === "suspended"
            ? "button-danger button-small"
            : "button-primary button-small",
          () => changeBusinessStatus(section, record, nextStatus),
        ),
      );
    }
    const actionCell = document.createElement("td");
    actionCell.append(actions);
    row.append(actionCell);
    tbody.append(row);
  }

  if (records.length === 0) {
    const row = document.createElement("tr");
    const cell = node(
      "td",
      "empty-state",
      state.records.length
        ? "No loaded records match this search."
        : "No records found. New records will appear here when available.",
    );
    cell.colSpan = 5;
    row.append(cell);
    tbody.append(row);
  }

  table.append(thead, tbody);
  tableWrap.append(table);
  const footer = node("div", "table-footer");
  const displayed = state.records.length;
  footer.append(
    node(
      "span",
      "",
      `${formatNumber(displayed)} records loaded · search covers loaded records`,
    ),
  );
  if (state.cursor) {
    footer.append(
      makeButton("Load more", "button-secondary button-small", () =>
        loadRecords(section, false),
      ),
    );
  }
  wrapper.append(toolbar, tableWrap, footer);

  search.addEventListener("input", () => {
    state.search = search.value;
    const replacement = makeTable(section, state);
    const position = search.selectionStart;
    wrapper.replaceWith(replacement);
    const replacementSearch = replacement.querySelector('input[type="search"]');
    replacementSearch.focus();
    replacementSearch.setSelectionRange(position, position);
  });
  filter.addEventListener("change", () => {
    state.status = filter.value;
    loadRecords(section, true);
  });
  return wrapper;
}

function renderRecords(section, state) {
  const heading = node("div", "section-heading");
  const text = node("div");
  text.append(
    node("h2", "", sections[section].title),
    node("p", "", sections[section].description),
  );
  heading.append(text);

  const notices = [];
  if (section === "admins") {
    notices.push(
      node(
        "div",
        "notice",
        "Administrator access is provisioned only through the trusted backend script. There is no public admin registration or in-dashboard role grant.",
      ),
    );
  }
  if (section === "customers") {
    notices.push(
      node(
        "div",
        "notice",
        "Customer records are read-only here. Membership balances and check-in history must be changed only by trusted backend operations.",
      ),
    );
  }
  content.replaceChildren(heading, ...notices, makeTable(section, state));
}

async function loadRecords(section, reset = true) {
  if (reset || !recordState || recordState.section !== section) {
    recordState = {
      section,
      records: [],
      cursor: null,
      status: "",
      search: "",
    };
  }
  const state = recordState;
  if (reset) setLoading("Loading records…");
  try {
    const response = await callFunction("listAdminRecords", {
      section,
      pageSize: 30,
      status: state.status,
      cursor: reset ? null : state.cursor,
    });
    state.records = reset
      ? response.records
      : [...state.records, ...response.records];
    state.cursor = response.nextCursor;
    renderRecords(section, state);
  } catch (error) {
    showError(`Could not load ${sections[section].title.toLowerCase()}: ${error.message}`, () =>
      loadRecords(section, true),
    );
  }
}

async function openSection(section) {
  if (!sections[section]) return;
  activeSection = section;
  pageTitle.textContent = sections[section].title;
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.section === section);
  });
  sidebar.classList.remove("open");
  document.querySelector("#mobile-menu").setAttribute("aria-expanded", "false");
  content.focus({ preventScroll: true });

  if (section === "overview") {
    await loadOverview();
  } else {
    await loadRecords(section);
  }
}

function addDetailField(grid, label, value) {
  const field = node("div", "detail-field");
  field.append(
    node("span", "", labelFor(label)),
    node("strong", "", value === undefined || value === null || value === ""
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : value),
  );
  grid.append(field);
}

function openRecord(section, record) {
  if (section === "customers") {
    openCustomerDetails(record.id);
    return;
  }
  dialogTitle.textContent = nameFor(section, record);
  const grid = node("div", "detail-grid");
  for (const [key, value] of Object.entries(record)) {
    if (key !== "id") addDetailField(grid, key, key.toLowerCase().includes("paisa") ? formatMoney(value) : value);
  }
  dialogBody.replaceChildren(grid);
  dialog.showModal();
}

function historySection(title, records, fields) {
  const section = node("section", "dialog-section");
  section.append(node("h3", "", `${title} (${records.length})`));
  if (!records.length) {
    section.append(node("p", "subtle", `No ${title.toLowerCase()} found.`));
    return section;
  }
  const list = node("div", "note-list");
  for (const record of records) {
    const item = node("article", "note-item");
    for (const field of fields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = /At$/i.test(field)
          ? formatDate(record[field])
          : ["type", "status"].includes(field)
            ? labelFor(String(record[field]))
            : record[field];
        item.append(
          node(
            "p",
            "",
            `${labelFor(field)}: ${value}`,
          ),
        );
      }
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

async function openCustomerDetails(uid) {
  dialogTitle.textContent = "Loading customer…";
  dialogBody.replaceChildren(
    node("p", "loading-state", "Loading customer history…"),
  );
  dialog.showModal();
  try {
    const details = await callFunction("getCustomerDetails", { uid });
    dialogTitle.textContent = nameFor("customers", details.profile);
    const profile = node("div", "detail-grid");
    for (const [key, value] of Object.entries(details.profile)) {
      if (key !== "id") addDetailField(profile, key, value);
    }

    const companySection = node("section", "dialog-section");
    companySection.append(
      node(
        "h3",
        "",
        `Corporate associations (${details.corporateAssociations.length})`,
      ),
    );
    if (!details.corporateAssociations.length) {
      companySection.append(
        node("p", "subtle", "No corporate account association found."),
      );
    } else {
      const associations = node("div", "note-list");
      for (const company of details.corporateAssociations) {
        const item = node("article", "note-item");
        item.append(
          node("strong", "", company.companyName || company.companyId),
          node(
            "p",
            "",
            `${labelFor(company.role)} · ${labelFor(company.status || "active")} · Joined ${formatDate(company.joinedAt)}`,
          ),
        );
        associations.append(item);
      }
      companySection.append(associations);
    }

    dialogBody.replaceChildren(
      profile,
      companySection,
      historySection("Membership history", details.memberships, [
        "planId",
        "type",
        "status",
        "startsAt",
        "expiresAt",
        "passesTotal",
        "passesRemaining",
        "companyId",
      ]),
      historySection("Check-in history", details.checkIns, [
        "branchId",
        "partnerId",
        "companyId",
        "passesUsed",
        "status",
        "checkedInAt",
      ]),
    );
  } catch (error) {
    dialogBody.replaceChildren(
      node("p", "error-state", `Could not load customer details: ${error.message}`),
    );
  }
}

async function openInquiry(section, id) {
  dialogTitle.textContent = "Loading request…";
  dialogBody.replaceChildren(node("p", "loading-state", "Loading request details…"));
  if (!dialog.open) dialog.showModal();
  const type = section === "partnerInquiries" ? "partner" : "corporate";
  try {
    const response = await callFunction("getInquiryDetails", { type, id });
    renderInquiryDialog(type, response.inquiry, response.notes);
  } catch (error) {
    dialogBody.replaceChildren(
      node("p", "error-state", `Could not load this request: ${error.message}`),
    );
  }
}

function renderInquiryDialog(type, record, notes) {
  dialogTitle.textContent = nameFor(
    type === "partner" ? "partnerInquiries" : "corporateInquiries",
    record,
  );
  const section = type === "partner" ? "partnerInquiries" : "corporateInquiries";
  const grid = node("div", "detail-grid");
  for (const [key, value] of Object.entries(record)) {
    if (key !== "id") addDetailField(grid, key, key.toLowerCase().includes("paisa") ? formatMoney(value) : value);
  }

  const review = node("section", "dialog-section");
  review.append(node("h3", "", "Update request"));
  const statusLabel = node("label", "field-label", "Request status");
  statusLabel.htmlFor = "request-status";
  const status = document.createElement("select");
  status.id = "request-status";
  for (const value of sections[section].statuses) {
    const option = node("option", "", labelFor(value));
    option.value = value;
    option.selected = record.status === value;
    status.append(option);
  }
  const noteLabel = node("label", "field-label", "Internal note (optional)");
  noteLabel.htmlFor = "request-note";
  const note = document.createElement("textarea");
  note.id = "request-note";
  note.maxLength = 1000;
  note.placeholder = "Add a private follow-up note for Sportspass administrators";
  const error = node("p", "dialog-error");
  const save = makeButton("Save update", "button-primary", async () => {
    save.disabled = true;
    error.textContent = "";
    try {
      await callFunction("updateInquiry", {
        type,
        id: record.id,
        status: status.value,
        note: note.value,
      });
      await openInquiry(section, record.id);
      await loadRecords(section);
      const overview = await callFunction("getAdminOverview");
      updateRequestBadges(overview);
    } catch (updateError) {
      error.textContent = `Could not save request: ${updateError.message}`;
      save.disabled = false;
    }
  });
  const actions = node("div", "dialog-actions");
  actions.append(save);
  review.append(statusLabel, status, noteLabel, note, error, actions);

  const noteSection = node("section", "dialog-section");
  noteSection.append(node("h3", "", "Internal notes"));
  const noteList = node("div", "note-list");
  if (!notes.length) {
    noteList.append(node("p", "subtle", "No internal notes yet."));
  } else {
    for (const item of notes) {
      const noteItem = node("article", "note-item");
      noteItem.append(
        node("span", "note-meta", `${item.authorUid || "Admin"} · ${formatDate(item.createdAt)}`),
        node("p", "", item.body || ""),
      );
      noteList.append(noteItem);
    }
  }
  noteSection.append(noteList);
  dialogBody.replaceChildren(grid, review, noteSection);
}

async function changeBusinessStatus(section, record, nextStatus) {
  const business = section === "partners" ? "partner" : "company";
  const label = nameFor(section, record);
  const action = nextStatus === "suspended" ? "suspend" : "activate";
  if (!window.confirm(`Are you sure you want to ${action} ${label}?`)) return;
  try {
    await callFunction("setBusinessStatus", {
      entityType: business,
      id: record.id,
      status: nextStatus,
    });
    await loadRecords(section);
    await loadOverview();
  } catch (error) {
    showError(`Could not update this account: ${error.message}`, () =>
      loadRecords(section),
    );
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setLoginMessage("");
  try {
    await setPersistence(auth, browserSessionPersistence);
    const email = new FormData(loginForm).get("email").toString().trim();
    const password = new FormData(loginForm).get("password").toString();
    const credential = await signIn(auth, email, password);
    const token = await getIdTokenResult(credential.user, true);
    if (
      token.claims.superAdmin !== true ||
      token.claims.email_verified !== true
    ) {
      await signOut(auth);
      setLoginMessage(
        "Use an authorized Super Admin account with a verified email address.",
      );
    }
  } catch (error) {
    setLoginMessage(error.message || "Sign-in failed. Please try again.");
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#sign-out").addEventListener("click", () => signOut(auth));
document.querySelector("#refresh").addEventListener("click", () => {
  if (activeSection === "overview") loadOverview();
  else loadRecords(activeSection);
});
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#mobile-menu").addEventListener("click", (event) => {
  const isOpen = sidebar.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.querySelector("[data-home]").addEventListener("click", (event) => {
  event.preventDefault();
  openSection("overview");
});
document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => openSection(button.dataset.section));
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }
  try {
    const token = await getIdTokenResult(user, true);
    if (
      token.claims.superAdmin !== true ||
      token.claims.email_verified !== true
    ) {
      await signOut(auth);
      showLogin(
        "Use an authorized Super Admin account with a verified email address.",
      );
      return;
    }
    showDashboard(user);
    activeSection = "overview";
    await loadOverview();
  } catch (error) {
    showLogin(`Could not verify administrator access: ${error.message}`);
  }
});
