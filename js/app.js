/**
 * Blue Collar — Main Application Orchestrator
 * Bootstraps routing, role switching, real-time sync indicators, location detection,
 * OpenStreetMap/Leaflet integration, and dynamic professional filtering.
 */

import { store, dataService } from './state.js';
import { ICONS, showToast, openModal, closeModal } from './ui.js';
import { getProfessionalsAroundLocation } from './data.js';
import {
  calculateHaversineDistanceKm,
  calculateEstimatedEta,
  requestBrowserLocation,
  reverseGeocode,
  searchAddressNominatim,
  MapController
} from './map.js';
import {
  bookingWizard,
  openProfessionalProfile,
  renderMyBookingsView,
  openBookingStatusTracking,
  openReviewModal,
  openEmergencyBookingFlow,
  getSavedPros,
  isProSaved,
  toggleSavePro
} from './booking.js';
import { renderWorkerDashboard, startPresenceHeartbeat, stopPresenceHeartbeat } from './worker.js';

// ============================================================================
// 1. Hash-Based View Router
// ============================================================================

const VALID_ROUTES = [
  "home",
  "services",
  "bookings",
  "dashboard",
  "testing",
  "about",
  "contact",
  "help",
  "privacy",
  "terms"
];

let mapControllerInstance = null;

function handleRoute() {
  const hash = window.location.hash.replace("#", "").trim();
  const targetRoute = VALID_ROUTES.includes(hash) ? hash : "home";

  // Hide all view panels
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.remove("is-active");
  });

  // Activate selected panel
  const activePanel = document.getElementById(`view-${targetRoute}`);
  if (activePanel) {
    activePanel.classList.add("is-active");
  }

  // Update navigation link highlights
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const linkTarget = link.getAttribute("data-nav");
    if (linkTarget === targetRoute) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  document.querySelectorAll("[data-drawer-nav]").forEach((link) => {
    const linkTarget = link.getAttribute("data-drawer-nav");
    if (linkTarget === targetRoute) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  // Update document title for accessibility & SEO
  const routeTitles = {
    home: "Blue Collar — Local Service Finder",
    services: "Find Nearby Technicians — Blue Collar",
    bookings: "My Service Bookings — Blue Collar",
    dashboard: "Professional Workstation — Blue Collar",
    testing: "Prototype Stakeholder Testing — Blue Collar",
    about: "Design Thinking Prototype Context — Blue Collar",
    contact: "Contact & Feedback — Blue Collar",
    help: "Help & FAQs — Blue Collar",
    privacy: "Privacy Policy — Blue Collar",
    terms: "Terms of Academic Use — Blue Collar"
  };

  document.title = routeTitles[targetRoute] || "Blue Collar";
  store.setState({ activeView: targetRoute });

  // Close mobile drawer if open
  closeMobileDrawer();

  // If entering services view, initialize or invalidate map sizing
  if (targetRoute === "services") {
    initOrUpdateMap();
  } else if (targetRoute === "bookings") {
    renderMyBookingsView();
  } else if (targetRoute === "dashboard") {
    renderWorkerDashboard();
  } else if (targetRoute === "testing") {
    renderTestingFeedbackSummary();
  }

  // Scroll to main content smoothly
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================================
// 2. Role Switcher Management
// ============================================================================

function setRole(newRole) {
  if (newRole !== "customer" && newRole !== "professional") return;

  const currentRole = store.getState().currentRole;
  if (currentRole === newRole) return;

  store.setState({ currentRole: newRole });

  // Update Header Toggle Buttons
  const btnCustomer = document.getElementById("btn-role-customer");
  const btnPro = document.getElementById("btn-role-pro");
  const displayRoleText = document.getElementById("active-role-display");
  const navRoleLink = document.getElementById("nav-role-link");
  const navRoleLinkText = document.getElementById("nav-role-link-text");
  const drawerRoleLink = document.getElementById("drawer-role-link");

  if (newRole === "customer") {
    btnCustomer?.classList.add("is-active");
    btnCustomer?.setAttribute("aria-checked", "true");
    btnPro?.classList.remove("is-active");
    btnPro?.setAttribute("aria-checked", "false");

    if (displayRoleText) displayRoleText.textContent = "Customer (Resident/Student)";
    if (navRoleLink) {
      navRoleLink.setAttribute("href", "#bookings");
      navRoleLink.setAttribute("data-nav", "bookings");
      navRoleLinkText.textContent = "My Bookings";
    }
    if (drawerRoleLink) {
      drawerRoleLink.setAttribute("href", "#bookings");
      drawerRoleLink.setAttribute("data-drawer-nav", "bookings");
      drawerRoleLink.textContent = "My Bookings";
    }

    showToast("Switched to Customer View", "info");
    if (window.location.hash === "#dashboard") window.location.hash = "#bookings";
  } else {
    btnPro?.classList.add("is-active");
    btnPro?.setAttribute("aria-checked", "true");
    btnCustomer?.classList.remove("is-active");
    btnCustomer?.setAttribute("aria-checked", "false");

    if (displayRoleText) displayRoleText.textContent = "Professional (Technician/Electrician)";
    if (navRoleLink) {
      navRoleLink.setAttribute("href", "#dashboard");
      navRoleLink.setAttribute("data-nav", "dashboard");
      navRoleLinkText.textContent = "Worker Dashboard";
    }
    if (drawerRoleLink) {
      drawerRoleLink.setAttribute("href", "#dashboard");
      drawerRoleLink.setAttribute("data-drawer-nav", "dashboard");
      drawerRoleLink.textContent = "Worker Dashboard";
    }

    showToast("Switched to Professional View", "info");
    if (window.location.hash === "#bookings") window.location.hash = "#dashboard";
  }
}

// ============================================================================
// 3. Mobile Navigation Drawer
// ============================================================================

function openMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const btn = document.getElementById("mobile-menu-open-btn");
  if (drawer) {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    btn?.setAttribute("aria-expanded", "true");
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const btn = document.getElementById("mobile-menu-open-btn");
  if (drawer) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    btn?.setAttribute("aria-expanded", "false");
  }
}

// ============================================================================
// 4. Location State, Geolocation & Nominatim Autocomplete
// ============================================================================

let userLocation = {
  lat: 12.9716, // Default fallback: Bengaluru center
  lng: 77.5946,
  address: "Indiranagar, Bengaluru, Karnataka"
};

let currentProfessionals = [];
let selectedProId = null;

const filterState = {
  keyword: "",
  category: "all",
  maxDistance: "5",
  minRating: "all",
  maxFee: "all",
  availableOnly: false,
  savedOnly: false,
  sortBy: "distance_asc"
};

function initUserLocation() {
  try {
    const saved = localStorage.getItem("bluecollar_user_location");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lat && parsed.lng) {
        userLocation = parsed;
      }
    }
  } catch (err) {
    console.warn("Could not parse saved location:", err);
  }

  updateLocationInputsAndLabels(userLocation);
  refreshProfessionalsAroundLocation();
}

