/**
 * Blue Collar — Map, Geolocation & Haversine Distance Engine
 * Powered by OpenStreetMap, Leaflet.js, and Nominatim API (debounced).
 */

import { APP_CONFIG } from './config.js';

// ============================================================================
// 1. Haversine Distance & Arrival Estimators
// ============================================================================

export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Number(distance.toFixed(1));
}

export function calculateEstimatedEta(distanceKm) {
  // Realistic city transit estimate: 5 min preparation + ~3.5 min/km in urban traffic
  const baseMinutes = Math.max(12, Math.round(5 + distanceKm * 3.5));
  return `Est. ${baseMinutes}–${baseMinutes + 8} mins`;
}

// ============================================================================
// 2. Geolocation with Graceful Permission Denied Handling
// ============================================================================

export function requestBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: "Geolocation is not supported by your browser.",
        coords: APP_CONFIG.defaultLocation
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          success: true,
          coords: {
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            address: "Current Geolocation Detected"
          }
        });
      },
      (err) => {
        let errorMsg = "Unable to retrieve your location.";
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = "Location permission denied. Defaulting to city center.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = "Location information is unavailable.";
        } else if (err.code === err.TIMEOUT) {
          errorMsg = "Location request timed out.";
        }

        resolve({
          success: false,
          error: errorMsg,
          coords: APP_CONFIG.defaultLocation
        });
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}

// ============================================================================
// 3. Nominatim Reverse Geocoding & Address Suggestions (Debounced)
// ============================================================================

const geocodeCache = new Map();

export async function reverseGeocode(lat, lng) {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" }
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    
    // Pick the most meaningful short address (neighborhood / suburb / road / city)
    const addr = data.address || {};
    const shortAddress = [
      addr.suburb || addr.neighbourhood || addr.residential || addr.road,
      addr.city || addr.town || addr.county,
      addr.state
    ].filter(Boolean).join(", ") || data.display_name;

    geocodeCache.set(cacheKey, shortAddress);
    return shortAddress;
  } catch (err) {
    console.warn("Reverse geocode error:", err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

let searchDebounceTimer = null;
export function searchAddressNominatim(query, callback) {
  clearTimeout(searchDebounceTimer);
  if (!query || query.trim().length < 3) {
    callback([]);
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    try {
      const encoded = encodeURIComponent(query.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encoded}&countrycodes=in&limit=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" }
      });
      if (!res.ok) throw new Error("Search geocode failed");
      const results = await res.json();
      
      const suggestions = results.map((item) => ({
        displayName: item.display_name,
        shortName: item.name || item.display_name.split(",")[0],
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      callback(suggestions);
    } catch (err) {
      console.warn("Address search error:", err);
      callback([]);
    }
  }, 450); // 450ms debounce
}

// ============================================================================
// 4. Leaflet Map Manager with Interactive Markers
// ============================================================================

export class MapController {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.userMarker = null;
    this.proMarkers = new Map();
    this.onSelectProfessional = null;
  }

  init(centerCoords, zoom = 13, onSelectProfessional = null) {
    if (this.map) return;
    const container = document.getElementById(this.containerId);
    if (!container || !window.L) return;

    this.onSelectProfessional = onSelectProfessional;

    this.map = window.L.map(this.containerId, {
      center: [centerCoords.lat, centerCoords.lng],
      zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Clean OpenStreetMap tiles
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.updateUserMarker(centerCoords);
  }

  updateUserMarker(coords) {
    if (!this.map || !window.L) return;

    if (this.userMarker) {
      this.userMarker.setLatLng([coords.lat, coords.lng]);
    } else {
      const userHtml = `
        <div class="user-map-pin" title="Your Location">
          <div class="user-map-pulse"></div>
          <div class="user-map-core"></div>
        </div>
      `;
      const icon = window.L.divIcon({
        className: "custom-leaflet-div-icon",
        html: userHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      this.userMarker = window.L.marker([coords.lat, coords.lng], { icon })
        .addTo(this.map)
        .bindPopup("<strong>Your Selected Location</strong><br><span style='font-size: 12px; color: #475569;'>" + (coords.address || "") + "</span>");
    }

    this.map.panTo([coords.lat, coords.lng]);
  }

  renderProfessionals(professionals, activeProId = null) {
    if (!this.map || !window.L) return;

    // Clear previous pro markers
    this.proMarkers.forEach((marker) => marker.remove());
    this.proMarkers.clear();

    professionals.forEach((pro) => {
      if (!pro.coordinates) return;

      const isOnline = pro.isAvailable !== false;
      const markerHtml = `
        <div class="pro-map-pin ${isOnline ? 'is-available' : 'is-offline'} ${pro.id === activeProId ? 'is-active' : ''}" data-marker-id="${pro.id}">
          <span class="pro-map-pin-price">₹${pro.visitingFee}</span>
        </div>
      `;

      const icon = window.L.divIcon({
        className: "custom-leaflet-div-icon",
        html: markerHtml,
        iconSize: [44, 28],
        iconAnchor: [22, 28]
      });

      const marker = window.L.marker([pro.coordinates.lat, pro.coordinates.lng], { icon })
        .addTo(this.map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
            <div style="font-weight: 600; color: #0F172A; margin-bottom: 2px;">${pro.name}</div>
            <div style="font-size: 11px; color: #0D9488; font-weight: 600; text-transform: uppercase;">${pro.categoryLabel || pro.category}</div>
            <div style="font-size: 12px; color: #475569; margin: 4px 0;">★ ${pro.rating} • ${pro.distanceKm ? pro.distanceKm + ' km away' : ''}</div>
            <div style="font-size: 11px; color: #64748B;">Visiting Fee: ₹${pro.visitingFee} (Demo Est.)</div>
          </div>
        `);

      marker.on("click", () => {
        if (this.onSelectProfessional) {
          this.onSelectProfessional(pro.id);
        }
      });

      this.proMarkers.set(pro.id, marker);
    });
  }

  highlightPro(proId) {
    if (!this.map) return;
    const marker = this.proMarkers.get(proId);
    if (marker) {
      this.map.panTo(marker.getLatLng(), { animate: true });
      marker.openPopup();
    }
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }
}
