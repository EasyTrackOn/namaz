let studentDetailCache = null;
let studentDetailMode = "selected"; // "selected" | "overall"
let studentTrendChartInstance = null;

(function initAdminModule() {
  document.getElementById("btnShowAdminLogin").addEventListener("click", () => {
    showView("adminLoginView");
  });

  document.getElementById("btnShowStudentLogin").addEventListener("click", () => {
    showView("studentLoginView");
  });

  document.getElementById("btnAdminLogout").addEventListener("click", () => {
    appState.adminPin = "";
    document.getElementById("adminPinInput").value = "";
    closeStudentDetailPanel();
    showView("studentLoginView");
  });

  document.getElementById("adminFilterDateInput").addEventListener("change", (e) => {
    e.target.value = clampDate(e.target.value);
    document.getElementById("adminFilterDayLabel").textContent = formatReadableDateWithDay(e.target.value);
  });

  // Admin Login
  document.getElementById("btnAdminLogin").addEventListener("click", async () => {
    const pin = document.getElementById("adminPinInput").value.trim();
    const errBox = document.getElementById("adminLoginError");
    if (!pin) return;

    errBox.classList.add("d-none");
    const btn = document.getElementById("btnAdminLogin");
    btn.disabled = true;
    btn.textContent = "Authenticating...";

    try {
      const res = await fetch(`${SCRIPT_URL}?action=adminLogin&adminPin=${encodeURIComponent(pin)}`);
      const data = await res.json();
      if (data.status !== "success") {
        errBox.textContent = data.message;
        errBox.classList.remove("d-none");
      } else {
        appState.adminPin = pin;
        renderAdminDashboard(data);
        showView("adminDashboardView");
      }
    } catch (err) {
      errBox.textContent = "Error: " + err.message;
      errBox.classList.remove("d-none");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-unlock-fill me-1"></i> Access Admin Dashboard`;
    }
  });

  // Load Report for Selected Date
  document.getElementById("btnRefreshReport").addEventListener("click", async () => {
    const filterDate = clampDate(document.getElementById("adminFilterDateInput").value);
    document.getElementById("adminFilterDateInput").value = filterDate;

    const btn = document.getElementById("btnRefreshReport");
    btn.disabled = true;
    btn.textContent = "Loading...";

    try {
      const url = `${SCRIPT_URL}?action=adminLogin&adminPin=${encodeURIComponent(appState.adminPin)}&filterDate=${encodeURIComponent(filterDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "success") {
        renderAdminDashboard(data);
        // Also refresh open student detail if one is selected
        const activeAdNo = document.getElementById("adminStudentSelect").value;
        if (activeAdNo) {
          await openStudentDetail(activeAdNo);
        }
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Load Report";
    }
  });

  // Dropdown Student Selector
  document.getElementById("adminStudentSelect").addEventListener("change", (e) => {
    const adNo = e.target.value;
    if (adNo) openStudentDetail(adNo);
    else closeStudentDetailPanel();
  });

  // Toggle Buttons: Selected Date vs Overall
  document.getElementById("btnModeSelectedDate").addEventListener("click", () => {
    studentDetailMode = "selected";
    updateDetailModeButtons();
    renderStudentDetailBody();
  });

  document.getElementById("btnModeOverall").addEventListener("click", () => {
    studentDetailMode = "overall";
    updateDetailModeButtons();
    renderStudentDetailBody();
  });

  document.getElementById("btnCloseStudentDetail").addEventListener("click", closeStudentDetailPanel);

  // Search Filter in Consolidated Table
  document.getElementById("adminSearchInput").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = appState.consolidatedData.filter(r =>
      r.adNo.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
    renderConsolidatedTable(filtered);
  });
})();

function renderAdminDashboard(data) {
  appState.consolidatedData = data.consolidated;

  const clampedTarget = clampDate(data.targetDate);
  document.getElementById("adminFilterDateInput").value = clampedTarget;
  document.getElementById("adminFilterDayLabel").textContent = formatReadableDateWithDay(clampedTarget);

  // Populate Student Dropdown
  const sel = document.getElementById("adminStudentSelect");
  const prevVal = sel.value;
  sel.innerHTML = `<option value="">-- Select Student for Detailed View & Trend Graph --</option>` +
    data.consolidated.map(s => `<option value="${s.adNo}">${s.adNo} - ${s.name}</option>`).join("");
  if (prevVal) sel.value = prevVal;

  const submittedCount = data.targetDateSubmissions;
  const total = data.totalStudents;
  document.getElementById("kpiSubmitted").textContent = `${submittedCount} / ${total}`;
  document.getElementById("kpiPending").textContent = `${total - submittedCount}`;

  const submittedRows = data.consolidated.filter(r => r.submitted);
  const avgDaily = submittedRows.length
    ? Math.round((submittedRows.reduce((s, r) => s + r.dailyScore, 0) / (submittedRows.length * 14)) * 100)
    : 0;
  const fullSalah = submittedRows.filter(r => r.dailySalah === 5).length;

  document.getElementById("kpiClassAvg").textContent = `${avgDaily}%`;
  document.getElementById("kpiFullSalah").textContent = `${fullSalah}`;

  renderConsolidatedTable(data.consolidated);
  renderAdminCharts(data.consolidated, data.habitBreakdown);
}

function renderConsolidatedTable(rows) {
  const tbody = document.getElementById("consolidatedTableBody");
  tbody.innerHTML = rows.map(r => `
    <tr style="cursor: pointer;" onclick="openStudentDetail('${r.adNo}')" title="Click to view ${r.name}'s detailed report & trend graph">
      <td class="fw-bold text-primary">${r.adNo}</td>
      <td class="fw-semibold">${r.name} <i class="bi bi-graph-up-arrow text-muted ms-1 small"></i></td>
      <td>
        ${r.submitted
          ? `<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle me-1"></i>Responded</span>`
          : `<span class="badge bg-danger-subtle text-danger"><i class="bi bi-clock me-1"></i>No Response</span>`}
      </td>
      <td class="fw-semibold">${r.submitted ? `${r.dailyScore} / 14` : "-"}</td>
      <td>${r.submitted ? `${r.dailySalah} / 5` : "-"}</td>
      <td class="text-muted">${r.time}</td>
      <td>${r.daysLogged}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="progress flex-grow-1" style="height: 6px; min-width: 50px;">
            <div class="progress-bar" style="width:${r.avgPct}%; background:#0f766e;"></div>
          </div>
          <span class="fw-semibold">${r.avgPct}%</span>
        </div>
      </td>
    </tr>
  `).join("");
}

// Fetch & Open Individual Student Detail View
async function openStudentDetail(adNo) {
  const panel = document.getElementById("studentDetailPanel");
  const filterDate = document.getElementById("adminFilterDateInput").value;
  document.getElementById("adminStudentSelect").value = adNo;

  panel.classList.remove("d-none");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("detailStudentTitle").textContent = `Loading ${adNo}...`;

  try {
    const url = `${SCRIPT_URL}?action=studentDetail&adminPin=${encodeURIComponent(appState.adminPin)}&adNo=${encodeURIComponent(adNo)}&filterDate=${encodeURIComponent(filterDate)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "success") {
      alert(data.message);
      return;
    }

    studentDetailCache = data;
    document.getElementById("detailStudentTitle").textContent = `${data.studentName} (Ad No: ${data.adNo})`;

    // Trend badge calculation (latest day vs previous day)
    const trendBadge = document.getElementById("detailTrendBadge");
    if (data.history.length >= 2) {
      const last = data.history[data.history.length - 1].score;
      const prev = data.history[data.history.length - 2].score;
      const diff = last - prev;
      if (diff > 0) {
        trendBadge.className = "badge bg-success-subtle text-success fs-6";
        trendBadge.innerHTML = `<i class="bi bi-graph-up-arrow me-1"></i>Improving (+${diff} pts)`;
      } else if (diff < 0) {
        trendBadge.className = "badge bg-danger-subtle text-danger fs-6";
        trendBadge.innerHTML = `<i class="bi bi-graph-down-arrow me-1"></i>Dropped (${diff} pts)`;
      } else {
        trendBadge.className = "badge bg-secondary-subtle text-dark fs-6";
        trendBadge.innerHTML = `<i class="bi bi-dash-lg me-1"></i>Steady (${last}/14)`;
      }
    } else if (data.history.length === 1) {
      trendBadge.className = "badge bg-info-subtle text-primary fs-6";
      trendBadge.textContent = `1 Day Logged (${data.history[0].score}/14)`;
    } else {
      trendBadge.className = "badge bg-warning-subtle text-dark fs-6";
      trendBadge.textContent = "No Logs Yet";
    }

    updateDetailModeButtons();
    renderStudentTrendLineChart(data.history);
    renderStudentDetailBody();
  } catch (err) {
    alert("Error loading student details: " + err.message);
  }
}

function closeStudentDetailPanel() {
  document.getElementById("studentDetailPanel").classList.add("d-none");
  document.getElementById("adminStudentSelect").value = "";
  studentDetailCache = null;
}

function updateDetailModeButtons() {
  const btnSel = document.getElementById("btnModeSelectedDate");
  const btnOvr = document.getElementById("btnModeOverall");
  if (studentDetailMode === "selected") {
    btnSel.className = "btn btn-sm btn-primary fw-semibold";
    btnOvr.className = "btn btn-sm btn-outline-primary fw-semibold";
  } else {
    btnSel.className = "btn btn-sm btn-outline-primary fw-semibold";
    btnOvr.className = "btn btn-sm btn-primary fw-semibold";
  }
}

function renderStudentDetailBody() {
  if (!studentDetailCache) return;
  const data = studentDetailCache;
  const statsContainer = document.getElementById("detailSummaryStats");
  const listContainer = document.getElementById("detailHabitsBreakdown");

  if (studentDetailMode === "selected") {
    const d = data.selectedDay;
    statsContainer.innerHTML = `
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Date (${d.day})</div>
          <div class="fw-bold">${d.date}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Daily Score</div>
          <div class="fw-bold text-success">${d.submitted ? `${d.score} / 14 (${d.pct}%)` : "Not Submitted"}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Fard Salah</div>
          <div class="fw-bold text-primary">${d.submitted ? `${d.salah} / 5` : "-"}</div>
        </div>
      </div>
    `;

    if (!d.submitted) {
      listContainer.innerHTML = `<div class="alert alert-warning small mb-0">No entry submitted by <strong>${data.studentName}</strong> on ${d.date}.</div>`;
      return;
    }

    listContainer.innerHTML = data.overall.habitStats.map(h => {
      const status = d.responses[h.id];
      const isDone = status === "DONE";
      return `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom small">
          <span>${h.text}</span>
          ${isDone
            ? `<span class="badge bg-success"><i class="bi bi-check-lg me-1"></i>Done</span>`
            : `<span class="badge bg-danger"><i class="bi bi-x-lg me-1"></i>Not Done</span>`}
        </div>
      `;
    }).join("");
  } else {
    // OVERALL MODE
    const o = data.overall;
    statsContainer.innerHTML = `
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Days Logged</div>
          <div class="fw-bold">${o.daysLogged} Day(s)</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Overall Score</div>
          <div class="fw-bold text-success">${o.totalDone} / ${o.maxPossible} (${o.avgPct}%)</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 bg-light rounded-3 text-center">
          <div class="small text-muted">Overall Salah</div>
          <div class="fw-bold text-primary">${o.totalSalah} / ${o.daysLogged * 5} (${o.salahPct}%)</div>
        </div>
      </div>
    `;

    if (o.daysLogged === 0) {
      listContainer.innerHTML = `<div class="alert alert-warning small mb-0">No historical records logged yet for this student.</div>`;
      return;
    }

    listContainer.innerHTML = o.habitStats.map(h => `
      <div class="py-2 border-bottom small">
        <div class="d-flex justify-content-between mb-1">
          <span>${h.text}</span>
          <span class="fw-bold">${h.doneDays}/${h.totalDays} days (${h.ratePct}%)</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar ${h.ratePct >= 75 ? "bg-success" : h.ratePct >= 40 ? "bg-warning" : "bg-danger"}" style="width: ${h.ratePct}%"></div>
        </div>
      </div>
    `).join("");
  }
}

function renderStudentTrendLineChart(history) {
  if (studentTrendChartInstance) studentTrendChartInstance.destroy();
  const ctx = document.getElementById("studentTrendLineChart");

  const labels = history.length ? history.map(h => `${h.date.slice(5)} (${h.day})`) : ["No Data"];
  const totalScores = history.length ? history.map(h => h.score) : [0];
  const salahScores = history.length ? history.map(h => h.salah) : [0];

  studentTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Routine Score (out of 14)",
          data: totalScores,
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.12)",
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: "#0f766e",
          fill: true,
          tension: 0.25
        },
        {
          label: "5 Daily Salah (out of 5)",
          data: salahScores,
          borderColor: "#d97706",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          pointBackgroundColor: "#d97706",
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 14, ticks: { stepSize: 2 } }
      }
    }
  });
}

function renderAdminCharts(consolidated, habitBreakdown) {
  if (appState.charts.student) appState.charts.student.destroy();
  if (appState.charts.habit) appState.charts.habit.destroy();

  const ctx1 = document.getElementById("studentBarChart");
  appState.charts.student = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: consolidated.map(s => s.adNo),
      datasets: [{
        label: "Done (✓) out of 14",
        data: consolidated.map(s => s.dailyScore),
        backgroundColor: consolidated.map(s => s.submitted ? "#0f766e" : "#cbd5e1"),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 14 } },
      plugins: { legend: { display: false } }
    }
  });

  const ctx2 = document.getElementById("habitBarChart");
  appState.charts.habit = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: habitBreakdown.map(h => h.label),
      datasets: [
        {
          label: "Done (✓)",
          data: habitBreakdown.map(h => h.doneCount),
          backgroundColor: "#16a34a",
          borderRadius: 4
        },
        {
          label: "Not Done (✕)",
          data: habitBreakdown.map(h => h.crossCount),
          backgroundColor: "#dc2626",
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      scales: {
        x: { stacked: true, beginAtZero: true, max: consolidated.length || 20 },
        y: { stacked: true }
      }
    }
  });
}