function saveUserLocation(loc) {
  userLocation = { ...loc };
  localStorage.setItem("bluecollar_user_location", JSON.stringify(userLocation));
  updateLocationInputsAndLabels(userLocation);
  refreshProfessionalsAroundLocation();
  if (mapControllerInstance) {
    mapControllerInstance.updateUserMarker(userLocation);
  }
}

function updateLocationInputsAndLabels(loc) {
  const heroInput = document.getElementById("hero-location-input");
  const activeLabel = document.getElementById("services-active-location-label");
  if (heroInput && !heroInput.value) {
    heroInput.value = loc.address;
  }
  if (activeLabel) {
    activeLabel.textContent = loc.address;
  }
}

function refreshProfessionalsAroundLocation() {
  currentProfessionals = getProfessionalsAroundLocation(userLocation.lat, userLocation.lng);
  applyFiltersAndRender();
}

// Geolocation Click Handler (Gracefully handling denied / unavailable)
async function handleGeolocationRequest() {
  const btn = document.getElementById("btn-use-geolocation");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Detecting...</span>`;
  }

  const res = await requestBrowserLocation();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      <span>Locate Me</span>
    `;
  }

  if (res.success) {
    // Reverse geocode detected coordinates
    showToast("GPS position acquired. Resolving address...", "info");
    const address = await reverseGeocode(res.coords.lat, res.coords.lng);
    saveUserLocation({
      lat: res.coords.lat,
      lng: res.coords.lng,
      address
    });
    showToast(`Location set to: ${address}`, "success");
  } else {
    // Graceful error notification & polite fallback to city center
    showToast(`Notice: ${res.error}`, "warning");
    saveUserLocation({
      lat: res.coords.lat,
      lng: res.coords.lng,
      address: "Bengaluru Center (Default Fallback)"
    });
  }
}

