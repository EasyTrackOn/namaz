// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL BELOW
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwrih5qsSLkC3qMYEty3yx-x44tuIk4Jj4PZgSpY3WOkOyA2QXaZs6aFUJlHTRaUe19Pw/exec";

const START_DATE = "2026-11-17";

const appState = {
  habits: [],
  minAllowedDate: START_DATE,
  maxAllowedDate: "",
  currentUser: null,
  responses: {}, // { h1: "DONE" | "NOT_DONE" }
  adminPin: "",
  consolidatedData: [],
  charts: { student: null, habit: null }
};

function getTodayLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

function formatReadableDateWithDay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getDayOnly(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}

function applyDateConstraints(minDate, maxDate) {
  appState.minAllowedDate = minDate;
  appState.maxAllowedDate = maxDate;
  ["dateInput", "trackerDateInput", "adminFilterDateInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.min = minDate;
      el.max = maxDate;
    }
  });
}

function clampDate(isoDate) {
  if (!isoDate) return appState.maxAllowedDate;
  if (isoDate < appState.minAllowedDate) return appState.minAllowedDate;
  if (isoDate > appState.maxAllowedDate) return appState.maxAllowedDate;
  return isoDate;
}

function showView(viewId) {
  ["studentLoginView", "trackerView", "adminLoginView", "adminDashboardView"].forEach(id => {
    document.getElementById(id).classList.toggle("d-none", id !== viewId);
  });
  const isAdminArea = (viewId === "adminLoginView" || viewId === "adminDashboardView");
  document.getElementById("btnShowStudentLogin").classList.toggle("d-none", !isAdminArea);
  document.getElementById("btnShowAdminLogin").classList.toggle("d-none", isAdminArea);
}
