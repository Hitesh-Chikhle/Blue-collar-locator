/**
 * Blue Collar — Professional Workstation & Dashboard Module
 * Real-time job state transitions, presence heartbeats, stale presence detection,
 * live GPS location sharing, profile editor, and technician registration.
 */

import { store, dataService } from './state.js';
import { ICONS, showToast, openModal, closeModal } from './ui.js';

// ============================================================================
// 1. Strict Job Lifecycle Transitions
// ============================================================================

export const JOB_TRANSITIONS = {
  "Booking Confirmed": ["Accepted", "Declined"],
  "Accepted": ["On the Way", "Cancelled"],
  "On the Way": ["Arrived", "Cancelled"],
  "Arrived": ["Work in Progress", "Cancelled"],
  "Work in Progress": ["Completed"],
  "Completed": [],
  "Declined": [],
  "Cancelled": []
};

export function isValidTransition(fromStatus, toStatus) {
  const allowed = JOB_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

// ============================================================================
// 2. Presence Heartbeat & Stale Presence Detection
// ============================================================================

let heartbeatInterval = null;
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export function startPresenceHeartbeat() {
  if (heartbeatInterval) return;

  // Send initial heartbeat
  sendHeartbeat();

  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopPresenceHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function sendHeartbeat() {
  const pro = store.getState().currentProfessional;
  if (!pro) return;

  const now = Date.now();
  pro.lastSeen = now;
  await dataService.updatePresence(pro.id, {
    isAvailable: pro.isAvailable,
    presenceStatus: pro.presenceStatus || (pro.isAvailable ? "available" : "offline"),
    lastSeen: now
  });
}

export function isPresenceStale(pro) {
  if (!pro || !pro.lastSeen) return false;
  return Date.now() - pro.lastSeen > STALE_THRESHOLD_MS;
}

export async function setWorkerPresence(newStatus) {
  const pro = store.getState().currentProfessional;
  if (!pro) return;

  const isAvailable = newStatus === "available";
  pro.presenceStatus = newStatus;
  pro.isAvailable = isAvailable;
  pro.lastSeen = Date.now();

  await dataService.updatePresence(pro.id, {
    isAvailable,
    presenceStatus: newStatus,
    lastSeen: pro.lastSeen
  });

  store.setState({ currentProfessional: pro });
  renderWorkerDashboard();
  showToast(`Presence updated: ${newStatus.toUpperCase()}`, isAvailable ? "success" : "info");
}

// ============================================================================
// 3. Live GPS Location Sharing Tracker
// ============================================================================

let activeGpsWatchId = null;
let activeTrackingBookingId = null;

export function startLiveLocationSharing(bookingId) {
  if (activeGpsWatchId) {
    stopLiveLocationSharing();
  }

  activeTrackingBookingId = bookingId;

  if (typeof navigator !== "undefined" && navigator.geolocation) {
    activeGpsWatchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          updatedAt: Date.now()
        };
        await dataService.updateBooking(bookingId, { workerLocation: coords });
        showToast("Live technician GPS coordinates broadcast to customer.", "info", 2000);
      },
      (err) => {
        console.warn("GPS watch error, using simulated location step:", err);
        simulateGpsStep(bookingId);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } else {
    simulateGpsStep(bookingId);
  }

  renderWorkerDashboard();
  showToast("Live GPS location sharing started for this job.", "success");
}

export function stopLiveLocationSharing() {
  if (activeGpsWatchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(activeGpsWatchId);
  }
  activeGpsWatchId = null;
  activeTrackingBookingId = null;
  renderWorkerDashboard();
}

async function simulateGpsStep(bookingId) {
  const booking = (store.getState().bookings || []).find((b) => b.id === bookingId);
  if (!booking) return;

  const dest = booking.address?.lat ? { lat: booking.address.lat, lng: booking.address.lng } : { lat: 12.9716, lng: 77.5946 };
  // Small simulated step towards customer
  const simulatedCoords = {
    lat: Number((dest.lat + (Math.random() - 0.5) * 0.005).toFixed(5)),
    lng: Number((dest.lng + (Math.random() - 0.5) * 0.005).toFixed(5)),
    updatedAt: Date.now()
  };
  await dataService.updateBooking(bookingId, { workerLocation: simulatedCoords });
}

// ============================================================================
// 4. Profile Completion Calculator
// ============================================================================

export function calculateProfileCompletion(pro) {
  if (!pro) return { percentage: 0, missingFields: [] };

  const requiredFields = [
    { key: "name", label: "Full Name", check: (v) => Boolean(v && v.length >= 3) },
    { key: "category", label: "Primary Category", check: (v) => Boolean(v) },
    { key: "skills", label: "Specialized Skills", check: (v) => Array.isArray(v) && v.length >= 2 },
    { key: "experienceYears", label: "Experience Years", check: (v) => Number(v) > 0 },
    { key: "bio", label: "Bio Description", check: (v) => Boolean(v && v.length >= 15) },
    { key: "visitingFee", label: "Visiting Fee", check: (v) => Number(v) > 0 },
    { key: "baseRatePerHour", label: "Hourly Labour Rate", check: (v) => Number(v) > 0 },
    { key: "areaName", label: "Service Neighborhood", check: (v) => Boolean(v) }
  ];

  const missingFields = [];
  let score = 0;

  requiredFields.forEach((f) => {
    if (f.check(pro[f.key])) {
      score++;
    } else {
      missingFields.push(f.label);
    }
  });

  const percentage = Math.round((score / requiredFields.length) * 100);
  return { percentage, missingFields };
}

// ============================================================================
// 5. Worker Dashboard HTML Renderer
// ============================================================================

export function renderWorkerDashboard() {
  const container = document.getElementById("view-dashboard");
  if (!container) return;

  const pro = store.getState().currentProfessional || {
    id: "pro_demo_1",
    name: "Ramesh Kumar",
    category: "electrician",
    categoryLabel: "Electrician",
    rating: 4.8,
    isAvailable: true,
    presenceStatus: "available",
    visitingFee: 99,
    baseRatePerHour: 299,
    experienceYears: 7,
    skills: ["Short Circuits", "Switchboards", "Wiring", "Fan Repair"],
    bio: "Residential & commercial electrical repairs.",
    areaName: "Indiranagar, Bengaluru",
    lastSeen: Date.now()
  };

  const bookings = store.getState().bookings || [];
  const notifications = store.getState().notifications || [];

  // Categorize jobs
  const newRequests = bookings.filter((b) => b.status === "Booking Confirmed");
  const activeJobs = bookings.filter((b) => ["Accepted", "On the Way", "Arrived", "Work in Progress"].includes(b.status));
  const completedJobs = bookings.filter((b) => b.status === "Completed");
  const declinedJobs = bookings.filter((b) => b.status === "Declined");

  // Calculate illustrative demo earnings
  const demoEarnings = completedJobs.reduce((acc, curr) => acc + (curr.estimatedPrice?.total || 349), 0);

  // Profile completion meter
  const completion = calculateProfileCompletion(pro);

  // Presence status
  const currentPresence = isPresenceStale(pro) ? "offline" : (pro.presenceStatus || (pro.isAvailable ? "available" : "offline"));

  container.innerHTML = `
    <!-- Dashboard Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6);">
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
          <span class="badge badge-teal">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            <span>Professional Workstation</span>
          </span>
          <span class="badge badge-default">Demo Verified</span>
        </div>
        <h1 style="font-size: var(--font-size-2xl); margin: 0;">Welcome, ${pro.name}</h1>
        <p style="font-size: var(--font-size-sm); color: var(--text-muted); margin-top: 2px;">
          ${pro.categoryLabel || pro.category} • Base: ${pro.areaName || "Bengaluru"} • Real-Time Broadcast Active
        </p>
      </div>

      <div style="display: flex; gap: var(--space-2);">
        <button type="button" class="btn btn-outline btn-sm" id="btn-open-register-pro-modal">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Register New Profile</span>
        </button>
        <button type="button" class="btn btn-teal btn-sm" id="btn-toggle-notifs-panel">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span>Alerts (${notifications.length})</span>
        </button>
      </div>
    </div>

    <!-- 1. Overview Metrics Cards -->
    <div class="dashboard-metrics-grid">
      <div class="metric-card">
        <span class="metric-card-label">New Requests</span>
        <span class="metric-card-num" style="color: var(--accent-teal);">${newRequests.length}</span>
        <span style="font-size: 11px; color: var(--text-subtle);">Awaiting your acceptance</span>
      </div>
      <div class="metric-card">
        <span class="metric-card-label">Today's Active Jobs</span>
        <span class="metric-card-num" style="color: #0284C7;">${activeJobs.length}</span>
        <span style="font-size: 11px; color: var(--text-subtle);">In transit or in progress</span>
      </div>
      <div class="metric-card">
        <span class="metric-card-label">Completed Jobs</span>
        <span class="metric-card-num" style="color: var(--status-success);">${completedJobs.length}</span>
        <span style="font-size: 11px; color: var(--text-subtle);">Successfully delivered</span>
      </div>
      <div class="metric-card">
        <span class="metric-card-label">Demo Earnings</span>
        <span class="metric-card-num" style="color: var(--primary);">₹${demoEarnings}</span>
        <span style="font-size: 11px; color: var(--text-subtle);">Direct settlement (Illustrative)</span>
      </div>
    </div>

    <!-- 2. Availability Toggle Panel (with Heartbeat) -->
    <div class="presence-panel" role="region" aria-label="Presence and Availability Control">
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px;">
          <strong style="font-size: var(--font-size-base); color: var(--text-main);">Live Availability & Presence</strong>
          ${
            isPresenceStale(pro)
              ? `<span class="badge badge-warning" style="font-size: 10px;">⚠️ Stale heartbeat (&gt;2m ago)</span>`
              : `<span class="badge badge-success" style="font-size: 10px;">🟢 Live Heartbeat Active</span>`
          }
        </div>
        <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin: 0;">
          Heartbeat pulses every 30s. Offline mode disables customer bookings immediately.
        </p>
      </div>

      <div class="presence-btn-group" role="radiogroup" aria-label="Availability Status">
        <button type="button" class="presence-pill-btn ${currentPresence === 'available' ? 'is-active-available' : ''}" data-presence-val="available">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Available</span>
        </button>
        <button type="button" class="presence-pill-btn ${currentPresence === 'busy' ? 'is-active-busy' : ''}" data-presence-val="busy">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>Busy</span>
        </button>
        <button type="button" class="presence-pill-btn ${currentPresence === 'offline' ? 'is-active-offline' : ''}" data-presence-val="offline">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>
          <span>Offline</span>
        </button>
      </div>
    </div>

    <!-- Profile Completion Progress Banner -->
    <div class="completion-meter-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-sm); font-weight: 600;">Profile Completion Meter</span>
        <span style="font-size: var(--font-size-sm); font-weight: 700; color: var(--accent-teal);">${completion.percentage}%</span>
      </div>
      <div class="meter-track" role="progressbar" aria-valuenow="${completion.percentage}" aria-valuemin="0" aria-valuemax="100">
        <div class="meter-fill" style="width: ${completion.percentage}%;"></div>
      </div>
      <div style="font-size: 11px; color: var(--text-subtle);">
        ${
          completion.percentage === 100
            ? "Great job! Your technician portfolio is 100% complete and fully verified."
            : `Add remaining items for higher discovery rank: ${completion.missingFields.join(", ")}.`
        }
      </div>
    </div>

    <!-- 3. Live Incoming Requests Feed (Exact Same Booking Documents) -->
    <div style="margin-bottom: var(--space-8);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
        <div>
          <h2 style="font-size: var(--font-size-lg); margin: 0;">Live Incoming Requests</h2>
          <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin: 0;">Synchronized live from the customer booking stream</p>
        </div>
        <span class="badge badge-teal">${newRequests.length} pending</span>
      </div>

      ${
        newRequests.length === 0
          ? `<div class="card" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
              No new incoming requests right now. Toggle "Available" to broadcast your location.
            </div>`
          : `<div style="display: flex; flex-direction: column; gap: var(--space-4);">
              ${newRequests.map((b) => renderIncomingRequestCard(b)).join("")}
            </div>`
      }
    </div>

    <!-- 4. Active Jobs Management with Valid Transitions -->
    <div style="margin-bottom: var(--space-8);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
        <div>
          <h2 style="font-size: var(--font-size-lg); margin: 0;">Active Jobs Progression</h2>
          <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin: 0;">Strict workflow: Accepted &rarr; On the Way &rarr; Arrived &rarr; Work in Progress &rarr; Completed</p>
        </div>
        <span class="badge badge-info">${activeJobs.length} in progress</span>
      </div>

      ${
        activeJobs.length === 0
          ? `<div class="card" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
              No active jobs in transit. Accept incoming requests above to begin.
            </div>`
          : `<div style="display: flex; flex-direction: column; gap: var(--space-4);">
              ${activeJobs.map((b) => renderActiveJobManagementCard(b)).join("")}
            </div>`
      }
    </div>

    <!-- 5. Profile Editor & Working Hours Form -->
    <div class="card" style="margin-bottom: var(--space-8);">
      <div class="card-header">
        <h2 class="card-title">Technician Profile & Indicative Rates Editor</h2>
        <span class="badge badge-default">Real-Time Sync</span>
      </div>
      <form id="worker-profile-editor-form" onsubmit="event.preventDefault(); window.blueCollarApp.handleProfileSave();">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3);">
          <div class="form-group">
            <label for="pro-edit-name" class="form-label form-label-required">Full Name</label>
            <input type="text" id="pro-edit-name" class="form-input" value="${pro.name}" required>
          </div>
          <div class="form-group">
            <label for="pro-edit-category" class="form-label form-label-required">Trade Category</label>
            <select id="pro-edit-category" class="form-select">
              <option value="electrician" ${pro.category === 'electrician' ? 'selected' : ''}>Electrician</option>
              <option value="plumber" ${pro.category === 'plumber' ? 'selected' : ''}>Plumber</option>
              <option value="carpenter" ${pro.category === 'carpenter' ? 'selected' : ''}>Carpenter</option>
              <option value="ac_technician" ${pro.category === 'ac_technician' ? 'selected' : ''}>AC Technician</option>
              <option value="appliance" ${pro.category === 'appliance' ? 'selected' : ''}>Appliance Repair</option>
              <option value="mechanic" ${pro.category === 'mechanic' ? 'selected' : ''}>Mechanic</option>
              <option value="cleaning" ${pro.category === 'cleaning' ? 'selected' : ''}>Cleaning</option>
              <option value="painter" ${pro.category === 'painter' ? 'selected' : ''}>Painter</option>
              <option value="other" ${pro.category === 'other' ? 'selected' : ''}>Handyman / Other</option>
            </select>
          </div>
          <div class="form-group">
            <label for="pro-edit-exp" class="form-label form-label-required">Years of Experience</label>
            <input type="number" id="pro-edit-exp" class="form-input" min="1" max="40" value="${pro.experienceYears || 7}" required>
          </div>
          <div class="form-group">
            <label for="pro-edit-fee" class="form-label form-label-required">Visiting Fee (₹)</label>
            <input type="number" id="pro-edit-fee" class="form-input" min="50" max="500" value="${pro.visitingFee || 99}" required>
          </div>
          <div class="form-group">
            <label for="pro-edit-hours" class="form-label">Working Hours</label>
            <input type="text" id="pro-edit-hours" class="form-input" value="8:00 AM - 9:00 PM (Mon-Sun)">
          </div>
          <div class="form-group">
            <label for="pro-edit-area" class="form-label form-label-required">Service Area / Neighborhood</label>
            <input type="text" id="pro-edit-area" class="form-input" value="${pro.areaName || 'Indiranagar, Bengaluru'}" required>
          </div>
        </div>

        <div class="form-group">
          <label for="pro-edit-skills" class="form-label form-label-required">Specialized Skills (comma-separated)</label>
          <input type="text" id="pro-edit-skills" class="form-input" value="${(pro.skills || []).join(', ')}" required>
        </div>

        <div class="form-group">
          <label for="pro-edit-bio" class="form-label form-label-required">Professional Bio</label>
          <textarea id="pro-edit-bio" class="form-textarea" required>${pro.bio || ''}</textarea>
        </div>

        <button type="submit" class="btn btn-primary" id="btn-save-pro-profile">Save & Broadcast Profile Updates</button>
      </form>
    </div>

    <!-- 6. Notifications, Reviews & Job History Section -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-6);">
      
      <!-- Notifications Feed -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom: var(--space-3); font-size: var(--font-size-base);">Live Notification Stream</h3>
        ${
          notifications.length === 0
            ? `<p style="font-size: var(--font-size-xs); color: var(--text-muted);">No new alerts. Incoming job dispatches will ping here.</p>`
            : `<div style="display: flex; flex-direction: column; gap: var(--space-2);">
                ${notifications.slice(0, 5).map((n) => `
                  <div style="padding: var(--space-2); background: var(--bg-subtle); border-radius: var(--radius-md); font-size: 12px;">
                    <strong>${n.title}</strong>
                    <div style="color: var(--text-muted);">${n.message}</div>
                    <span style="font-size: 10px; color: var(--text-subtle);">${new Date(n.createdAt).toLocaleTimeString()}</span>
                  </div>
                `).join('')}
              </div>`
        }
      </div>

      <!-- Job History (Completed & Declined) -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom: var(--space-3); font-size: var(--font-size-base);">History (${completedJobs.length + declinedJobs.length})</h3>
        ${
          completedJobs.length === 0 && declinedJobs.length === 0
            ? `<p style="font-size: var(--font-size-xs); color: var(--text-muted);">No historical records yet.</p>`
            : `<div style="display: flex; flex-direction: column; gap: var(--space-2);">
                ${[...completedJobs, ...declinedJobs].slice(0, 5).map((b) => `
                  <div style="padding: var(--space-2); border-bottom: 1px solid var(--border-subtle); font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong>${b.reference || b.id}</strong> • ${b.serviceCategory}
                      ${b.declineReason ? `<div style="font-size: 10px; color: var(--status-danger);">Reason: ${b.declineReason}</div>` : ''}
                    </div>
                    <span class="badge ${b.status === 'Completed' ? 'badge-success' : 'badge-danger'}" style="font-size: 10px;">
                      ${b.status}
                    </span>
                  </div>
                `).join('')}
              </div>`
        }
      </div>

    </div>

    <!-- Modal: Decline Job with Reason -->
    <div class="modal-backdrop" id="decline-job-modal" role="dialog" aria-modal="true" aria-labelledby="decline-modal-title" aria-hidden="true">
      <div class="modal" style="max-width: 440px;">
        <div class="modal-header">
          <h2 id="decline-modal-title" class="modal-title">Decline Service Request</h2>
          <button type="button" class="modal-close-btn" id="btn-close-decline-modal" aria-label="Close dialog">
            <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--text-muted); margin-bottom: var(--space-3);">
            Please select an optional reason for declining so the system can promptly re-route the customer to another technician:
          </p>
          <div class="form-group">
            <label for="decline-reason-select" class="form-label">Decline Reason</label>
            <select id="decline-reason-select" class="form-select">
              <option value="Distance too far / outside range">Distance too far / outside range</option>
              <option value="Already engaged in emergency job">Already engaged in emergency job</option>
              <option value="Required specialized tools unavailable">Required specialized tools unavailable</option>
              <option value="Outside normal working hours">Outside normal working hours</option>
              <option value="Other scheduling conflict">Other scheduling conflict</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" id="btn-cancel-decline">Back</button>
          <button type="button" class="btn btn-emergency" id="btn-confirm-decline">Confirm Decline</button>
        </div>
      </div>
    </div>

    <!-- Modal: Register as New Professional -->
    <div class="modal-backdrop" id="register-pro-modal" role="dialog" aria-modal="true" aria-labelledby="reg-modal-title" aria-hidden="true">
      <div class="modal" style="max-width: 540px;">
        <div class="modal-header">
          <h2 id="reg-modal-title" class="modal-title">Register as a Verified Professional</h2>
          <button type="button" class="modal-close-btn" id="btn-close-reg-modal" aria-label="Close dialog">
            <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">
            Your listing will appear in customer searches and OpenStreetMap immediately upon submission.
          </p>
          <form id="register-pro-form" onsubmit="event.preventDefault(); window.blueCollarApp.handleNewProRegister();">
            <div class="form-group">
              <label for="reg-pro-name" class="form-label form-label-required">Full Name</label>
              <input type="text" id="reg-pro-name" class="form-input" required placeholder="e.g. Anand Murthy">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div class="form-group">
                <label for="reg-pro-category" class="form-label form-label-required">Trade</label>
                <select id="reg-pro-category" class="form-select">
                  <option value="electrician">Electrician</option>
                  <option value="plumber">Plumber</option>
                  <option value="carpenter">Carpenter</option>
                  <option value="ac_technician">AC Technician</option>
                  <option value="appliance">Appliance Repair</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="painter">Painter</option>
                  <option value="other">Handyman / Other</option>
                </select>
              </div>
              <div class="form-group">
                <label for="reg-pro-fee" class="form-label form-label-required">Visiting Fee (₹)</label>
                <input type="number" id="reg-pro-fee" class="form-input" min="50" max="499" value="99" required>
              </div>
            </div>
            <div class="form-group">
              <label for="reg-pro-skills" class="form-label form-label-required">Specialized Skills (comma-separated)</label>
              <input type="text" id="reg-pro-skills" class="form-input" placeholder="e.g. MCB Tripping, Ceiling Fans, Short Circuits" required>
            </div>
            <div class="form-group">
              <label for="reg-pro-area" class="form-label form-label-required">Base Neighborhood (Bengaluru)</label>
              <input type="text" id="reg-pro-area" class="form-input" placeholder="e.g. Koramangala 4th Block" required>
            </div>
            <div class="form-group">
              <label for="reg-pro-bio" class="form-label form-label-required">Short Bio</label>
              <textarea id="reg-pro-bio" class="form-textarea" placeholder="Describe your experience and prompt turnaround times." required></textarea>
            </div>
            <button type="submit" class="btn btn-teal" style="width: 100%;">Complete Registration & Go Live</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Bind presence buttons
  container.querySelectorAll(".presence-pill-btn[data-presence-val]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-presence-val");
      setWorkerPresence(val);
    });
  });

  // Bind Accept / Decline buttons for incoming requests
  container.querySelectorAll(".btn-accept-job").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bId = btn.getAttribute("data-booking-id");
      await dataService.updateBooking(bId, { status: "Accepted" });
      showToast("Job accepted! Now ready to head out.", "success");
      renderWorkerDashboard();
    });
  });

  let pendingDeclineBookingId = null;
  container.querySelectorAll(".btn-decline-job").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingDeclineBookingId = btn.getAttribute("data-booking-id");
      openModal("decline-job-modal");
    });
  });

  document.getElementById("btn-confirm-decline")?.addEventListener("click", async () => {
    if (pendingDeclineBookingId) {
      const reason = document.getElementById("decline-reason-select")?.value || "Scheduling conflict";
      await dataService.updateBooking(pendingDeclineBookingId, {
        status: "Declined",
        declineReason: reason
      });
      closeModal("decline-job-modal");
      showToast(`Job declined: ${reason}`, "info");
      renderWorkerDashboard();
    }
  });

  document.getElementById("btn-close-decline-modal")?.addEventListener("click", () => closeModal("decline-job-modal"));
  document.getElementById("btn-cancel-decline")?.addEventListener("click", () => closeModal("decline-job-modal"));

  // Bind active job lifecycle progression buttons
  container.querySelectorAll(".btn-advance-job").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bId = btn.getAttribute("data-booking-id");
      const nextStatus = btn.getAttribute("data-next-status");
      await dataService.updateBooking(bId, { status: nextStatus });

      if (nextStatus === "Arrived" || nextStatus === "Completed") {
        stopLiveLocationSharing();
      }

      showToast(`Job status updated: ${nextStatus}`, "success");
      renderWorkerDashboard();
    });
  });

  // Bind Live GPS Sharing button
  container.querySelectorAll(".btn-toggle-gps-sharing").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.getAttribute("data-booking-id");
      if (activeTrackingBookingId === bId) {
        stopLiveLocationSharing();
        showToast("Live GPS sharing stopped.", "info");
      } else {
        startLiveLocationSharing(bId);
      }
    });
  });

  // Modal triggers
  document.getElementById("btn-open-register-pro-modal")?.addEventListener("click", () => openModal("register-pro-modal"));
  document.getElementById("btn-close-reg-modal")?.addEventListener("click", () => closeModal("register-pro-modal"));

  // Start presence heartbeat if not started
  startPresenceHeartbeat();
}

function renderIncomingRequestCard(b) {
  const isEmergency = b.timingType === "immediate";

  return `
    <article class="card" style="border-left: 4px solid var(--accent-teal);" data-booking-id="${b.id}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2);">
        <div>
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: var(--primary);">${b.reference || b.id}</span>
            <span class="badge badge-teal">New Incoming Request</span>
            ${
              isEmergency
                ? `<span class="badge badge-danger">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>
                    <span>Emergency SOS</span>
                  </span>`
                : ""
            }
          </div>
          <h3 style="font-size: var(--font-size-base); text-transform: capitalize; margin: 2px 0 0;">${b.serviceCategory}</h3>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 15px; font-weight: 700; color: var(--primary);">₹${b.estimatedPrice?.total || 299}</span>
          <div style="font-size: 11px; color: var(--text-subtle);">Estimated total</div>
        </div>
      </div>

      <div style="background: var(--bg-subtle); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: 13px; margin-bottom: var(--space-3);">
        <strong>Problem:</strong> ${b.problemDescription || "Routine inspection"}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); font-size: 12px; color: var(--text-muted); margin-bottom: var(--space-3);">
        <span>👤 <strong>Customer:</strong> ${b.customerName || "Resident"} (${b.customerPhone || "+91 98765 •••••"})</span>
        <span>📍 <strong>Address:</strong> ${b.address?.flat || ""}, ${b.address?.locality || ""}</span>
        <span>⏱️ <strong>When:</strong> ${isEmergency ? "Immediate Dispatch (~20m)" : b.scheduledDate + " at " + b.scheduledTime}</span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border-subtle);">
        <button type="button" class="btn btn-outline btn-sm btn-decline-job" data-booking-id="${b.id}" style="color: var(--status-danger);">
          <span>Decline</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm btn-accept-job" data-booking-id="${b.id}">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Accept Job</span>
        </button>
      </div>
    </article>
  `;
}

function renderActiveJobManagementCard(b) {
  const steps = ["Accepted", "On the Way", "Arrived", "Work in Progress", "Completed"];
  const currentStepIdx = steps.indexOf(b.status);
  const nextStatus = steps[currentStepIdx + 1];
  const isSharingGps = activeTrackingBookingId === b.id;

  return `
    <article class="card" style="border-left: 4px solid #0284C7;" data-booking-id="${b.id}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2);">
        <div>
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700;">${b.reference || b.id}</span>
            <span class="badge badge-info">Active Job</span>
            ${
              isSharingGps
                ? `<span class="gps-pulse-badge"><span class="gps-dot"></span><span>Live GPS Broadcasting</span></span>`
                : ""
            }
          </div>
          <h3 style="font-size: var(--font-size-base); text-transform: capitalize; margin: 2px 0 0;">${b.serviceCategory}</h3>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 15px; font-weight: 700; color: var(--primary);">₹${b.estimatedPrice?.total || 299}</span>
          <div style="font-size: 11px; color: var(--text-subtle);">On completion</div>
        </div>
      </div>

      <!-- 5-Step Job Progression Stepper -->
      <div class="job-stepper" role="progressbar" aria-label="Job Progress Lifecycle">
        ${steps.map((st, idx) => {
          let nodeClass = "";
          if (idx < currentStepIdx) nodeClass = "is-done";
          else if (idx === currentStepIdx) nodeClass = "is-active";

          return `
            <div class="job-step-node ${nodeClass}">
              <div class="job-step-circle">${idx < currentStepIdx ? "✓" : idx + 1}</div>
              <span class="job-step-name">${st}</span>
            </div>
          `;
        }).join("")}
      </div>

      <div style="background: var(--bg-subtle); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: 12px; margin-bottom: var(--space-3);">
        <div><strong>Customer:</strong> ${b.customerName || "Resident"} • ${b.customerPhone || "+91 98765 •••••"}</div>
        <div><strong>Location:</strong> ${b.address?.flat || ""}, ${b.address?.locality || ""}</div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border-subtle); flex-wrap: wrap;">
        <div>
          ${
            b.status === "On the Way"
              ? `<button type="button" class="btn btn-outline btn-sm btn-toggle-gps-sharing" data-booking-id="${b.id}">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  <span>${isSharingGps ? "Stop Sharing GPS" : "Share My Live Location"}</span>
                </button>`
              : ""
          }
        </div>

        <div style="display: flex; gap: var(--space-2);">
          ${
            nextStatus
              ? `<button type="button" class="btn btn-primary btn-sm btn-advance-job" data-booking-id="${b.id}" data-next-status="${nextStatus}">
                  <span>Advance to: ${nextStatus} &rarr;</span>
                </button>`
              : `<span class="badge badge-success">Job Fully Completed!</span>`
          }
        </div>
      </div>
    </article>
  `;
}