// Nominatim Address Suggestions Setup
function setupNominatimAutocomplete() {
  const input = document.getElementById("hero-location-input");
  const dropdown = document.getElementById("hero-location-suggestions");
  if (!input || !dropdown) return;

  input.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val.length < 3) {
      dropdown.classList.remove("is-open");
      dropdown.innerHTML = "";
      return;
    }

    searchAddressNominatim(val, (suggestions) => {
      if (!suggestions || suggestions.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 10px; font-size: 13px; color: var(--text-muted); text-align: center;">
            No matching locations found
          </div>
          <div class="nominatim-attribution">Data &copy; OpenStreetMap contributors</div>
        `;
        dropdown.classList.add("is-open");
        return;
      }

      dropdown.innerHTML = suggestions
        .map(
          (s) => `
          <div class="suggestion-item" data-lat="${s.lat}" data-lng="${s.lng}" data-address="${s.shortName}">
            <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: var(--accent-teal);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600;">${s.shortName}</span>
              <span style="font-size: 11px; color: var(--text-subtle);">${s.displayName}</span>
            </div>
          </div>
        `
        )
        .join("") + `<div class="nominatim-attribution">Data &copy; OpenStreetMap contributors</div>`;

      dropdown.classList.add("is-open");
    });
  });

  dropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (!item) return;

    const lat = parseFloat(item.getAttribute("data-lat"));
    const lng = parseFloat(item.getAttribute("data-lng"));
    const address = item.getAttribute("data-address");

    input.value = address;
    dropdown.classList.remove("is-open");
    dropdown.innerHTML = "";

    saveUserLocation({ lat, lng, address });
    showToast(`Location set to: ${address}`, "success");
  });

  // Close suggestions on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".location-search-wrap")) {
      dropdown.classList.remove("is-open");
    }
  });
}

// ============================================================================
// 5. Leaflet Map Integration & Bidirectional Highlight
// ============================================================================

function initOrUpdateMap() {
  if (!mapControllerInstance && window.L) {
    mapControllerInstance = new MapController("services-leaflet-map");
    mapControllerInstance.init(userLocation, 13, (proId) => {
      highlightProfessional(proId, true);
    });
  } else if (mapControllerInstance) {
    mapControllerInstance.invalidateSize();
  }
}

function highlightProfessional(proId, scrollToCard = false) {
  selectedProId = proId;

  // Highlight card in DOM
  document.querySelectorAll(".pro-card").forEach((card) => {
    if (card.getAttribute("data-pro-id") === proId) {
      card.classList.add("is-selected");
      if (scrollToCard) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      card.classList.remove("is-selected");
    }
  });

  // Highlight marker on map
  if (mapControllerInstance) {
    mapControllerInstance.highlightPro(proId);
  }
}

// ============================================================================
// 6. Professional Filtering, Sorting & Rendering
// ============================================================================

function applyFiltersAndRender() {
  const cardsContainer = document.getElementById("services-cards-list");
  const emptyState = document.getElementById("services-empty-state");
  const resultsCount = document.getElementById("services-results-count");
  if (!cardsContainer) return;

  // Calculate real distance & estimated ETA for all professionals
  const enrichedPros = currentProfessionals.map((pro) => {
    const dist = calculateHaversineDistanceKm(
      userLocation.lat,
      userLocation.lng,
      pro.coordinates.lat,
      pro.coordinates.lng
    );
    const eta = calculateEstimatedEta(dist);
    return {
      ...pro,
      distanceKm: dist,
      estimatedEta: eta
    };
  });

  // Filter Pipeline
  const filtered = enrichedPros.filter((pro) => {
    // 1. Keyword search
    if (filterState.keyword) {
      const q = filterState.keyword.toLowerCase();
      const matchName = pro.name.toLowerCase().includes(q);
      const matchCat = (pro.categoryLabel || pro.category).toLowerCase().includes(q);
      const matchBio = pro.bio.toLowerCase().includes(q);
      const matchSkills = pro.skills?.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchCat && !matchBio && !matchSkills) return false;
    }

    // 2. Category
    if (filterState.category !== "all" && pro.category !== filterState.category) {
      return false;
    }

    // 3. Max distance
    if (filterState.maxDistance !== "all") {
      const maxDist = parseFloat(filterState.maxDistance);
      if (pro.distanceKm > maxDist) return false;
    }

    // 4. Min rating
    if (filterState.minRating !== "all") {
      const minR = parseFloat(filterState.minRating);
      if (pro.rating < minR) return false;
    }

    // 5. Max fee
    if (filterState.maxFee !== "all") {
      const maxF = parseFloat(filterState.maxFee);
      if (pro.visitingFee > maxF) return false;
    }

    // 6. Availability
    if (filterState.availableOnly && !pro.isAvailable) {
      return false;
    }

    // 7. Saved Only Bookmark Filter
    if (filterState.savedOnly && !isProSaved(pro.id)) {
      return false;
    }

    return true;
  });

  // Sorting Pipeline
  filtered.sort((a, b) => {
    if (filterState.sortBy === "distance_asc") return a.distanceKm - b.distanceKm;
    if (filterState.sortBy === "rating_desc") return b.rating - a.rating;
    if (filterState.sortBy === "fee_asc") return a.visitingFee - b.visitingFee;
    if (filterState.sortBy === "experience_desc") return b.experienceYears - a.experienceYears;
    return 0;
  });

  // Update Result Count & Saved Pros Badge
  const savedCountBadge = document.getElementById("saved-pros-count");
  if (savedCountBadge) {
    savedCountBadge.textContent = getSavedPros().length;
  }

  if (resultsCount) {
    resultsCount.textContent = `Showing ${filtered.length} verified professional${filtered.length === 1 ? '' : 's'}`;
  }

  // Handle Empty State
  if (filtered.length === 0) {
    cardsContainer.innerHTML = "";
    if (emptyState) emptyState.style.display = "flex";
    if (mapControllerInstance) mapControllerInstance.renderProfessionals([]);
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // Render Cards HTML
  cardsContainer.innerHTML = filtered
    .map((pro) => {
      const initials = pro.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2);

      const isOnline = pro.isAvailable !== false;

      return `
        <article class="pro-card ${pro.id === selectedProId ? 'is-selected' : ''}" data-pro-id="${pro.id}" tabindex="0" role="region" aria-label="${pro.name}, ${pro.categoryLabel}">
          <div class="pro-card-header">
            <div class="pro-avatar" aria-hidden="true">${initials}</div>
            <div class="pro-header-info">
              <div class="pro-name-row">
                <span class="pro-name">${pro.name}</span>
                <span class="badge badge-default" style="font-size: 10px;">${pro.label || "Demo professional"}</span>
                <span class="badge badge-teal" style="font-size: 10px;">
                  <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  <span>${pro.verificationBadge || "Demo Verified"}</span>
                </span>
              </div>
              <div style="font-size: 12px; color: var(--accent-teal); font-weight: 600; text-transform: uppercase;">
                ${pro.categoryLabel || pro.category}
              </div>
            </div>
          </div>

          <div class="pro-skills-wrap">
            ${(pro.skills || []).map((s) => `<span class="pro-skill-pill">${s}</span>`).join("")}
          </div>

          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: 0;">
            ${pro.bio}
          </p>

          <div class="pro-metrics-grid">
            <div class="pro-metric-item">
              <span class="pro-metric-label">Rating</span>
              <span class="pro-metric-value" style="color: #B45309;">
                ★ ${pro.rating} <span style="font-size: 11px; color: var(--text-subtle); font-weight: normal;">(${pro.reviewCount})</span>
              </span>
            </div>
            <div class="pro-metric-item">
              <span class="pro-metric-label">Haversine Distance</span>
              <span class="pro-metric-value">
                <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: var(--accent-teal);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
                ${pro.distanceKm} km
              </span>
            </div>
            <div class="pro-metric-item">
              <span class="pro-metric-label">Estimated Arrival</span>
              <span class="pro-metric-value">
                <svg class="icon icon-sm" viewBox="0 0 24 24" style="color: var(--text-subtle);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${pro.estimatedEta}
              </span>
            </div>
            <div class="pro-metric-item">
              <span class="pro-metric-label">Visiting Fee (Demo)</span>
              <span class="pro-metric-value">
                ₹${pro.visitingFee}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: 2px;">
            <div>
              ${
                isOnline
                  ? `<span class="badge badge-success">
                      <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Available Now</span>
                    </span>`
                  : `<span class="badge badge-warning">
                      <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <span>Offline (Resting)</span>
                    </span>`
              }
            </div>
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <button type="button" class="btn btn-subtle btn-sm btn-view-profile" data-pro-id="${pro.id}">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Profile</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-focus-on-map" data-pro-id="${pro.id}">
                <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                <span>Map</span>
              </button>
              <button type="button" class="btn btn-primary btn-sm btn-book-pro" data-pro-id="${pro.id}" ${!isOnline ? 'disabled title="Technician is currently offline"' : ''}>
                <span>Book Now</span>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  // Update Leaflet Map Markers
  if (mapControllerInstance) {
    mapControllerInstance.renderProfessionals(filtered, selectedProId);
  }

  // Bind Card Click Handlers
  cardsContainer.querySelectorAll(".pro-card").forEach((card) => {
    card.addEventListener("click", () => {
      const proId = card.getAttribute("data-pro-id");
      highlightProfessional(proId, false);
    });
  });

  cardsContainer.querySelectorAll(".btn-view-profile").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const proId = btn.getAttribute("data-pro-id");
      openProfessionalProfile(proId);
    });
  });

  cardsContainer.querySelectorAll(".btn-focus-on-map").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const proId = btn.getAttribute("data-pro-id");
      highlightProfessional(proId, false);
    });
  });

  cardsContainer.querySelectorAll(".btn-book-pro").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const proId = btn.getAttribute("data-pro-id");
      const pro = filtered.find((p) => p.id === proId);
      if (pro && pro.isAvailable === false) {
        showToast("Technician is currently offline. Please choose an active professional.", "warning");
        return;
      }
      bookingWizard.open(pro ? pro.category : null, proId);
    });
  });
}

