/**
 * Blue Collar — Professional Profile & Complete Booking Flow
 * 8-Step Wizard, Real-Clock Validation, Price Estimator, Duplicate Prevention,
 * and Live Sync through DataService Layer.
 */

import { store, dataService } from './state.js';
import { ICONS, showToast, openModal, closeModal } from './ui.js';
import { calculateHaversineDistanceKm, calculateEstimatedEta } from './map.js';

// ============================================================================
// 1. Preset Problem Catalogs & Standard Estimates
// ============================================================================

export const PRESET_PROBLEMS = {
  electrician: [
    "Short circuit / MCB tripping frequently",
    "Ceiling fan not working / speed regulator issue",
    "Burnt switchboard / loose sparking socket",
    "Complete flat earthing & rewiring check",
    "Inverter & battery maintenance",
    "Other electrical problem"
  ],
  plumber: [
    "High-pressure pipe burst or leakage",
    "Dripping tap / broken spindle valve",
    "Severely blocked kitchen drain or bathroom sink",
    "Water heater (geyser) inlet/outlet connection",
    "Flush tank leak / toilet cistern overflow",
    "Other plumbing problem"
  ],
  carpenter: [
    "Main door lock jammed / key broken",
    "Loose modular wardrobe hinges & alignment",
    "Bed frame / study table assembly or repair",
    "Window latch / wooden mesh alignment",
    "Curtain rod & shelf drilling",
    "Other carpentry problem"
  ],
  ac_technician: [
    "AC blowing warm air / no cooling",
    "Water dripping from indoor split AC unit",
    "Gas pressure check & leak refill",
    "Loud vibrating compressor noise",
    "Seasonal deep jet pump filter & coil cleaning",
    "Other AC problem"
  ],
  appliance: [
    "Washing machine not spinning or draining",
    "Refrigerator cooling failure / frost buildup",
    "Microwave oven not heating food",
    "Water purifier (RO) filter chocked / pump leak",
    "Geyser thermostat trip / cold water",
    "Other appliance issue"
  ],
  mechanic: [
    "Two-wheeler flat tyre / tubeless puncture",
    "Dead battery / electric start failure",
    "Brake pads worn / loose brake cable",
    "Engine oil change & roadside tuneup",
    "Chain slack & sprocket alignment",
    "Other mechanical issue"
  ],
  cleaning: [
    "Complete move-in flat deep sanitization",
    "Bathroom tile descaling & grout cleaning",
    "Kitchen grease removal & chimney degrease",
    "Fabric sofa & mattress shampooing",
    "Balcony & floor high-pressure scrub",
    "Other cleaning service"
  ],
  painter: [
    "Rental handover patch-up & whitewash",
    "Water seepage damp wall scraping & primer",
    "Single room accent wall fresh coat",
    "Full interior repainting",
    "Exterior weather coat application",
    "Other painting job"
  ],
  other: [
    "TV wall mount bracket fixing",
    "Drilling wall holes & mirror hanging",
    "Curtain brackets / blinds installation",
    "Heavy furniture relocation assistance",
    "Door draft stopper & pest sealant",
    "Other general handyman task"
  ]
};

export const PRICING_ESTIMATES = {
  electrician: { visitingFee: 99, labour: 249, material: 100 },
  plumber: { visitingFee: 99, labour: 299, material: 120 },
  carpenter: { visitingFee: 149, labour: 349, material: 150 },
  ac_technician: { visitingFee: 199, labour: 449, material: 200 },
  appliance: { visitingFee: 149, labour: 349, material: 150 },
  mechanic: { visitingFee: 99, labour: 249, material: 80 },
  cleaning: { visitingFee: 199, labour: 499, material: 100 },
  painter: { visitingFee: 149, labour: 399, material: 250 },
  other: { visitingFee: 99, labour: 199, material: 50 }
};

export const SAMPLE_REVIEWS = [
  {
    name: "Pooja Hegde (Student, Koramangala)",
    rating: 5,
    date: "3 days ago",
    comment: "Prompt response! Fixed our PG room switchboard sparking within 20 mins. Very polite and fair visiting charges."
  },
  {
    name: "Arun K. (Indiranagar)",
    rating: 4.8,
    date: "1 week ago",
    comment: "Arrived with proper diagnostic tools for our leaking bathroom pipe. Clear estimate upfront with zero hidden charges."
  },
  {
    name: "Siddharth Rao (HSR Layout)",
    rating: 5,
    date: "2 weeks ago",
    comment: "Great experience for late evening electrical troubleshooting. Exactly what newcomers to the city need."
  }
];

// ============================================================================
// 2. Reference Code Generator
// ============================================================================