// ============================================================================
// 7. Setup Filter & Discovery Event Listeners
// ============================================================================

// Debounce utility to optimize responsiveness and eliminate unneeded refiltering
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function setupFilterListeners() {
  const keywordInput = document.getElementById("services-search-keyword");
  const categorySelect = document.getElementById("services-filter-category");
  const distanceSelect = document.getElementById("services-filter-distance");
  const ratingSelect = document.getElementById("services-filter-rating");
  const priceSelect = document.getElementById("services-filter-price");
  const sortSelect = document.getElementById("services-sort-by");
  const availableOnly = document.getElementById("services-filter-available-only");
  const resetBtn = document.getElementById("btn-reset-filters");
  const emptyResetBtn = document.getElementById("btn-empty-reset");

  const debouncedKeywordFilter = debounce((keyword) => {
    filterState.keyword = keyword;
    applyFiltersAndRender();
  }, 300);

  keywordInput?.addEventListener("input", (e) => {
    debouncedKeywordFilter(e.target.value.trim());
  });

  categorySelect?.addEventListener("change", (e) => {
    filterState.category = e.target.value;
    applyFiltersAndRender();
  });

  distanceSelect?.addEventListener("change", (e) => {
    filterState.maxDistance = e.target.value;
    applyFiltersAndRender();
  });

  ratingSelect?.addEventListener("change", (e) => {
    filterState.minRating = e.target.value;
    applyFiltersAndRender();
  });

  priceSelect?.addEventListener("change", (e) => {
    filterState.maxFee = e.target.value;
    applyFiltersAndRender();
  });

  sortSelect?.addEventListener("change", (e) => {
    filterState.sortBy = e.target.value;
    applyFiltersAndRender();
  });

  availableOnly?.addEventListener("change", (e) => {
    filterState.availableOnly = e.target.checked;
    applyFiltersAndRender();
  });

  const savedOnly = document.getElementById("services-filter-saved-only");
  savedOnly?.addEventListener("change", (e) => {
    filterState.savedOnly = e.target.checked;
    applyFiltersAndRender();
  });

  window.addEventListener("saved-pros-changed", () => {
    const savedCountBadge = document.getElementById("saved-pros-count");
    if (savedCountBadge) savedCountBadge.textContent = getSavedPros().length;
    if (filterState.savedOnly) {
      applyFiltersAndRender();
    }
  });

  function resetAllFilters() {
    filterState.keyword = "";
    filterState.category = "all";
    filterState.maxDistance = "15";
    filterState.minRating = "all";
    filterState.maxFee = "all";
    filterState.availableOnly = false;
    filterState.savedOnly = false;
    filterState.sortBy = "distance_asc";

    if (keywordInput) keywordInput.value = "";
    if (categorySelect) categorySelect.value = "all";
    if (distanceSelect) distanceSelect.value = "15";
    if (ratingSelect) ratingSelect.value = "all";
    if (priceSelect) priceSelect.value = "all";
    if (sortSelect) sortSelect.value = "distance_asc";
    if (availableOnly) availableOnly.checked = false;
    if (savedOnly) savedOnly.checked = false;

    applyFiltersAndRender();
    showToast("Filters reset to default view.", "info");
  }

  resetBtn?.addEventListener("click", resetAllFilters);
  emptyResetBtn?.addEventListener("click", resetAllFilters);

  // Category Cards in Hero Grid Click
  document.querySelectorAll(".category-card[data-category]").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = card.getAttribute("data-category");
      filterState.category = cat;
      if (categorySelect) categorySelect.value = cat;
      window.location.hash = "#services";
      applyFiltersAndRender();
      showToast(`Filtered by trade: ${cat}`, "info");
    });
  });

  // Hero Search Actions
  document.getElementById("btn-hero-find-services")?.addEventListener("click", () => {
    const serviceInput = document.getElementById("hero-service-search-input");
    const query = serviceInput?.value.trim() || "";
    if (query) {
      filterState.keyword = query;
      if (keywordInput) keywordInput.value = query;
    }
    window.location.hash = "#services";
    applyFiltersAndRender();
  });

  document.getElementById("hero-service-search-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-hero-find-services")?.click();
    }
  });

  // Emergency CTA -> Launch Emergency Booking Flow
  document.getElementById("btn-hero-emergency")?.addEventListener("click", () => {
    openEmergencyBookingFlow();
  });

  // Newcomer guide shortcut buttons
  document.getElementById("btn-quick-newcomer-electrician")?.addEventListener("click", () => {
    filterState.category = "electrician";
    if (categorySelect) categorySelect.value = "electrician";
    window.location.hash = "#services";
    applyFiltersAndRender();
  });

  document.getElementById("btn-quick-newcomer-plumber")?.addEventListener("click", () => {
    filterState.category = "plumber";
    if (categorySelect) categorySelect.value = "plumber";
    window.location.hash = "#services";
    applyFiltersAndRender();
  });

  document.getElementById("btn-quick-newcomer-handyman")?.addEventListener("click", () => {
    filterState.category = "other";
    if (categorySelect) categorySelect.value = "other";
    window.location.hash = "#services";
    applyFiltersAndRender();
  });

  // Change location CTA in services bar
  document.getElementById("btn-services-change-location")?.addEventListener("click", () => {
    window.location.hash = "#home";
    const locInput = document.getElementById("hero-location-input");
    locInput?.focus();
    locInput?.scrollIntoView({ behavior: "smooth" });
  });

  // Become a Professional CTA
  document.getElementById("btn-hero-become-pro")?.addEventListener("click", () => {
    setRole("professional");
    window.location.hash = "#dashboard";
  });
}