export function generateBookingReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BC-${year}${month}${day}-${randomSuffix}`;
}

// ============================================================================
// 3. Booking Wizard State & Controller
// ============================================================================

class BookingWizardController {
  constructor() {
    this.modalId = "booking-wizard-modal";
    this.currentStep = 1;
    this.isSubmitting = false;

    this.bookingState = {
      service: "electrician",
      problemPreset: "",
      problemCustom: "",
      address: {
        flat: "",
        locality: "",
        landmark: "",
        lat: 12.9716,
        lng: 77.5946
      },
      timingType: "immediate", // "immediate" | "scheduled"
      scheduledDate: "",
      scheduledTime: "",
      professionalId: null,
      professional: null,
      price: {
        visitingFee: 99,
        labour: 249,
        material: 100,
        total: 448
      },
      includeMaterial: true,
      reference: "",
      createdAt: ""
    };
  }

  open(preselectedCategory = null, preselectedProId = null) {
    this.currentStep = 1;
    this.isSubmitting = false;

    // Load active user location as default address
    try {
      const savedLoc = localStorage.getItem("bluecollar_user_location");
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        this.bookingState.address.locality = parsed.address || "Indiranagar, Bengaluru";
        this.bookingState.address.lat = parsed.lat || 12.9716;
        this.bookingState.address.lng = parsed.lng || 77.5946;
      }
    } catch {}

    if (preselectedCategory) {
      this.bookingState.service = preselectedCategory;
    }

    if (preselectedProId) {
      this.bookingState.professionalId = preselectedProId;
      const pros = store.getState().professionals || [];
      const pro = pros.find((p) => p.id === preselectedProId);
      if (pro) {
        this.bookingState.professional = pro;
        this.bookingState.service = pro.category;
      }
    }

    this.updatePriceCalculations();
    this.renderWizardModal();
    this.goToStep(preselectedProId ? 2 : 1);
    openModal(this.modalId);
  }

  updatePriceCalculations() {
    const base = PRICING_ESTIMATES[this.bookingState.service] || PRICING_ESTIMATES.other;
    const visitingFee = this.bookingState.professional ? this.bookingState.professional.visitingFee : base.visitingFee;
    const labour = this.bookingState.professional ? this.bookingState.professional.baseRatePerHour : base.labour;
    const material = this.bookingState.includeMaterial ? base.material : 0;
    const total = visitingFee + labour + material;

    this.bookingState.price = { visitingFee, labour, material, total };
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 8) return;
    this.currentStep = stepNumber;

    // Update Progress Bar
    document.querySelectorAll(".wizard-step-node").forEach((node) => {
      const nodeStep = parseInt(node.getAttribute("data-step"), 10);
      node.classList.remove("is-active", "is-completed");
      if (nodeStep === this.currentStep) {
        node.classList.add("is-active");
      } else if (nodeStep < this.currentStep) {
        node.classList.add("is-completed");
      }
    });

    // Update Step View Panels
    document.querySelectorAll(".wizard-content-step").forEach((panel) => {
      const pStep = parseInt(panel.getAttribute("data-step-content"), 10);
      if (pStep === this.currentStep) {
        panel.classList.add("is-active");
      } else {
        panel.classList.remove("is-active");
      }
    });

    // Clear step errors
    this.clearError();

    // Dynamically render specific steps
    if (this.currentStep === 2) this.renderStep2Problems();
    if (this.currentStep === 4) this.initStep4DateTimeDefaults();
    if (this.currentStep === 5) this.renderStep5Professionals();
    if (this.currentStep === 6) this.renderStep6Price();
    if (this.currentStep === 7) this.renderStep7Summary();
  }

  showError(message) {
    const errorEl = document.getElementById("wizard-step-error");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "flex";
      errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  clearError() {
    const errorEl = document.getElementById("wizard-step-error");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }
  }

  // Step Validation Logic
  validateCurrentStep() {
    this.clearError();

    // Step 1: Service
    if (this.currentStep === 1) {
      if (!this.bookingState.service) {
        this.showError("Please select a service category to proceed.");
        return false;
      }
      return true;
    }

    // Step 2: Problem
    if (this.currentStep === 2) {
      const customVal = document.getElementById("wizard-problem-custom")?.value.trim() || "";
      this.bookingState.problemCustom = customVal;

      if (!this.bookingState.problemPreset && customVal.length < 5) {
        this.showError("Please select a common problem or describe your issue in at least 5 characters.");
        return false;
      }
      return true;
    }

    // Step 3: Location
    if (this.currentStep === 3) {
      const flat = document.getElementById("wizard-address-flat")?.value.trim() || "";
      const locality = document.getElementById("wizard-address-locality")?.value.trim() || "";
      const landmark = document.getElementById("wizard-address-landmark")?.value.trim() || "";

      if (!flat) {
        this.showError("Please enter your House/Flat/Room number.");
        return false;
      }
      if (!locality) {
        this.showError("Please enter your Street or Locality.");
        return false;
      }

      this.bookingState.address.flat = flat;
      this.bookingState.address.locality = locality;
      this.bookingState.address.landmark = landmark;
      return true;
    }

    // Step 4: Now or Schedule
    if (this.currentStep === 4) {
      const timingType = document.querySelector('input[name="wizard-timing"]:checked')?.value || "immediate";
      this.bookingState.timingType = timingType;

      if (timingType === "scheduled") {
        const dateVal = document.getElementById("wizard-schedule-date")?.value;
        const timeVal = document.getElementById("wizard-schedule-time")?.value;

        if (!dateVal || !timeVal) {
          this.showError("Please select both a valid date and time slot for your appointment.");
          return false;
        }

        // Validate strictly against the real current time!
        const selectedDateTime = new Date(`${dateVal}T${timeVal}`);
        const now = new Date();

        if (isNaN(selectedDateTime.getTime())) {
          this.showError("Invalid date/time provided.");
          return false;
        }

        // Must be in the future (at least 20 mins from now)
        if (selectedDateTime.getTime() < now.getTime() + 20 * 60 * 1000) {
          this.showError("The selected time is in the past or too soon. Please select a slot at least 30 minutes in the future.");
          return false;
        }

        this.bookingState.scheduledDate = dateVal;
        this.bookingState.scheduledTime = timeVal;
      }
      return true;
    }

    // Step 5: Choose Professional (CRITICAL GUARDRAIL)
    if (this.currentStep === 5) {
      if (!this.bookingState.professionalId || !this.bookingState.professional) {
        this.showError("Please select a verified professional to perform the work.");
        return false;
      }

      // Check live availability guardrail
      if (this.bookingState.professional.isAvailable === false) {
        this.showError("The selected professional is currently Offline or on break. Please choose an Available professional.");
        return false;
      }
      return true;
    }

    // Step 6: Price Estimate
    if (this.currentStep === 6) {
      const ack = document.getElementById("wizard-price-ack");
      if (ack && !ack.checked) {
        this.showError("Please acknowledge the price estimate disclaimer before proceeding.");
        return false;
      }
      return true;
    }

    // Step 7: Summary
    if (this.currentStep === 7) {
      return true;
    }

    return true;
  }

  next() {
    if (this.validateCurrentStep()) {
      if (this.currentStep === 7) {
        this.confirmBooking();
      } else {
        this.goToStep(this.currentStep + 1);
      }
    }
  }

  prev() {
    this.goToStep(this.currentStep - 1);
  }

  // Step 2: Render Preset Problems
  renderStep2Problems() {
    const listWrap = document.getElementById("wizard-preset-problems-list");
    if (!listWrap) return;

    const presets = PRESET_PROBLEMS[this.bookingState.service] || PRESET_PROBLEMS.other;
    listWrap.innerHTML = presets
      .map(
        (p) => `
        <button type="button" class="wizard-preset-btn ${this.bookingState.problemPreset === p ? 'is-active' : ''}" data-preset="${p}">
          ${p}
        </button>
      `
      )
      .join("");

    listWrap.querySelectorAll(".wizard-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        listWrap.querySelectorAll(".wizard-preset-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        this.bookingState.problemPreset = btn.getAttribute("data-preset");
        this.clearError();
      });
    });

    const customInput = document.getElementById("wizard-problem-custom");
    if (customInput && this.bookingState.problemCustom) {
      customInput.value = this.bookingState.problemCustom;
    }
  }

  // Step 4: Real Clock DateTime Defaults
  initStep4DateTimeDefaults() {
    const dateInput = document.getElementById("wizard-schedule-date");
    const timeInput = document.getElementById("wizard-schedule-time");
    if (!dateInput || !timeInput) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    dateInput.min = todayStr;

    if (!dateInput.value) {
      dateInput.value = todayStr;
    }

    // Default time slot to current time + 1 hour
    const futureHours = (now.getHours() + 1) % 24;
    const timeStr = `${String(futureHours).padStart(2, "0")}:00`;
    if (!timeInput.value) {
      timeInput.value = timeStr;
    }
  }

  // Step 5: Render Available Professionals matching Category
  renderStep5Professionals() {
    const container = document.getElementById("wizard-pros-list");
    if (!container) return;

    const allPros = store.getState().professionals || [];
    const matching = allPros.filter((p) => p.category === this.bookingState.service);

    if (matching.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p>No professionals found specifically for ${this.bookingState.service}. You can choose another category.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = matching
      .map((pro) => {
        const isOnline = pro.isAvailable !== false;
        const isSelected = pro.id === this.bookingState.professionalId;
        const dist = calculateHaversineDistanceKm(
          this.bookingState.address.lat,
          this.bookingState.address.lng,
          pro.coordinates.lat,
          pro.coordinates.lng
        );
        const eta = calculateEstimatedEta(dist);

        return `
          <div class="wizard-select-card ${isSelected ? 'is-selected' : ''} ${!isOnline ? 'is-disabled' : ''}" data-wizard-pro-id="${pro.id}">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-start;">
              <div>
                <strong style="color: var(--text-main); font-size: 14px;">${pro.name}</strong>
                <div style="font-size: 11px; color: var(--text-subtle);">${pro.label || "Demo professional"} • ★ ${pro.rating}</div>
              </div>
              <div>
                ${
                  isOnline
                    ? `<span class="badge badge-success" style="font-size: 10px;">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Available</span>
                      </span>`
                    : `<span class="badge badge-warning" style="font-size: 10px;">
                        <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>
                        <span>Offline (Unavailable)</span>
                      </span>`
                }
              </div>
            </div>

            <div style="display: flex; gap: var(--space-3); margin-top: 6px; font-size: 11px; color: var(--text-muted);">
              <span>📍 ${dist} km</span>
              <span>⏱️ ${eta}</span>
              <span>🏷️ ₹${pro.visitingFee} visit fee</span>
            </div>

            ${
              !isOnline
                ? `<div style="font-size: 11px; color: var(--status-danger); margin-top: 4px; font-weight: 500;">
                    Cannot book while technician is offline
                  </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".wizard-select-card").forEach((card) => {
      card.addEventListener("click", () => {
        const pId = card.getAttribute("data-wizard-pro-id");
        const pro = matching.find((p) => p.id === pId);

        // Guardrail: cannot book offline worker
        if (pro && pro.isAvailable === false) {
          this.showError("This technician is currently offline and taking a rest break. Please choose an active technician.");
          return;
        }

        container.querySelectorAll(".wizard-select-card").forEach((c) => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
        this.bookingState.professionalId = pId;
        this.bookingState.professional = pro;
        this.updatePriceCalculations();
        this.clearError();
      });
    });
  }

  // Step 6: Render Itemized Price Breakdown
  renderStep6Price() {
    this.updatePriceCalculations();
    const tableWrap = document.getElementById("wizard-price-breakdown-container");
    if (!tableWrap) return;

    const { visitingFee, labour, material, total } = this.bookingState.price;

    tableWrap.innerHTML = `
      <div class="price-breakdown-card">
        <div class="price-row">
          <span>Standard Visiting / Diagnosis Fee</span>
          <span>₹${visitingFee}</span>
        </div>
        <div class="price-row">
          <span>Estimated Labour & Repair (Base Rate)</span>
          <span>₹${labour}</span>
        </div>
        <div class="price-row">
          <span>Estimated Material / Consumables Allowance</span>
          <span>₹${material}</span>
        </div>
        <div class="price-row">
          <span>Total Estimated Booking Amount</span>
          <span style="color: var(--accent-teal);">₹${total}</span>
        </div>
      </div>

      <div class="price-disclaimer-alert" role="alert">
        <svg class="icon icon-sm" viewBox="0 0 24 24" style="flex-shrink: 0; color: #B45309;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <div>
          <strong>Transparent Pricing Guarantee:</strong> The final price is an estimate and may vary after hands-on physical inspection. Any extra parts or expanded labour <strong>strictly requires your explicit verbal/written agreement</strong> before proceeding. No advance payment required; settlement happens on-site.
        </div>
      </div>
    `;
  }

  // Step 7: Render Summary
  renderStep7Summary() {
    const summaryWrap = document.getElementById("wizard-summary-container");
    if (!summaryWrap) return;

    const b = this.bookingState;
    const problemText = b.problemPreset || b.problemCustom || "General repair request";
    const timingDisplay =
      b.timingType === "immediate"
        ? "🚨 Immediate / Emergency Dispatch (~20–30 mins)"
        : `📅 Scheduled: ${b.scheduledDate} at ${b.scheduledTime}`;

    summaryWrap.innerHTML = `
      <div class="booking-summary-box">
        <div class="summary-item">
          <span class="summary-label">Service Trade</span>
          <span class="summary-value" style="text-transform: capitalize; color: var(--accent-teal); font-weight: 700;">${b.service}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Reported Problem</span>
          <span class="summary-value">${problemText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Service Location</span>
          <span class="summary-value">${b.address.flat}, ${b.address.locality} ${b.address.landmark ? '(Near ' + b.address.landmark + ')' : ''}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Timing / Schedule</span>
          <span class="summary-value">${timingDisplay}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Assigned Technician</span>
          <span class="summary-value">${b.professional?.name || "Next Available"} (Demo Verified)</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Estimated Fee</span>
          <span class="summary-value" style="font-size: 16px; font-weight: 700; color: var(--primary);">₹${b.price.total} (Pay on completion)</span>
        </div>
      </div>
    `;
  }

  // Step 8: Confirm Booking with Double-Click Prevention & Live Sync
  async confirmBooking() {
    if (this.isSubmitting) return; // Prevent duplicate clicks!
    this.isSubmitting = true;

    const confirmBtn = document.getElementById("wizard-btn-next");
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span>Processing Booking...</span>`;
    }

    try {
      const refCode = generateBookingReference();
      const newBooking = {
        id: "bk_" + Date.now(),
        reference: refCode,
        customerId: store.getState().currentUser?.id || "cust_demo_1",
        customerName: store.getState().currentUser?.name || "Ramya (Resident Demo)",
        customerPhone: store.getState().currentUser?.phone || "+91 98765 43210",
        serviceCategory: this.bookingState.service,
        problemDescription: this.bookingState.problemPreset || this.bookingState.problemCustom,
        address: this.bookingState.address,
        timingType: this.bookingState.timingType,
        scheduledDate: this.bookingState.scheduledDate,
        scheduledTime: this.bookingState.scheduledTime,
        professionalId: this.bookingState.professionalId,
        professionalName: this.bookingState.professional?.name || "Demo Professional",
        estimatedPrice: this.bookingState.price,
        status: "Booking Confirmed",
        createdAt: new Date().toISOString()
      };

      // Save through the unified dataService layer so it syncs live across tabs & Firestore!
      await dataService.saveBooking(newBooking);
      await dataService.addNotification({
        recipientId: this.bookingState.professionalId,
        title: "New Job Confirmed!",
        message: `Booking #${refCode} has been confirmed for ${this.bookingState.service}.`,
        bookingId: newBooking.id
      });

      this.bookingState.reference = refCode;
      this.bookingState.createdAt = newBooking.createdAt;

      // Render Step 8 Success Receipt
      this.renderStep8Success(newBooking);
      this.goToStep(8);
      showToast(`Booking ${refCode} confirmed successfully!`, "success", 4000);
    } catch (err) {
      console.error("Booking error:", err);
      this.showError("Failed to save booking. Please try again.");
    } finally {
      this.isSubmitting = false;
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }
    }
  }

  renderStep8Success(booking) {
    const successWrap = document.getElementById("wizard-success-container");
    if (!successWrap) return;

    successWrap.innerHTML = `
      <div class="booking-success-card">
        <div class="booking-success-icon" aria-hidden="true">
          <svg class="icon icon-lg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2 style="font-size: var(--font-size-2xl); color: var(--text-main); margin-bottom: 4px;">Booking Confirmed!</h2>
        <p style="font-size: var(--font-size-sm); color: var(--text-muted); max-width: 440px; margin: 0 auto;">
          Your request has been broadcast and assigned to <strong>${booking.professionalName}</strong>. Live synchronization is active.
        </p>

        <div>
          <span class="reference-pill">${booking.reference}</span>
        </div>

        <div style="display: inline-flex; align-items: center; gap: 6px; margin-bottom: var(--space-4);">
          <span class="badge badge-success">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Status: Booking Confirmed</span>
          </span>
          <span class="badge badge-teal">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Live Synced</span>
          </span>
        </div>

        <div style="display: flex; justify-content: center; gap: var(--space-3); margin-top: var(--space-4); flex-wrap: wrap;">
          <button type="button" class="btn btn-teal" id="wizard-btn-track-live">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Track Live Status</span>
          </button>
          <button type="button" class="btn btn-primary" id="wizard-btn-view-bookings">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>View in My Bookings</span>
          </button>
          <button type="button" class="btn btn-outline" id="wizard-btn-close-success">
            <span>Done</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById("wizard-btn-track-live")?.addEventListener("click", () => {
      closeModal(this.modalId);
      openBookingStatusTracking(booking.id);
    });

    document.getElementById("wizard-btn-view-bookings")?.addEventListener("click", () => {
      closeModal(this.modalId);
      window.location.hash = "#bookings";
    });

    document.getElementById("wizard-btn-close-success")?.addEventListener("click", () => {
      closeModal(this.modalId);
    });
  }

  // Wizard Modal Shell HTML
  renderWizardModal() {
    let modal = document.getElementById(this.modalId);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = this.modalId;
      modal.className = "modal-backdrop";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "wizard-modal-title");
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal wizard-modal">
        <!-- Wizard Header -->
        <div class="modal-header">
          <div>
            <h2 id="wizard-modal-title" class="modal-title">Book a Local Professional</h2>
            <p style="font-size: 11px; color: var(--text-subtle); margin: 0;">Step-by-step verified scheduling</p>
          </div>
          <button type="button" class="modal-close-btn" id="wizard-close-x" aria-label="Close booking wizard">
            <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Progress Bar (8 Steps) -->
        <div style="padding: var(--space-4) var(--space-5) 0;">
          <div class="wizard-progress-bar" role="progressbar" aria-label="Booking Progress">
            <div class="wizard-step-node" data-step="1"><div class="wizard-step-bubble">1</div><span class="wizard-step-label">Trade</span></div>
            <div class="wizard-step-node" data-step="2"><div class="wizard-step-bubble">2</div><span class="wizard-step-label">Problem</span></div>
            <div class="wizard-step-node" data-step="3"><div class="wizard-step-bubble">3</div><span class="wizard-step-label">Location</span></div>
            <div class="wizard-step-node" data-step="4"><div class="wizard-step-bubble">4</div><span class="wizard-step-label">Time</span></div>
            <div class="wizard-step-node" data-step="5"><div class="wizard-step-bubble">5</div><span class="wizard-step-label">Technician</span></div>
            <div class="wizard-step-node" data-step="6"><div class="wizard-step-bubble">6</div><span class="wizard-step-label">Price</span></div>
            <div class="wizard-step-node" data-step="7"><div class="wizard-step-bubble">7</div><span class="wizard-step-label">Summary</span></div>
            <div class="wizard-step-node" data-step="8"><div class="wizard-step-bubble">8</div><span class="wizard-step-label">Receipt</span></div>
          </div>

          <!-- Accessible Step Error Notification -->
          <div class="form-error" id="wizard-step-error" style="display: none; padding: var(--space-2) var(--space-3); background-color: var(--status-danger-bg); border-radius: var(--radius-md); margin-bottom: var(--space-3);" role="alert"></div>
        </div>

        <!-- Wizard Step Body Contents -->
        <div class="modal-body" style="padding-top: var(--space-2);">
          
          <!-- STEP 1: SERVICE -->
          <div class="wizard-content-step" data-step-content="1">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">1. Select Service Category</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Choose the trade that best aligns with your repair or maintenance need.</p>
            <div class="wizard-options-grid" id="wizard-service-grid">
              ${[
                ["electrician", "Electrician", "Short circuits, wiring"],
                ["plumber", "Plumber", "Leaks, pipes, geysers"],
                ["carpenter", "Carpenter", "Locks, doors, wood"],
                ["ac_technician", "AC Technician", "Servicing, cooling, gas"],
                ["appliance", "Appliance Repair", "Fridges, washers, RO"],
                ["mechanic", "Mechanic", "Punctures, jumpstarts"],
                ["cleaning", "Cleaning", "Deep home, sanitization"],
                ["painter", "Painter", "Touch-ups, waterproofing"],
                ["other", "Handyman / Other", "Mounting, curtain rods"]
              ]
                .map(
                  ([val, label, sub]) => `
                <div class="wizard-select-card ${this.bookingState.service === val ? 'is-selected' : ''}" data-service-val="${val}">
                  <strong style="font-size: 13px;">${label}</strong>
                  <span style="font-size: 11px; color: var(--text-subtle);">${sub}</span>
                </div>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- STEP 2: PROBLEM -->
          <div class="wizard-content-step" data-step-content="2">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">2. What Problem Are You Experiencing?</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Pick a common preset or describe your specific issue.</p>
            <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4);" id="wizard-preset-problems-list">
              <!-- Rendered via renderStep2Problems -->
            </div>
            <div class="form-group">
              <label for="wizard-problem-custom" class="form-label">Additional Details / Custom Description</label>
              <textarea id="wizard-problem-custom" class="form-textarea" placeholder="e.g. Master bedroom geyser switch is sparking when turned on. Please bring spare 16A MCB."></textarea>
            </div>
          </div>

          <!-- STEP 3: LOCATION -->
          <div class="wizard-content-step" data-step-content="3">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">3. Service Address & Doorstep Details</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Ensure your house/flat number is specified so the technician can locate you promptly.</p>
            <div class="form-group">
              <label for="wizard-address-flat" class="form-label form-label-required">Flat / House / Room Number</label>
              <input type="text" id="wizard-address-flat" class="form-input" placeholder="e.g. Flat 302, Green Residency" required>
            </div>
            <div class="form-group">
              <label for="wizard-address-locality" class="form-label form-label-required">Street / Locality / Society</label>
              <input type="text" id="wizard-address-locality" class="form-input" value="${this.bookingState.address.locality}" required>
            </div>
            <div class="form-group">
              <label for="wizard-address-landmark" class="form-label">Nearby Landmark (Optional)</label>
              <input type="text" id="wizard-address-landmark" class="form-input" placeholder="e.g. Opposite Metro Pillar 128">
            </div>
          </div>

          <!-- STEP 4: NOW OR SCHEDULE -->
          <div class="wizard-content-step" data-step-content="4">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">4. When Do You Need The Technician?</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Choose immediate emergency dispatch or schedule an appointment slot.</p>
            <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4);">
              <label class="wizard-select-card" style="width: 100%; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <input type="radio" name="wizard-timing" value="immediate" checked style="width: 18px; height: 18px; accent-color: var(--accent-teal);">
                  <div>
                    <strong>🚨 Immediate Dispatch (Fastest ETA ~20–30 mins)</strong>
                    <div style="font-size: 11px; color: var(--text-subtle);">Broadcast to nearest active professionals immediately</div>
                  </div>
                </div>
              </label>

              <label class="wizard-select-card" style="width: 100%; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <input type="radio" name="wizard-timing" value="scheduled" style="width: 18px; height: 18px; accent-color: var(--accent-teal);">
                  <div>
                    <strong>📅 Schedule for Later</strong>
                    <div style="font-size: 11px; color: var(--text-subtle);">Pick a convenient upcoming day and time</div>
                  </div>
                </div>
              </label>
            </div>

            <!-- Schedule Date/Time Inputs (Shown only if scheduled is picked) -->
            <div id="wizard-schedule-fields" style="display: none; background: var(--bg-subtle); padding: var(--space-3); border-radius: var(--radius-md);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="wizard-schedule-date" class="form-label form-label-required">Appointment Date</label>
                  <input type="date" id="wizard-schedule-date" class="form-input">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="wizard-schedule-time" class="form-label form-label-required">Preferred Time</label>
                  <input type="time" id="wizard-schedule-time" class="form-input">
                </div>
              </div>
              <span class="form-help" style="margin-top: 4px; display: block;">Slots are validated against the real clock (no past times permitted).</span>
            </div>
          </div>

          <!-- STEP 5: CHOOSE PROFESSIONAL -->
          <div class="wizard-content-step" data-step-content="5">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">5. Choose Local Professional</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Select an active technician. Offline professionals cannot be booked.</p>
            <div style="display: flex; flex-direction: column; gap: var(--space-3);" id="wizard-pros-list">
              <!-- Rendered via renderStep5Professionals -->
            </div>
          </div>

          <!-- STEP 6: PRICE ESTIMATE & DISCLAIMER -->
          <div class="wizard-content-step" data-step-content="6">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">6. Transparent Price Breakdown</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Review upfront cost estimates with full transparency.</p>
            <div id="wizard-price-breakdown-container">
              <!-- Rendered via renderStep6Price -->
            </div>
            <div style="margin-top: var(--space-3);">
              <label style="display: flex; align-items: flex-start; gap: var(--space-2); cursor: pointer; font-size: var(--font-size-xs);">
                <input type="checkbox" id="wizard-price-ack" checked style="width: 18px; height: 18px; accent-color: var(--accent-teal); margin-top: 2px;">
                <span>I understand that this is an estimated rate and the technician will inspect on-site and confirm any extra scope before starting.</span>
              </label>
            </div>
          </div>

          <!-- STEP 7: SUMMARY -->
          <div class="wizard-content-step" data-step-content="7">
            <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-2);">7. Review & Confirm Booking</h3>
            <p style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-3);">Please verify your service details before final dispatch.</p>
            <div id="wizard-summary-container">
              <!-- Rendered via renderStep7Summary -->
            </div>
          </div>

          <!-- STEP 8: RECEIPT (SUCCESS) -->
          <div class="wizard-content-step" data-step-content="8">
            <div id="wizard-success-container">
              <!-- Rendered via renderStep8Success -->
            </div>
          </div>

        </div>

        <!-- Wizard Navigation Footer -->
        <div class="modal-footer" id="wizard-footer-nav">
          <button type="button" class="btn btn-outline" id="wizard-btn-prev" style="display: none;">Back</button>
          <button type="button" class="btn btn-primary" id="wizard-btn-next">Next Step</button>
        </div>
      </div>
    `;

    // Bind step 1 click listeners
    modal.querySelectorAll(".wizard-select-card[data-service-val]").forEach((card) => {
      card.addEventListener("click", () => {
        modal.querySelectorAll(".wizard-select-card[data-service-val]").forEach((c) => c.classList.remove("is-selected"));
        card.classList.add("is-selected");
        this.bookingState.service = card.getAttribute("data-service-val");
        this.updatePriceCalculations();
        this.clearError();
      });
    });

    // Timing radio change listener
    modal.querySelectorAll('input[name="wizard-timing"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const fields = document.getElementById("wizard-schedule-fields");
        if (fields) {
          fields.style.display = e.target.value === "scheduled" ? "block" : "none";
        }
      });
    });

    // Navigation buttons
    const prevBtn = document.getElementById("wizard-btn-prev");
    const nextBtn = document.getElementById("wizard-btn-next");

    prevBtn?.addEventListener("click", () => {
      this.prev();
      this.updateFooterNav();
    });

    nextBtn?.addEventListener("click", () => {
      this.next();
      this.updateFooterNav();
    });

    document.getElementById("wizard-close-x")?.addEventListener("click", () => closeModal(this.modalId));
  }

  updateFooterNav() {
    const prevBtn = document.getElementById("wizard-btn-prev");
    const nextBtn = document.getElementById("wizard-btn-next");
    const footer = document.getElementById("wizard-footer-nav");
    if (!prevBtn || !nextBtn || !footer) return;

    if (this.currentStep === 8) {
      footer.style.display = "none";
      return;
    }

    footer.style.display = "flex";
    prevBtn.style.display = this.currentStep > 1 ? "inline-flex" : "none";

    if (this.currentStep === 7) {
      nextBtn.textContent = "Confirm & Dispatch Booking";
      nextBtn.className = "btn btn-teal";
    } else {
      nextBtn.textContent = "Next Step";
      nextBtn.className = "btn btn-primary";
    }
  }
}

export const bookingWizard = new BookingWizardController();

// ============================================================================
// 4. Professional Profile Modal
// ============================================================================

export function openProfessionalProfile(proId) {
  const pros = store.getState().professionals || [];
  const pro = pros.find((p) => p.id === proId);
  if (!pro) {
    showToast("Technician profile not found.", "warning");
    return;
  }

  const modalId = "professional-profile-modal";
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "modal-backdrop";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
  }

  const initials = pro.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const isOnline = pro.isAvailable !== false && pro.presenceStatus !== "busy" && pro.presenceStatus !== "offline";
  const isBookmarked = isProSaved(pro.id);

  // Load real reviews saved via dataService + baseline seed reviews
  const realReviews = (dataService.getReviews ? dataService.getReviews() : []).filter(
    (r) => r.professionalId === pro.id
  );
  const allReviews = [
    ...realReviews.map((r) => ({
      name: r.customerName || "Customer",
      date: r.date || "Recently",
      rating: Number(r.rating) || 5,
      comment: r.comment,
      isReal: true
    })),
    ...SAMPLE_REVIEWS.map((r) => ({
      name: r.name,
      date: r.date,
      rating: 5,
      comment: r.comment,
      isReal: false
    }))
  ];

  modal.innerHTML = `
    <div class="modal profile-modal">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="badge badge-teal">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>Verified Technician</span>
          </span>
          <span style="font-size: 11px; color: var(--text-subtle);">${pro.label || "Demo professional"}</span>
        </div>
        <button type="button" class="modal-close-btn" id="profile-close-x" aria-label="Close profile">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Hero Header -->
        <div class="profile-hero">
          <div class="profile-avatar-lg">${initials}</div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
              <h2 style="font-size: var(--font-size-xl); margin: 0;">${pro.name}</h2>
              ${
                isOnline
                  ? `<span class="badge badge-success"><svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Available Now</span></span>`
                  : pro.presenceStatus === "busy"
                  ? `<span class="badge badge-warning"><svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg><span>Busy (On a Job)</span></span>`
                  : `<span class="badge badge-default"><svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg><span>Offline (Resting)</span></span>`
              }
            </div>
            <div style="font-size: 13px; font-weight: 600; color: var(--accent-teal); text-transform: uppercase; margin: 2px 0;">
              ${pro.categoryLabel || pro.category}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: var(--space-3); margin-top: 4px;">
              <span>★ <strong>${pro.rating}</strong> (${pro.reviewCount} verified reviews)</span>
              <span>•</span>
              <span><strong>${pro.experienceYears}</strong> years experience</span>
            </div>
          </div>
        </div>

        <p style="font-size: var(--font-size-sm); color: var(--text-muted); line-height: 1.6; margin-bottom: var(--space-4);">
          ${pro.bio}
        </p>

        <!-- Skills Pills -->
        <div style="margin-bottom: var(--space-4);">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-subtle);">Verified Skills & Specializations</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
            ${(pro.skills || []).map((s) => `<span class="pro-skill-pill" style="font-size: 12px; padding: 4px 10px;">${s}</span>`).join("")}
          </div>
        </div>

        <!-- Service Area & Location -->
        <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-xs);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: var(--accent-teal);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
              <span><strong>Service Area:</strong> Within 8 km around ${pro.areaName || "Indiranagar, Bengaluru"}</span>
            </div>
            <span class="badge badge-default">Haversine GPS Verified</span>
          </div>
        </div>

        <!-- Transparent Price List Estimates -->
        <div style="margin-bottom: var(--space-4);">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-subtle);">Standard Service Rate Estimates</span>
          <table class="price-list-table">
            <thead>
              <tr>
                <th>Service Item</th>
                <th>Estimated Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Inspection & Visiting Charge</td>
                <td>₹${pro.visitingFee} (Academic Estimate)</td>
              </tr>
              <tr>
                <td>Standard Labour (per hour base)</td>
                <td>₹${pro.baseRatePerHour}</td>
              </tr>
              <tr>
                <td>Emergency Dispatch Premium</td>
                <td>${pro.isEmergencyEligible ? "₹0 (No surge markup)" : "Not eligible"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Verified Reviews List -->
        <div>
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-subtle);">Customer Feedback (${allReviews.length} Reviews)</span>
          <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: 6px;">
            ${allReviews.map(
              (r) => `
              <div class="review-item">
                <div class="review-header">
                  <strong style="font-size: 12px;">${r.name}</strong>
                  <span style="font-size: 11px; color: var(--text-subtle);">${r.date}</span>
                </div>
                <div style="color: #B45309; font-size: 11px; margin-bottom: 2px;">
                  ${"★".repeat(r.rating)}${"☆".repeat(Math.max(0, 5 - r.rating))} ${r.rating}.0
                  ${r.isReal ? '<span class="badge badge-teal" style="font-size: 9px; padding: 1px 4px; margin-left: 4px;">Verified Review</span>' : ''}
                </div>
                <p style="font-size: 12px; margin: 0; color: var(--text-muted);">${r.comment}</p>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="modal-footer" style="justify-content: space-between;">
        <button type="button" class="btn btn-subtle btn-sm" id="btn-save-bookmark-pro">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span id="bookmark-text">${isBookmarked ? "Saved" : "Save Profile"}</span>
        </button>
        <div style="display: flex; gap: var(--space-2);">
          <button type="button" class="btn btn-outline" id="btn-simulated-contact">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>Simulate Contact</span>
          </button>
          <button type="button" class="btn btn-primary" id="btn-profile-book-now" ${!isOnline ? 'disabled title="Technician is currently unavailable"' : ''}>
            <span>Book Now</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind actions
  document.getElementById("profile-close-x")?.addEventListener("click", () => closeModal(modalId));

  document.getElementById("btn-save-bookmark-pro")?.addEventListener("click", () => {
    const isNowSaved = toggleSavePro(pro.id);
    const txt = document.getElementById("bookmark-text");
    if (txt) txt.textContent = isNowSaved ? "Saved" : "Save Profile";
    showToast(isNowSaved ? "Professional bookmarked to your list" : "Bookmark removed", "info");
  });

  document.getElementById("btn-simulated-contact")?.addEventListener("click", () => {
    showToast(`Simulated Call: Connecting to ${pro.name} at ${pro.phoneMasked || "+91 98450 •••••"} (Demo Masked)`, "info", 4500);
  });

  document.getElementById("btn-profile-book-now")?.addEventListener("click", () => {
    closeModal(modalId);
    bookingWizard.open(pro.category, pro.id);
  });

  openModal(modalId);
}

// ============================================================================
// 5. My Bookings Real-Time View Renderer
// ============================================================================

export function renderMyBookingsView() {
  const container = document.getElementById("view-bookings");
  if (!container) return;

  const bookings = store.getState().bookings || [];
  const upcoming = bookings.filter((b) => b.status !== "Completed" && b.status !== "Cancelled");
  const past = bookings.filter((b) => b.status === "Completed" || b.status === "Cancelled");

  if (bookings.length === 0) {
    container.innerHTML = `
      <div style="margin-bottom: var(--space-6);">
        <div class="badge badge-default" style="margin-bottom: var(--space-2);">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect></svg>
          <span>Customer Portal</span>
        </div>
        <h1 id="bookings-heading">My Service Bookings</h1>
        <p>Track live service requests, ETA, technician status, and completion feedback.</p>
      </div>

      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <h2 class="empty-state-title">No Active Bookings Found</h2>
        <p class="empty-state-desc">You currently have no scheduled or emergency service requests. Browse nearby technicians to create a request.</p>
        <a href="#services" class="btn btn-primary">Find a Technician</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom: var(--space-6);">
      <div class="badge badge-teal" style="margin-bottom: var(--space-2);">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Live Booking Synchronization Active</span>
      </div>
      <h1 id="bookings-heading">My Service Bookings (${bookings.length})</h1>
      <p>Real-time tracking of technician dispatch, arrival estimates, and service completion.</p>
    </div>

    <!-- Active / Upcoming Section -->
    <div style="margin-bottom: var(--space-8);">
      <h2 style="font-size: var(--font-size-lg); margin-bottom: var(--space-3); display: flex; align-items: center; gap: var(--space-2);">
        <span>Active & Upcoming Requests</span>
        <span class="badge badge-teal">${upcoming.length}</span>
      </h2>

      ${
        upcoming.length === 0
          ? `<div class="card" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
              No pending requests. All previous jobs completed!
            </div>`
          : `<div style="display: flex; flex-direction: column; gap: var(--space-4);">
              ${upcoming.map((b) => renderBookingRecordCard(b)).join("")}
            </div>`
      }
    </div>

    <!-- Past / History Section -->
    ${
      past.length > 0
        ? `<div>
            <h2 style="font-size: var(--font-size-lg); margin-bottom: var(--space-3); color: var(--text-muted); display: flex; align-items: center; gap: var(--space-2);">
              <span>Completed & Cancelled History</span>
              <span class="badge badge-default">${past.length}</span>
            </h2>
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              ${past.map((b) => renderBookingRecordCard(b)).join("")}
            </div>
          </div>`
        : ""
    }
  `;

  // Bind cancel buttons
  container.querySelectorAll(".btn-cancel-booking").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bId = btn.getAttribute("data-booking-id");
      if (confirm("Are you sure you want to cancel this booking?")) {
        await dataService.updateBooking(bId, { status: "Cancelled" });
        showToast("Booking cancelled.", "info");
      }
    });
  });

  // Bind track live status buttons
  container.querySelectorAll(".btn-track-booking").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.getAttribute("data-booking-id");
      openBookingStatusTracking(bId);
    });
  });

  // Bind leave review buttons
  container.querySelectorAll(".btn-leave-review").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.getAttribute("data-booking-id");
      openReviewModal(bId);
    });
  });
}

function renderBookingRecordCard(b) {
  const isEmergency = b.timingType === "immediate";
  const statusClass =
    b.status === "Booking Confirmed" || b.status === "Completed"
      ? "badge-success"
      : b.status === "Cancelled" || b.status === "Declined"
      ? "badge-danger"
      : "badge-teal";

  return `
    <article class="booking-record-card" data-booking-id="${b.id}">
      <div class="booking-record-header">
        <div>
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 4px; flex-wrap: wrap;">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: var(--primary);">${b.reference || b.id}</span>
            <span class="badge ${statusClass}">
              <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>${b.status}</span>
            </span>
            ${
              isEmergency
                ? `<span class="badge badge-danger">
                    <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line></svg>
                    <span>Emergency Priority</span>
                  </span>`
                : ""
            }
          </div>
          <h3 style="font-size: var(--font-size-base); text-transform: capitalize; margin: 0;">${b.serviceCategory || "Trade Repair"}</h3>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">₹${b.estimatedPrice?.total || 299}</span>
          <div style="font-size: 11px; color: var(--text-subtle);">Estimated total</div>
        </div>
      </div>

      <div style="font-size: 13px; color: var(--text-muted); background: var(--bg-subtle); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);">
        <strong>Problem:</strong> ${b.problemDescription || "Routine inspection"}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); font-size: 12px; color: var(--text-subtle);">
        <span>👨‍🔧 <strong>Technician:</strong> ${b.professionalName || "Demo Professional"}</span>
        <span>📍 <strong>Address:</strong> ${b.address?.flat || ""}, ${b.address?.locality || ""}</span>
        <span>⏱️ <strong>When:</strong> ${isEmergency ? "Immediate Dispatch (Est. 20-35m)" : (b.scheduledDate || "Today") + " " + (b.scheduledTime || "")}</span>
      </div>

      <div style="display: flex; justify-content: flex-end; align-items: center; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border-subtle); flex-wrap: wrap;">
        ${
          b.status !== "Cancelled"
            ? `<button type="button" class="btn btn-outline btn-sm btn-track-booking" data-booking-id="${b.id}">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Track Live Status</span>
              </button>`
            : ""
        }
        ${
          b.status === "Completed"
            ? b.reviewed
              ? `<span class="badge badge-success" style="padding: 6px 10px;">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  <span>Reviewed</span>
                </span>`
              : `<button type="button" class="btn btn-primary btn-sm btn-leave-review" data-booking-id="${b.id}">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  <span>Leave Review</span>
                </button>`
            : ""
        }
        ${
          b.status === "Booking Confirmed" || b.status === "Accepted"
            ? `<button type="button" class="btn btn-outline btn-sm btn-cancel-booking" data-booking-id="${b.id}" style="color: var(--status-danger);">
                <span>Cancel Booking</span>
              </button>`
            : ""
        }
      </div>
    </article>
  `;
}

// ============================================================================
// 10. Saved Professionals Bookmark Store
// ============================================================================

export function getSavedPros() {
  try {
    const raw = localStorage.getItem("bluecollar_saved_pros");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function isProSaved(proId) {
  if (!proId) return false;
  const list = getSavedPros();
  return list.includes(String(proId));
}

export function toggleSavePro(proId) {
  if (!proId) return false;
  const idStr = String(proId);
  let list = getSavedPros();
  const exists = list.includes(idStr);
  if (exists) {
    list = list.filter((id) => id !== idStr);
  } else {
    list.push(idStr);
  }
  try {
    localStorage.setItem("bluecollar_saved_pros", JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save bookmark:", e);
  }
  window.dispatchEvent(new CustomEvent("saved-pros-changed", { detail: { saved: list } }));
  return !exists;
}

// ============================================================================
// 11. Customer Live Booking Status & Tracking Modal
// ============================================================================

const STATUS_STEPS = [
  { key: "Booking Confirmed", label: "Booking Placed", desc: "Request broadcasted & recorded" },
  { key: "Accepted", label: "Accepted by Technician", desc: "Technician verified & confirmed job" },
  { key: "On the Way", label: "On the Way", desc: "Technician dispatched to your address" },
  { key: "Arrived", label: "Arrived at Location", desc: "Technician reached your doorstep" },
  { key: "Work in Progress", label: "Work in Progress", desc: "Inspection & repair underway" },
  { key: "Completed", label: "Service Completed", desc: "Payment settled & verified" }
];

let activeTrackingUnsubscribe = null;
let trackingLeafletMap = null;
let trackingWorkerMarker = null;
let trackingCustomerMarker = null;

export function openBookingStatusTracking(bookingId) {
  const allBookings = dataService.getBookings();
  let booking = allBookings.find((b) => b.id === bookingId);
  if (!booking) {
    showToast("Booking not found.", "warning");
    return;
  }

  // Create or retrieve tracking modal
  let modalEl = document.getElementById("booking-tracking-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "booking-tracking-modal";
    modalEl.className = "modal-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-labelledby", "tracking-modal-title");
    document.body.appendChild(modalEl);
  }

  const renderContent = (currentBooking) => {
    const isCancelled = currentBooking.status === "Cancelled" || currentBooking.status === "Declined";
    const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === currentBooking.status);
    const effectiveIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

    const pro = store.getState().professionals.find((p) => p.id === currentBooking.professionalId) || {
      name: currentBooking.professionalName || "Assigned Technician",
      phone: "+91 98765 43210",
      rating: 4.8
    };

    modalEl.innerHTML = `
      <div class="modal-dialog tracking-modal">
        <div class="modal-header">
          <div>
            <span class="badge badge-teal" style="margin-bottom: 4px;">Live Dispatch Tracker</span>
            <h2 id="tracking-modal-title" style="margin: 0; font-size: var(--font-size-lg);">
              Booking ${currentBooking.reference || currentBooking.id}
            </h2>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-tracking" aria-label="Close modal">
            <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="modal-body" style="padding: var(--space-4);">
          <!-- Worker Summary Card -->
          <div class="card" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); background: var(--bg-subtle);">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div class="avatar" style="width: 44px; height: 44px; font-weight: 700; background: var(--primary); color: #fff; border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center;">
                ${pro.name.charAt(0)}
              </div>
              <div>
                <h4 style="margin: 0; font-size: var(--font-size-sm);">${pro.name}</h4>
                <div style="font-size: 12px; color: var(--text-muted);">
                  ${currentBooking.serviceCategory || "Trade Specialist"} • ⭐ ${pro.rating || "4.8"}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: var(--space-2);">
              <a href="tel:${pro.phone || "9876543210"}" class="btn btn-outline btn-sm" title="Call Technician">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span>Call</span>
              </a>
            </div>
          </div>

          <!-- Live Map Section -->
          <div style="margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em;">
                Technician Location
              </span>
              <span id="tracking-gps-status-badge">
                ${
                  currentBooking.isSharingLocation && currentBooking.workerLocation
                    ? `<span class="badge badge-success"><svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Live GPS Active</span></span>`
                    : `<span class="badge badge-default"><span>Live location not shared</span></span>`
                }
              </span>
            </div>

            <div id="tracking-map-element" class="tracking-map-preview"></div>

            <div id="tracking-eta-panel" style="margin-top: var(--space-2); font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
              <span>Destination: <strong>${currentBooking.address?.locality || "Customer Address"}</strong></span>
              <span id="tracking-eta-value" style="font-weight: 700; color: var(--accent-teal);">
                ${
                  currentBooking.isSharingLocation && currentBooking.workerLocation && currentBooking.address?.coords
                    ? `ETA: ~${Math.max(8, Math.round(calculateHaversineDistanceKm(currentBooking.workerLocation.lat, currentBooking.workerLocation.lng, currentBooking.address.coords.lat, currentBooking.address.coords.lng) * 3.5))} mins (Estimate)`
                    : "ETA based on route dispatch"
                }
              </span>
            </div>
          </div>

          <!-- Status Timeline / Stepper -->
          <div>
            <h4 style="font-size: 13px; font-weight: 700; margin-bottom: var(--space-2); color: var(--text-main);">
              Job Progress Timeline
            </h4>
            
            ${
              isCancelled
                ? `<div class="card" style="padding: var(--space-3); background: #FEF2F2; border-color: #F87171; color: #991B1B; font-size: 13px;">
                    <strong>Service ${currentBooking.status}:</strong> This booking has been closed without completion.
                  </div>`
                : `<div class="tracking-stepper">
                    ${STATUS_STEPS.map((step, idx) => {
                      const isDone = idx < effectiveIndex || currentBooking.status === "Completed";
                      const isCurrent = idx === effectiveIndex && currentBooking.status !== "Completed";
                      const stepClass = isDone ? "is-done" : isCurrent ? "is-current" : "";

                      return `
                        <div class="tracking-step ${stepClass}">
                          <div class="tracking-dot">
                            ${
                              isDone
                                ? `<svg class="icon" style="width: 12px; height: 12px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                : idx + 1
                            }
                          </div>
                          <div style="font-size: 13px; font-weight: ${isCurrent ? 700 : 600}; color: ${isCurrent ? "var(--primary)" : isDone ? "var(--text-main)" : "var(--text-subtle)"};">
                            ${step.label}
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted);">
                            ${step.desc}
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>`
            }
          </div>
        </div>

        <div class="modal-footer" style="padding: var(--space-3) var(--space-4); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: var(--text-subtle);">Syncing live via DataService</span>
          <button type="button" class="btn btn-outline btn-sm btn-close-tracking">Close</button>
        </div>
      </div>
    `;

    // Bind Close buttons
    modalEl.querySelectorAll(".btn-close-tracking").forEach((b) => {
      b.onclick = () => closeTrackingModal();
    });

    // Initialize or update Leaflet map
    setTimeout(() => {
      initOrUpdateTrackingMap(currentBooking);
    }, 50);
  };

  const closeTrackingModal = () => {
    if (activeTrackingUnsubscribe) {
      activeTrackingUnsubscribe();
      activeTrackingUnsubscribe = null;
    }
    if (trackingLeafletMap) {
      try {
        trackingLeafletMap.remove();
      } catch (e) {}
      trackingLeafletMap = null;
    }
    modalEl.classList.remove("is-open");
  };

  // Render modal
  renderContent(booking);
  modalEl.classList.add("is-open");

  // Subscribe to real-time store updates
  activeTrackingUnsubscribe = store.subscribe((state) => {
    const updated = state.bookings.find((b) => b.id === bookingId);
    if (updated) {
      booking = updated;
      renderContent(updated);
    }
  });
}

function initOrUpdateTrackingMap(booking) {
  const mapContainer = document.getElementById("tracking-map-element");
  if (!mapContainer || typeof window.L === "undefined") return;

  const defaultCoords = [12.9716, 77.5946];
  const customerCoords = booking.address?.coords
    ? [booking.address.coords.lat, booking.address.coords.lng]
    : defaultCoords;

  const workerCoords = booking.workerLocation
    ? [booking.workerLocation.lat, booking.workerLocation.lng]
    : null;

  try {
    if (!trackingLeafletMap) {
      mapContainer.innerHTML = "";
      trackingLeafletMap = window.L.map(mapContainer, {
        zoomControl: true,
        attributionControl: false
      }).setView(customerCoords, 13);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18
      }).addTo(trackingLeafletMap);
    }

    // Customer marker
    if (!trackingCustomerMarker) {
      trackingCustomerMarker = window.L.marker(customerCoords, {
        title: "Service Location"
      }).addTo(trackingLeafletMap);
      trackingCustomerMarker.bindPopup("<b>Your Service Location</b><br>" + (booking.address?.locality || "")).openPopup();
    } else {
      trackingCustomerMarker.setLatLng(customerCoords);
    }

    // Worker marker
    if (workerCoords && booking.isSharingLocation) {
      const workerIcon = window.L.divIcon({
        className: "leaflet-worker-custom-icon",
        html: `<div class="worker-live-gps-pin">👨‍🔧 Technician GPS</div>`,
        iconSize: [110, 26],
        iconAnchor: [55, 13]
      });

      if (!trackingWorkerMarker) {
        trackingWorkerMarker = window.L.marker(workerCoords, { icon: workerIcon }).addTo(trackingLeafletMap);
      } else {
        trackingWorkerMarker.setLatLng(workerCoords);
      }

      // Fit bounds to show both customer and technician
      const group = new window.L.featureGroup([trackingCustomerMarker, trackingWorkerMarker]);
      trackingLeafletMap.fitBounds(group.getBounds().pad(0.25));
    } else {
      if (trackingWorkerMarker) {
        trackingLeafletMap.removeLayer(trackingWorkerMarker);
        trackingWorkerMarker = null;
      }
      trackingLeafletMap.setView(customerCoords, 14);
    }

    trackingLeafletMap.invalidateSize();
  } catch (err) {
    console.warn("Leaflet map initialization warning in tracking:", err);
  }
}

// ============================================================================
// 12. Review Submission Modal
// ============================================================================

export function openReviewModal(bookingId) {
  const booking = dataService.getBookings().find((b) => b.id === bookingId);
  if (!booking) {
    showToast("Booking record not found.", "warning");
    return;
  }

  let modalEl = document.getElementById("review-submission-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "review-submission-modal";
    modalEl.className = "modal-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    document.body.appendChild(modalEl);
  }

  let selectedRating = 5;

  modalEl.innerHTML = `
    <div class="modal-dialog" style="max-width: 500px;">
      <div class="modal-header">
        <div>
          <span class="badge badge-teal" style="margin-bottom: 4px;">Service Feedback</span>
          <h2 style="margin: 0; font-size: var(--font-size-lg);">Review Technician</h2>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-close-review" aria-label="Close modal">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <form id="review-submission-form" class="modal-body" style="padding: var(--space-4);">
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: var(--space-3);">
          How was your service experience with <strong>${booking.professionalName || "the technician"}</strong> for <em>${booking.serviceCategory}</em>?
        </p>

        <!-- Star Rating -->
        <div style="margin-bottom: var(--space-4); text-align: center;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: var(--space-2);">
            RATING (1 TO 5 STARS)
          </label>
          <div class="star-rating-wrap" style="justify-content: center;" id="star-rating-container">
            ${[1, 2, 3, 4, 5].map((star) => `
              <button type="button" class="star-btn ${star <= selectedRating ? "is-active" : ""}" data-star="${star}" aria-label="${star} stars">
                ★
              </button>
            `).join("")}
          </div>
          <div id="star-rating-label" style="font-size: 13px; font-weight: 600; color: var(--primary);">
            5 Stars — Outstanding Service
          </div>
        </div>

        <!-- Feedback Textarea -->
        <div class="form-group">
          <label for="review-comment-input">Your Feedback (Optional):</label>
          <textarea id="review-comment-input" class="form-textarea" rows="3" placeholder="Punctual, polite, fixed the wiring fault quickly with genuine parts..."></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4);">
          <button type="button" class="btn btn-outline btn-close-review">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-review">Submit Review</button>
        </div>
      </form>
    </div>
  `;

  modalEl.classList.add("is-open");

  const ratingLabels = {
    1: "1 Star — Poor Experience",
    2: "2 Stars — Below Average",
    3: "3 Stars — Satisfactory",
    4: "4 Stars — Very Good",
    5: "5 Stars — Outstanding Service"
  };

  const starBtns = modalEl.querySelectorAll(".star-btn");
  const labelEl = modalEl.querySelector("#star-rating-label");

  starBtns.forEach((btn) => {
    btn.onclick = () => {
      selectedRating = parseInt(btn.getAttribute("data-star"), 10);
      starBtns.forEach((b) => {
        const starVal = parseInt(b.getAttribute("data-star"), 10);
        b.classList.toggle("is-active", starVal <= selectedRating);
      });
      labelEl.textContent = ratingLabels[selectedRating];
    };
  });

  const closeReviewModal = () => {
    modalEl.classList.remove("is-open");
  };

  modalEl.querySelectorAll(".btn-close-review").forEach((b) => {
    b.onclick = () => closeReviewModal();
  });

  const form = modalEl.querySelector("#review-submission-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const comment = modalEl.querySelector("#review-comment-input").value.trim();

    await dataService.saveReview({
      bookingId: booking.id,
      professionalId: booking.professionalId,
      rating: selectedRating,
      comment: comment || "Great service provided, highly recommended.",
      customerName: "Resident Customer"
    });

    await dataService.updateBooking(booking.id, { reviewed: true });

    closeReviewModal();
    showToast("Thank you! Your review has been submitted.", "success");
    renderMyBookingsView();
  };
}

// ============================================================================
// 13. Emergency Rapid Dispatch Flow
// ============================================================================

export function openEmergencyBookingFlow() {
  let modalEl = document.getElementById("emergency-flow-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "emergency-flow-modal";
    modalEl.className = "modal-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    document.body.appendChild(modalEl);
  }

  const currentUserLoc = store.getState().userLocation || {
    address: "Koramangala 4th Block, Bengaluru",
    coords: { lat: 12.9352, lng: 77.6245 }
  };

  // Filter only Available professionals sorted by distance
  const allPros = (store.getState().professionals && store.getState().professionals.length > 0)
    ? store.getState().professionals
    : dataService.getProfessionals();

  const availablePros = allPros
    .filter((p) => {
      if (p.isAvailable === false) return false;
      if (p.presenceStatus === "offline" || p.presenceStatus === "busy") return false;
      if (p.availability === "Offline" || p.availability === "Busy") return false;
      return true;
    })
    .map((p) => {
      const pCoords = p.coordinates || p.serviceArea?.center || { lat: 12.9716, lng: 77.5946 };
      const dist = calculateHaversineDistanceKm(currentUserLoc.coords.lat, currentUserLoc.coords.lng, pCoords.lat, pCoords.lng);
      return { ...p, calculatedDistance: dist };
    })
    .sort((a, b) => a.calculatedDistance - b.calculatedDistance);

  modalEl.innerHTML = `
    <div class="modal-dialog" style="max-width: 600px;">
      <div class="modal-header" style="background: #FFFBEB; border-bottom: 1px solid #FDE68A;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span class="badge badge-danger">Urgent Dispatch</span>
            <span style="font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase;">Real-Time Fast Match</span>
          </div>
          <h2 style="margin: 0; font-size: var(--font-size-lg); color: #78350F;">
            Emergency Service Request
          </h2>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-close-emergency" aria-label="Close modal">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="modal-body" style="padding: var(--space-4);">
        <!-- Statutory Warning Disclaimer -->
        <div style="padding: var(--space-3); background: #FEF2F2; border-left: 4px solid var(--status-danger); border-radius: var(--radius-sm); margin-bottom: var(--space-4); font-size: 12px; color: #991B1B;">
          <strong>⚠️ IMPORTANT DISCLAIMER:</strong> This tool connects you with independent local trade specialists for urgent domestic repairs (water leak, sparking MCB, lockout). <strong>This is NOT a replacement for emergency services.</strong> If there is active fire, risk to life, or medical crisis, immediately dial <strong>112 (National Emergency), 101 (Fire), or 108 (Ambulance)</strong>.
        </div>

        <!-- Form Step Fields -->
        <form id="emergency-dispatch-form">
          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label for="emergency-category-select">Emergency Trade Required: *</label>
            <select id="emergency-category-select" class="form-select" required>
              <option value="plumber">Plumber (Water Leak / Burst Pipe)</option>
              <option value="electrician">Electrician (Sparking / MCB Tripping / Power Outage)</option>
              <option value="carpenter">Carpenter (Door Lock Jammed / Broken Lock)</option>
              <option value="ac_technician">AC / Appliance (Severe Gas Leak / Short Circuit)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label for="emergency-problem-desc">Describe the Urgent Situation: *</label>
            <textarea id="emergency-problem-desc" class="form-textarea" rows="2" required placeholder="e.g. Main water inlet valve burst under sink, continuous water gushing into kitchen..."></textarea>
          </div>

          <div class="form-group" style="margin-bottom: var(--space-3);">
            <label for="emergency-address-input">Service Address: *</label>
            <input type="text" id="emergency-address-input" class="form-input" required value="${currentUserLoc.address || 'Flat 402, Green Glen Layout, Bengaluru'}">
          </div>

          <!-- Nearest Available Matching Professionals -->
          <div style="margin-top: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
              <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin: 0;">
                AVAILABLE TECHNICIANS NEAR YOU (${availablePros.length})
              </label>
              <span style="font-size: 11px; color: var(--text-subtle);">Strictly "Available" status</span>
            </div>

            ${
              availablePros.length === 0
                ? `<div class="card" style="padding: var(--space-4); text-align: center; color: var(--text-muted); background: var(--bg-subtle);">
                    <strong>No emergency technicians currently Available nearby.</strong><br>
                    <span style="font-size: 12px;">All active pros are currently Busy or Offline. Please try booking a scheduled slot or check back shortly.</span>
                  </div>`
                : `<div style="display: flex; flex-direction: column; gap: var(--space-2); max-height: 190px; overflow-y: auto;">
                    ${availablePros.slice(0, 3).map((p, idx) => `
                      <label class="card" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3); cursor: pointer; border: 2px solid ${idx === 0 ? "var(--primary)" : "var(--border-color)"};">
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                          <input type="radio" name="emergency-pro-choice" value="${p.id}" ${idx === 0 ? "checked" : ""} required>
                          <div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${p.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${p.experience || "5+ yrs"} • ⭐ ${p.rating || "4.8"}</div>
                          </div>
                        </div>
                        <div style="text-align: right;">
                          <div style="font-size: 12px; font-weight: 700; color: var(--accent-teal);">~${Math.max(15, Math.round(p.calculatedDistance * 3.5))} mins (Est.)</div>
                          <div style="font-size: 11px; color: var(--text-subtle);">₹${p.priceList?.emergencyVisit || 349} visit fee</div>
                        </div>
                      </label>
                    `).join("")}
                  </div>`
            }
          </div>

          <!-- Price Summary Notice -->
          <div style="margin-top: var(--space-4); padding: var(--space-3); background: var(--bg-subtle); border-radius: var(--radius-md); font-size: 12px; color: var(--text-muted);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Emergency Priority Inspection Fee:</span>
              <strong style="color: var(--text-main);">₹349 (Estimate)</strong>
            </div>
            <div style="font-size: 11px; color: var(--text-subtle);">
              * Arrival times are realistic estimates depending on urban traffic. Labour & spare parts cost quoted transparently before work begins.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4);">
            <button type="button" class="btn btn-outline btn-close-emergency">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-emergency" ${availablePros.length === 0 ? "disabled" : ""}>
              <span>Dispatch Emergency Technician</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalEl.classList.add("is-open");

  const closeEmergency = () => {
    modalEl.classList.remove("is-open");
  };

  modalEl.querySelectorAll(".btn-close-emergency").forEach((b) => {
    b.onclick = () => closeEmergency();
  });

  const form = modalEl.querySelector("#emergency-dispatch-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const category = modalEl.querySelector("#emergency-category-select").value;
    const desc = modalEl.querySelector("#emergency-problem-desc").value.trim();
    const address = modalEl.querySelector("#emergency-address-input").value.trim();
    const selectedRadio = modalEl.querySelector("input[name='emergency-pro-choice']:checked");

    if (!selectedRadio) {
      showToast("Please choose an available technician.", "warning");
      return;
    }

    const proId = selectedRadio.value;
    const pro = availablePros.find((p) => p.id === proId) || availablePros[0];

    const emergencyBooking = {
      reference: generateBookingReference(),
      serviceCategory: category,
      problemDescription: desc,
      timingType: "immediate",
      priority: "emergency",
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTime: "Immediate",
      address: {
        flat: address,
        locality: currentUserLoc.address || "Current Location",
        coords: currentUserLoc.coords
      },
      professionalId: pro.id,
      professionalName: pro.name,
      estimatedPrice: {
        visitFee: 349,
        labour: 250,
        material: 0,
        total: 599
      },
      status: "Booking Confirmed",
      createdAt: new Date().toISOString()
    };

    const saved = await dataService.saveBooking(emergencyBooking);
    closeEmergency();
    showToast(`Emergency Request Placed! Ref: ${saved.reference}`, "success");

    // Open live tracking immediately
    setTimeout(() => {
      openBookingStatusTracking(saved.id);
    }, 300);
  };
}