// ============================================================================
// 8. Presence Updates & Live Sync
// ============================================================================

function updateWorkerPresenceBadge(isAvailable) {
  const badgeWrap = document.getElementById("worker-status-badge");
  if (!badgeWrap) return;

  if (isAvailable) {
    badgeWrap.innerHTML = `
      <span class="badge badge-success">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Online & Ready for Jobs</span>
      </span>
    `;
  } else {
    badgeWrap.innerHTML = `
      <span class="badge badge-warning">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Offline (Resting / On Break)</span>
      </span>
    `;
  }
}

// ============================================================================
// 8b. Prototype Testing & Stakeholder Evaluation
// ============================================================================

const testingScores = {
  discovery: 5,
  profile: 5,
  pricing: 5,
  booking: 5,
  trust: 5
};

function initTestingPage() {
  const container = document.getElementById("view-testing");
  if (!container) return;

  // Setup pill click listeners for metrics
  container.querySelectorAll("[data-metric]").forEach((group) => {
    const metric = group.getAttribute("data-metric");
    const pills = group.querySelectorAll(".testing-score-pill");
    const badge = document.getElementById(`val-${metric}-badge`);

    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        pills.forEach((p) => p.classList.remove("is-selected"));
        pill.classList.add("is-selected");
        const val = parseInt(pill.getAttribute("data-val"), 10) || 5;
        testingScores[metric] = val;
        if (badge) badge.textContent = `${val} / 5`;
      });
    });
  });

  // Handle form submission
  const form = document.getElementById("testing-feedback-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const persona = document.getElementById("testing-tester-role")?.value || "Academic Reviewer / Faculty";
    const comment = document.getElementById("testing-comment")?.value.trim() || "";

    const avg = Number(
      ((testingScores.discovery + testingScores.profile + testingScores.pricing + testingScores.booking + testingScores.trust) / 5).toFixed(1)
    );

    const feedbackEntry = {
      id: "tf_" + Date.now(),
      timestamp: new Date().toISOString(),
      persona,
      scores: { ...testingScores },
      comment,
      overallAvg: avg
    };

    await dataService.saveTestingFeedback(feedbackEntry);
    showToast("Thank you! Stakeholder test evaluation recorded.", "success");
    const commentInput = document.getElementById("testing-comment");
    if (commentInput) commentInput.value = "";
    renderTestingFeedbackSummary();
  });

  renderTestingFeedbackSummary();
}

async function renderTestingFeedbackSummary() {
  const list = (await dataService.getTestingFeedback()) || [];
  const overallEl = document.getElementById("summary-overall-score");
  const countEl = document.getElementById("summary-total-responses");
  const barsContainer = document.getElementById("summary-metric-bars");
  const recentContainer = document.getElementById("testing-recent-entries");

  if (!barsContainer || !recentContainer) return;

  if (list.length === 0) {
    if (overallEl) overallEl.textContent = "5.0";
    if (countEl) countEl.textContent = "From 0 responses";
    barsContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-subtle);">No responses recorded yet.</div>`;
    recentContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-subtle);">No evaluations submitted yet.</div>`;
    return;
  }

  // Calculate aggregates
  const totals = { discovery: 0, profile: 0, pricing: 0, booking: 0, trust: 0, overall: 0 };
  list.forEach((entry) => {
    totals.discovery += entry.scores?.discovery || 5;
    totals.profile += entry.scores?.profile || 5;
    totals.pricing += entry.scores?.pricing || 5;
    totals.booking += entry.scores?.booking || 5;
    totals.trust += entry.scores?.trust || 5;
    totals.overall += entry.overallAvg || 5;
  });

  const n = list.length;
  const avgs = {
    discovery: totals.discovery / n,
    profile: totals.profile / n,
    pricing: totals.pricing / n,
    booking: totals.booking / n,
    trust: totals.trust / n,
    overall: totals.overall / n
  };

  if (overallEl) overallEl.textContent = avgs.overall.toFixed(1);
  if (countEl) countEl.textContent = `From ${n} stakeholder evaluation${n === 1 ? '' : 's'}`;

  const METRIC_LABELS = [
    { key: "discovery", label: "1. Service Discovery Ease" },
    { key: "profile", label: "2. Profile & Credential Clarity" },
    { key: "pricing", label: "3. Pricing Transparency" },
    { key: "booking", label: "4. Booking Wizard Usability" },
    { key: "trust", label: "5. Trust & Reliability Perception" }
  ];

  barsContainer.innerHTML = METRIC_LABELS.map((m) => {
    const score = avgs[m.key];
    const pct = Math.min(100, Math.max(0, (score / 5) * 100));
    return `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="font-weight: 600; color: var(--text-main);">${m.label}</span>
          <span style="font-weight: 700; color: var(--accent-teal);">${score.toFixed(1)} / 5.0</span>
        </div>
        <div class="metric-bar-bg" role="progressbar" aria-valuenow="${score.toFixed(1)}" aria-valuemin="1" aria-valuemax="5" aria-label="${m.label}">
          <div class="metric-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }).join("");

  // Sort newest first
  const sorted = [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  recentContainer.innerHTML = sorted.map((entry) => {
    const timeStr = new Date(entry.timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const safeComment = (entry.comment || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
      <div style="padding: var(--space-3); background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="font-size: 13px; color: var(--primary);">${entry.persona || "Stakeholder"}</strong>
          <span class="badge badge-teal" style="font-size: 11px;">★ ${entry.overallAvg ? entry.overallAvg.toFixed(1) : "5.0"}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
          ${timeStr}
        </div>
        ${safeComment ? `<div style="font-size: 12px; color: var(--text-main); font-style: italic; line-height: 1.4;">“${safeComment}”</div>` : ''}
      </div>
    `;
  }).join("");
}

// ============================================================================
// 8c. Faculty Demo Script & Presentation Controls
// ============================================================================

const FACULTY_DEMO_STEPS = [
  { id: "step-1", title: "1. Problem Framing & Empathy", desc: "Introduce the student/tenant struggle finding trustworthy tradespeople without middlemen or exorbitant commission." },
  { id: "step-2", title: "2. Real Geolocation & Proximity", desc: "Demonstrate 'Use Current Location' with OSM reverse geocoding & live Haversine distance calculation to 10+ nearby professionals." },
  { id: "step-3", title: "3. Interactive Map & Live Filters", desc: "Filter by category, rating, maximum visiting fee, and toggle live availability pins on the Leaflet map." },
  { id: "step-4", title: "4. Transparent 8-Step Booking Wizard", desc: "Demonstrate real current time slot validation, upfront pricing breakdown (visit fee + estimated labour), and instant confirmation reference." },
  { id: "step-5", title: "5. Multi-Tab Real-Time Worker Dispatch", desc: "Open Professional view in 2nd tab: toggle presence, receive live booking request, Accept, and advance status." },
  { id: "step-6", title: "6. Customer Tracking & Live ETA", desc: "Show customer tracking timeline auto-updating instantly across tabs, including worker live location sharing and real-time distance calculation." },
  { id: "step-7", title: "7. Emergency SOS Fast-Track", desc: "Trigger 1-click Emergency mode: instant filter for only online, nearest available professionals with safety disclosures." },
  { id: "step-8", title: "8. Post-Service Review & Dynamic Rating", desc: "Complete service, submit 5-star review + text, and demonstrate the professional's aggregate rating recalculating live." },
  { id: "step-9", title: "9. Offline Resilience & Stakeholder Feedback", desc: "Demonstrate offline banner indicator and review the Prototype Testing stakeholder evaluation metrics." }
];

function initDemoScriptModal() {
  const container = document.getElementById("faculty-checklist-container");
  const openBtn = document.getElementById("btn-open-demo-panel");
  const resetDataBtn = document.getElementById("btn-reload-seed-data");
  const clearChecklistBtn = document.getElementById("btn-clear-checklist");

  openBtn?.addEventListener("click", () => {
    renderFacultyChecklist();
    openModal("demo-script-modal");
  });

  document.querySelectorAll(".btn-close-demo-modal").forEach((btn) => {
    btn.addEventListener("click", () => closeModal("demo-script-modal"));
  });

  function getCompletedSteps() {
    try {
      const raw = localStorage.getItem("bc_demo_checklist_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCompletedSteps(ids) {
    try {
      localStorage.setItem("bc_demo_checklist_v1", JSON.stringify(ids));
    } catch (err) {
      console.warn("Could not save demo checklist", err);
    }
  }

  function renderFacultyChecklist() {
    if (!container) return;
    const completed = getCompletedSteps();

    container.innerHTML = FACULTY_DEMO_STEPS.map((step) => {
      const isDone = completed.includes(step.id);
      return `
        <div class="demo-script-item ${isDone ? 'is-done' : ''}" data-step-id="${step.id}" tabindex="0" role="checkbox" aria-checked="${isDone}">
          <input type="checkbox" ${isDone ? 'checked' : ''} tabindex="-1" aria-hidden="true" style="margin-top: 3px; accent-color: var(--accent-teal); cursor: pointer;">
          <div>
            <strong style="display: block; font-size: 13px; color: var(--primary);">${step.title}</strong>
            <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">${step.desc}</p>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".demo-script-item").forEach((item) => {
      const toggle = () => {
        const stepId = item.getAttribute("data-step-id");
        let list = getCompletedSteps();
        if (list.includes(stepId)) {
          list = list.filter((id) => id !== stepId);
        } else {
          list.push(stepId);
        }
        saveCompletedSteps(list);
        renderFacultyChecklist();
      };

      item.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          toggle();
        } else {
          toggle();
        }
      });

      item.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  clearChecklistBtn?.addEventListener("click", () => {
    localStorage.removeItem("bc_demo_checklist_v1");
    renderFacultyChecklist();
    showToast("Faculty demo checklist reset.", "info");
  });

  resetDataBtn?.addEventListener("click", async () => {
    if (!confirm("Reset all local professionals, bookings, presence, and testing feedback back to pristine baseline seed data?")) {
      return;
    }
    await dataService.resetToBaselineSeed();
    showToast("Clean baseline seed data restored!", "success");
    closeModal("demo-script-modal");
    
    // Refresh all views
    refreshProfessionalsAroundLocation();
    renderWorkerDashboard();
    renderMyBookingsView();
    renderTestingFeedbackSummary();
  });

  renderFacultyChecklist();
}

// ============================================================================
// 9. Application Initialization
// ============================================================================

function initApp() {
  // 1. Router setup
  window.addEventListener("hashchange", handleRoute);

  // 2. Role switch buttons
  document.getElementById("btn-role-customer")?.addEventListener("click", () => setRole("customer"));
  document.getElementById("btn-role-pro")?.addEventListener("click", () => setRole("professional"));
  document.getElementById("quick-enter-customer")?.addEventListener("click", () => setRole("customer"));
  document.getElementById("quick-enter-pro")?.addEventListener("click", () => setRole("professional"));

  // 3. Mobile menu handlers
  document.getElementById("mobile-menu-open-btn")?.addEventListener("click", openMobileDrawer);
  document.getElementById("mobile-menu-close-btn")?.addEventListener("click", closeMobileDrawer);
  document.getElementById("drawer-backdrop")?.addEventListener("click", closeMobileDrawer);

  // 4. Modal demo triggers
  document.getElementById("btn-demo-modal")?.addEventListener("click", () => openModal("demo-modal"));
  document.getElementById("btn-close-modal")?.addEventListener("click", () => closeModal("demo-modal"));
  document.getElementById("btn-confirm-modal")?.addEventListener("click", () => closeModal("demo-modal"));

  // 5. Toast demo trigger
  document.getElementById("btn-demo-toast")?.addEventListener("click", () => {
    showToast("Live state active! Proximity and Leaflet maps synchronized.", "success");
  });

  // 6. Geolocation & Autocomplete
  document.getElementById("btn-use-geolocation")?.addEventListener("click", handleGeolocationRequest);
  setupNominatimAutocomplete();

  // 7. Filters & Discovery listeners
  setupFilterListeners();

  // 7b. Prototype Testing & Faculty Demo Modal
  initTestingPage();
  initDemoScriptModal();

  // 8. Worker workstation simulation buttons
  let workerOnline = true;
  document.getElementById("btn-toggle-availability")?.addEventListener("click", async () => {
    workerOnline = !workerOnline;
    await dataService.updatePresence("pro_demo_1", workerOnline);
    updateWorkerPresenceBadge(workerOnline);
    refreshProfessionalsAroundLocation();
    showToast(`Worker presence: ${workerOnline ? "Online" : "Offline"}`, workerOnline ? "success" : "warning");
  });

  document.getElementById("btn-simulate-job")?.addEventListener("click", async () => {
    const mockBooking = {
      id: "bk_" + Date.now(),
      customerName: "Sneha Nair (Demo PG Resident)",
      category: "electrician",
      issueDescription: "Main circuit breaker trip in room 204",
      isEmergency: true,
      status: "pending",
      estimatedPrice: { visitingFee: 99, estimatedTotal: 399 }
    };
    await dataService.saveBooking(mockBooking);
    showToast("Incoming emergency request simulated & synced!", "warning");
  });

  // 9. Load location & initial listing
  initUserLocation();

  // 10. Route to initial view
  if (!window.location.hash) {
    window.location.hash = "#home";
  } else {
    handleRoute();
  }

  // 10. Notification Center & Offline Banner Setup
  const notifBellBtn = document.getElementById("notif-bell-btn");
  const notifPopover = document.getElementById("notif-popover");
  const notifBadge = document.getElementById("notif-badge-count");
  const notifList = document.getElementById("notif-list-container");
  const btnMarkAllRead = document.getElementById("btn-mark-all-read");

  function updateNotificationUI() {
    const notifs = dataService.getNotifications();
    const unreadCount = notifs.filter((n) => !n.isRead).length;

    if (notifBadge) {
      if (unreadCount > 0) {
        notifBadge.textContent = unreadCount > 9 ? "9+" : unreadCount;
        notifBadge.style.display = "flex";
      } else {
        notifBadge.style.display = "none";
      }
    }

    if (notifList) {
      if (notifs.length === 0) {
        notifList.innerHTML = `
          <div style="padding: var(--space-4); text-align: center; color: var(--text-subtle); font-size: 12px;">
            No notifications yet.
          </div>
        `;
      } else {
        notifList.innerHTML = notifs.map((n) => `
          <div class="notif-item ${!n.isRead ? "is-unread" : ""}" data-booking-id="${n.bookingId || ""}" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
              <strong style="color: var(--text-main); font-size: 12px;">${n.title || n.message}</strong>
              <span style="font-size: 10px; color: var(--text-subtle); white-space: nowrap;">
                ${n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
              </span>
            </div>
            ${n.reference ? `<span style="font-family: monospace; font-size: 10px; color: var(--accent-teal); font-weight: 700;">${n.reference}</span>` : ""}
            ${n.details ? `<div style="font-size: 11px; color: var(--text-muted);">${n.details}</div>` : ""}
          </div>
        `).join("");

        notifList.querySelectorAll(".notif-item").forEach((item) => {
          item.addEventListener("click", () => {
            const bId = item.getAttribute("data-booking-id");
            if (bId) {
              notifPopover?.classList.remove("is-open");
              openBookingStatusTracking(bId);
            }
          });
        });
      }
    }
  }

  notifBellBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = notifPopover?.classList.toggle("is-open");
    notifBellBtn.setAttribute("aria-expanded", String(isOpen));
  });

  btnMarkAllRead?.addEventListener("click", async () => {
    await dataService.markNotificationsRead();
    updateNotificationUI();
    showToast("All notifications marked as read.", "info");
  });

  document.addEventListener("click", (e) => {
    if (!notifPopover?.contains(e.target) && !notifBellBtn?.contains(e.target)) {
      notifPopover?.classList.remove("is-open");
      notifBellBtn?.setAttribute("aria-expanded", "false");
    }
  });

  // Offline Connection Banner Wiring
  const offlineBanner = document.getElementById("offline-connection-banner");
  const btnRetryConnection = document.getElementById("btn-retry-connection");

  function handleOnlineStatus() {
    if (typeof navigator !== "undefined" && typeof navigator.onLine !== "undefined" && !navigator.onLine) {
      offlineBanner?.classList.add("is-visible");
    } else {
      offlineBanner?.classList.remove("is-visible");
    }
  }

  window.addEventListener("online", handleOnlineStatus);
  window.addEventListener("offline", handleOnlineStatus);
  handleOnlineStatus();

  btnRetryConnection?.addEventListener("click", () => {
    if (navigator.onLine) {
      offlineBanner?.classList.remove("is-visible");
      showToast("Connection restored! Live synchronization active.", "success");
    } else {
      showToast("Still offline. Please check your network connection.", "warning");
    }
  });

  // Initial notification render
  updateNotificationUI();

  // Real-time listener for bookings, notifications & worker dashboard sync
  store.subscribe((latestState) => {
    updateNotificationUI();
    if (latestState.activeView === "bookings") {
      renderMyBookingsView();
    } else if (latestState.activeView === "dashboard") {
      renderWorkerDashboard();
    }
  });

  // 11. Public helpers for tests or inline events
  window.blueCollarApp = {
    setRole,
    saveUserLocation,
    filterState,
    applyFiltersAndRender,
    handleGeolocationRequest,
    bookingWizard,
    openProfessionalProfile,
    renderMyBookingsView,
    renderWorkerDashboard,
    openBookingStatusTracking,
    openReviewModal,
    openEmergencyBookingFlow,
    getSavedPros,
    isProSaved,
    toggleSavePro,
    async handleProfileSave() {
      const pro = store.getState().currentProfessional;
      if (!pro) return;
      const name = document.getElementById("pro-edit-name")?.value.trim();
      const category = document.getElementById("pro-edit-category")?.value;
      const exp = parseInt(document.getElementById("pro-edit-exp")?.value, 10);
      const fee = parseInt(document.getElementById("pro-edit-fee")?.value, 10);
      const area = document.getElementById("pro-edit-area")?.value.trim();
      const skills = document.getElementById("pro-edit-skills")?.value.split(",").map((s) => s.trim()).filter(Boolean);
      const bio = document.getElementById("pro-edit-bio")?.value.trim();

      Object.assign(pro, { name, category, experienceYears: exp, visitingFee: fee, areaName: area, skills, bio });
      await dataService.updatePresence(pro.id, pro);
      store.setState({ currentProfessional: pro });
      renderWorkerDashboard();
      refreshProfessionalsAroundLocation();
      showToast("Profile details updated & broadcasted live!", "success");
    },
    async handleNewProRegister() {
      const name = document.getElementById("reg-pro-name")?.value.trim();
      const category = document.getElementById("reg-pro-category")?.value;
      const fee = parseInt(document.getElementById("reg-pro-fee")?.value, 10);
      const skills = document.getElementById("reg-pro-skills")?.value.split(",").map((s) => s.trim()).filter(Boolean);
      const area = document.getElementById("reg-pro-area")?.value.trim();
      const bio = document.getElementById("reg-pro-bio")?.value.trim();

      const newPro = {
        id: "pro_" + Date.now(),
        name,
        category,
        categoryLabel: category.replace("_", " "),
        label: "Demo professional",
        skills: skills && skills.length > 0 ? skills : ["General Repair"],
        experienceYears: 5,
        rating: 5.0,
        reviewCount: 0,
        isAvailable: true,
        presenceStatus: "available",
        isEmergencyEligible: true,
        visitingFee: fee || 99,
        baseRatePerHour: (fee || 99) * 2,
        verificationBadge: "Demo Verified",
        phoneMasked: "+91 99000 •••••",
        areaName: area || "Bengaluru",
        coordinates: {
          lat: Number((userLocation.lat + 0.008).toFixed(5)),
          lng: Number((userLocation.lng + 0.008).toFixed(5))
        },
        bio: bio || "Licensed and experienced independent technician.",
        lastSeen: Date.now()
      };

      const allPros = store.getState().professionals || [];
      allPros.unshift(newPro);
      await dataService.updatePresence(newPro.id, newPro);
      store.setState({ professionals: allPros, currentProfessional: newPro });

      closeModal("register-pro-modal");
      document.getElementById("register-pro-form")?.reset();
      showToast(`Welcome ${name}! You are now live in customer searches and on the map.`, "success", 4000);
      renderWorkerDashboard();
      refreshProfessionalsAroundLocation();
    },
    handleContactSubmit() {
      showToast("Thank you! Feedback recorded for the academic project.", "success");
      document.getElementById("contact-form")?.reset();
    },
    renderTestingFeedbackSummary,
    initTestingPage,
    resetToBaselineSeed: () => dataService.resetToBaselineSeed()
  };

  console.info("Blue Collar Chunk 2-5 initialized successfully.");
}

// Boot application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
