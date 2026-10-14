# Blue Collar — Local Service Finder
### A Design Thinking College Prototype Connecting Residents & Local Tradespeople

> **Live Demo & Prototype Submission**  
> **Course / Context:** Design Thinking & Human-Centered Software Systems  
> **Target Audience:** Apartment residents, college students, PG tenants, city newcomers, and local blue-collar professionals (electricians, plumbers, carpenters, mechanics, appliance technicians).

---

## 1. Executive Summary & Design Thinking Context

Finding reliable, vetted local technicians during unexpected breakdowns (plumbing leaks, circuit trips, appliance failures) is notoriously frustrating for newcomers, PG tenants, and families. Mainstream aggregator apps often introduce heavy markups, hidden inspection fees, rigid scheduling, and high commissions that squeeze independent workers. 

**Blue Collar** was designed following the five stages of Design Thinking:
1. **Empathize:** Surveyed students and apartment tenants struggling with emergency repairs; interviewed neighborhood technicians who lose 20–30% of income to aggregator platforms.
2. **Define:** Formulated the core problem statement: *"How might we connect neighborhood residents with verified, nearby tradespeople transparently, with upfront price estimates and real-time dispatch, without imposing extractive commission models?"*
3. **Ideate:** Conceived a lightweight, hyper-local discovery platform utilizing device GPS, Haversine proximity calculations, transparent cost breakdowns, and live peer-to-peer or cloud status tracking.
4. **Prototype:** Developed this responsive, zero-build web prototype supporting both Customer and Professional workflows, emergency fast-tracking, and live multi-tab dispatch.
5. **Test:** Implemented a built-in stakeholder evaluation suite (`#testing`) to collect quantitative metrics on discovery ease, profile clarity, pricing transparency, booking flow, and user trust.

---

## 2. Core Features & Capabilities

- **Hyper-Local Discovery & Real Geolocation:**
  - One-click browser Geolocation (`navigator.geolocation.getCurrentPosition`).
  - OpenStreetMap (OSM) Nominatim reverse geocoding with typed-address debounced autocomplete.
  - Mathematical Haversine geodesic distance calculation and estimated travel time (ETA) based on local traffic models.
  - Interactive Leaflet map displaying real worker coordinates, custom color-coded category markers, and live presence indicators.

- **Dual-Role Experience (Customer & Professional Workstation):**
  - Instant role switcher in header and quick-enter demo bar.
  - **Customer View:** Category discovery cards, keyword search with 300ms debounce, advanced filters (trade, distance, minimum rating, maximum fee), saved technicians bookmarks, and interactive profile viewer.
  - **Professional Workstation:** Live job overview statistics, availability toggle (Available / Busy / Offline) with 30s heartbeat presence, live incoming request alerts with Accept/Decline, step-by-step job transition workflow, optional live GPS location sharing, and live profile editor.

- **Transparent 8-Step Booking Wizard:**
  - Strict step validation (Service &rarr; Problem Specification &rarr; Address & Landmark &rarr; Slot Scheduling &rarr; Technician Selection &rarr; Cost Estimate &rarr; Summary &rarr; Live Confirmation).
  - Current-time slot validation (prevents past dates or times).
  - Explicit cost breakdown: visiting fee + estimated labour + optional materials, with explicit academic disclosure that final work scope is subject to on-site agreement.
  - Standardized booking reference generator (`BC-YYYYMMDD-XXXX`).

- **Real-Time Dispatch & Tracking:**
  - Multi-tab synchronization: Worker acceptance and status transitions (`Accepted` &rarr; `On the Way` &rarr; `Arrived` &rarr; `Work in Progress` &rarr; `Completed`) update the customer's tracking timeline in real time.
  - Live worker location sharing: When enabled by the technician while "On the Way", the customer map renders live GPS updates, remaining distance, and dynamic arrival ETA.

- **Emergency SOS Fast-Track:**
  - Prominent red Emergency Service action in hero and header.
  - Auto-filters exclusively for technicians currently **Online / Available** and nearest first.
  - Includes mandatory academic safety disclosure (not a replacement for police/fire/ambulance services).

- **Post-Service Reviews & Ratings:**
  - Multi-star and written review submission modal triggered upon job completion.
  - Stored live with dynamic recalculation of the technician's aggregate rating and review count.

- **In-App Notification Center:**
  - Centralized notification bell popover with unread counter badge.
  - Auto-generates in-app notifications on booking creation, worker acceptance, status transitions, and customer reviews.

- **Design System & Accessibility (WCAG AA):**
  - Curated light theme: Deep Slate Navy (`#0F172A`), Energetic Teal (`#0D9488`), Crisp White (`#FFFFFF`), and Warm Amber accents.
  - Fully responsive across 360px mobile, 768px tablet, and 1280px desktop viewports with 0 horizontal overflow.
  - Accessible modal dialogs with keyboard focus trapping (`Tab` / `Shift+Tab`) and focus restoration on dismiss.
  - Screen-reader friendly semantic landmarks (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`), `aria-live` status regions, and high-contrast color ratios.

- **Prototype Stakeholder Testing & Evaluation (`#testing`):**
  - Real-time rating form capturing 5 key metrics: Discovery Ease, Profile Clarity, Price Transparency, Booking Wizard Usability, and Trust Perception.
  - Aggregates average scores, displays animated percentage bars, and renders recent stakeholder feedback with ISO timestamps.

- **Faculty Demo Mode & One-Click Baseline Reset:**
  - Quick-access Faculty Demo Panel modal with an interactive presentation checklist.
  - One-click clean baseline reset that restores pristine seed professionals, bookings, presence, and test responses.

---

## 3. Technology Stack & Architecture

- **Architecture:** Zero-build, standard ES6+ Modules (`import` / `export`), Vanilla HTML5, and Vanilla CSS3 design tokens.
- **Data Service Layer (`js/state.js`):** Unified reactive store with pub/sub architecture supporting two interchangeable backends:
  1. `LocalStorageAdapter`: Uses browser `localStorage` + `BroadcastChannel("blue_collar_sync")` for instantaneous, multi-tab real-time communication without requiring external cloud setup.
  2. `FirestoreAdapter`: Connects to Google Cloud Firestore (v9 modular web SDK) for live cross-device cloud synchronization (`onSnapshot`).
- **Mapping:** Leaflet.js (v1.9.4) + OpenStreetMap tile layers.
- **Geocoding:** OpenStreetMap Nominatim Search & Reverse Geocode API.

---

## 4. Getting Started & Setup Instructions

### Option A: Local Real-Time Mode (Recommended & Zero Configuration)
By default, the application runs in local mode using `LocalStorageAdapter` and `BroadcastChannel`. You can run it on any static HTTP server with zero dependencies or build steps:

1. Open your terminal in the project directory:
   ```bash
   cd "/home/hitesh-chikhle/Ramya's Project"
   ```
2. Start Python's built-in HTTP server:
   ```bash
   python3 -m http.server 8080
   ```
   *(Alternatively, use `npx serve -l 8080` or Node `http-server`)*.
3. Open two browser windows side by side:
   - Window 1 (Customer): [http://localhost:8080/#home](http://localhost:8080/#home)
   - Window 2 (Professional): [http://localhost:8080/#dashboard](http://localhost:8080/#dashboard)
4. Notice the header indicator: **"Live sync: on (local)"**. Any action taken in one window (changing worker availability, accepting a booking, advancing status) immediately reflects in the other window!

---

### Option B: Cloud Firestore Real-Time Mode (Optional)
If you wish to test live cloud synchronization across multiple separate physical devices (e.g. your laptop and your mobile phone):

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a free project (e.g., `blue-collar-prototype`).
2. Under **Build**, select **Firestore Database** &rarr; click **Create Database**.
3. Choose **Start in test mode** (allows read/write during prototype evaluation) and select your closest cloud region.
4. Under **Project Settings** (gear icon) &rarr; **General** &rarr; **Your apps**, click the Web icon (`</>`) to register a web app.
5. Copy your Firebase configuration object into [js/config.js](file:///home/hitesh-chikhle/Ramya's%20Project/js/config.js):
   ```javascript
   export const FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "blue-collar-prototype.firebaseapp.com",
     projectId: "blue-collar-prototype",
     storageBucket: "blue-collar-prototype.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
6. Set `USE_FIRESTORE = true` in `js/config.js`:
   ```javascript
   export const USE_FIRESTORE = true;
   ```
7. Reload the page. The sync badge will update to **"Live sync: on (cloud)"**.

---

## 5. Walkthrough Guide for Both Roles

### 🧑 Customer Walkthrough (Resident / Student / Tenant)
1. **Find Help:** On the Homepage (`#home`), click **"Use my current location"** or type an address in the search box.
2. **Browse Tradespeople:** Click on a category card (e.g. **Electrician**) to jump to `#services`.
3. **Filter & Sort:** Use the filter toolbar to sort by nearest distance or filter by "Available Now Only". Note the distance badge and live ETA calculated via Haversine geodesic math.
4. **Inspect Profile:** Click **"View Profile"** to view credentials, pricing list, service area radius on the map, reviews, and demo verification.
5. **Book Service:** Click **"Book Service"** to launch the 8-step wizard:
   - Step 1: Confirm category.
   - Step 2: Choose preset problem (e.g. "Circuit breaker tripping / MCB failure") or enter custom text.
   - Step 3: Confirm address, flat/door number, and landmark.
   - Step 4: Pick "Immediate" or schedule a verified future date & time slot.
   - Step 5: Choose your preferred technician.
   - Step 6: Review upfront transparent pricing estimate.
   - Step 7: Inspect booking summary.
   - Step 8: Confirm and receive a unique reference ID (e.g., `BC-20261015-8491`).
6. **Track Status:** Open `#bookings` &rarr; click **"Track Status"** to view the live status progress bar and real-time technician map.
7. **Review:** When the job is marked completed, rate the technician and leave feedback.

### 🔧 Professional Walkthrough (Worker Workstation)
1. **Switch Role:** Click the **"Professional"** toggle in the header or click **"Quick-Enter Professional"**.
2. **Workstation Overview (`#dashboard`):** Review metrics (New Requests, Today's Jobs, Completed Jobs, Demo Earnings).
3. **Toggle Availability:** Switch your presence between **Available**, **Busy**, or **Offline**. Note that status changes sync immediately with customer listings.
4. **Manage Incoming Jobs:** When a new booking is submitted, it appears under "Live Incoming Requests". Click **"Accept Job"** or **"Decline"**.
5. **Progressive Job Transitions:** Advance the job through valid states:
   - `Accepted` &rarr; `On the Way` (prompts for optional live GPS location sharing).
   - `On the Way` &rarr; `Arrived`.
   - `Arrived` &rarr; `Work in Progress`.
   - `Work in Progress` &rarr; `Completed`.
6. **Live Profile Editor:** Modify your name, visiting fee, trade, and skills; changes immediately broadcast to customer searches.

---

## 6. Faculty Presentation Script & Demo Checklist

Use the built-in **Faculty Demo Script Panel** (click the **"Faculty Demo Panel"** button in the header demo bar) or follow this presentation flow:

| Step | Narrative & Focus Area | Actions to Demonstrate |
| :--- | :--- | :--- |
| **1** | **Problem Framing & Empathy** | Introduce student/tenant pain points with opaque aggregator commissions and explain the Design Thinking objective. |
| **2** | **Real Geolocation & Proximity** | Click "Use current location" on `#home`. Show OSM reverse geocoding resolving actual street addresses and Haversine distance calculations. |
| **3** | **Interactive Map & Live Filters** | Navigate to `#services`. Demonstrate category filtering, maximum visiting fee, and live Leaflet pins updating dynamically. |
| **4** | **8-Step Booking Wizard** | Click "Book Now" on a technician. Show current-time slot validation (no past slots permitted) and the itemized price breakdown. |
| **5** | **Multi-Tab Worker Dispatch** | Open two browser windows side-by-side. In Window 2 (Professional), accept the booking. Show Window 1 (Customer) updating instantaneously without page reload. |
| **6** | **Live Tracking & Location Sharing** | In Worker window, transition to "On the Way" and enable GPS sharing. Show Customer window tracking timeline updating with live worker marker and ETA. |
| **7** | **Emergency SOS Fast-Track** | Click the red "Emergency" button in the hero. Show immediate filtering for nearest online professionals with safety notices. |
| **8** | **Review & Rating Recalculation** | Complete the service. Submit a 5-star review from Customer window. Show the technician's aggregate rating and review count recalculating live. |
| **9** | **Stakeholder Evaluation Suite** | Navigate to `#testing`. Submit an evaluation across the 5 Design Thinking metrics and observe the real-time analytics summary bars. |

---

## 7. Academic Transparency: Real vs. Simulated Analysis

In accordance with academic research standards, the following table explicitly documents what functionality is production-ready/real vs. what is simulated for prototype demonstration:

| System Component | Implementation Type | Technical Realization |
| :--- | :--- | :--- |
| **Real-Time Multi-Tab Sync** | **REAL** | `BroadcastChannel` API + `localStorage` pub/sub events. |
| **Cloud Real-Time Sync** | **REAL** | Google Firebase Firestore modular v9 `onSnapshot` listeners. |
| **GPS Geolocation** | **REAL** | Browser W3C `navigator.geolocation.getCurrentPosition` & `watchPosition`. |
| **Address Geocoding** | **REAL** | Live OpenStreetMap Nominatim REST API with reverse coordinates. |
| **Proximity Math** | **REAL** | Spherical Haversine trigonometric formula calculating real geodesic km distance. |
| **Interactive Map** | **REAL** | Leaflet.js with live OpenStreetMap tiles, custom SVG markers, and bounds fitting. |
| **Clock Slot Validation** | **REAL** | Strict JavaScript `Date` comparison preventing any past dates or elapsed hours. |
| **Worker Heartbeat Presence**| **REAL** | 30-second heartbeat timestamp tracking (`lastSeen`); stale presence marks offline. |
| **Rating Recalculation** | **REAL** | Live mathematical formula `((oldRating * oldCount) + newRating) / (oldCount + 1)`. |
| **Stakeholder Evaluation** | **REAL** | ISO timestamped metrics, average calculations, and live percentage bar rendering. |
| **SMS / WhatsApp Alerts** | **SIMULATED** | Rendered via in-app notification center popover and toasts (no Twilio API billed). |
| **Payment Gateway** | **SIMULATED** | Transparent estimate displayed; payment collected on-site or simulated via cash/UPI. |
| **Identity Verification** | **SIMULATED** | "Demo Verified" badge shown for academic illustration (no live Aadhaar/Govt KYC). |
| **Phone Number Privacy** | **SIMULATED** | Masked format `+91 98000 •••••` to illustrate tele-masking concepts. |

---

## 8. Future Production Roadmap

If transitioning this Design Thinking prototype to a commercial production platform, the following architectural milestones would be executed:

1. **Backend Microservices Architecture:**
   - Migrate client-side data service to Node.js/Go backend services running behind an API gateway with Redis distributed caching.
   - Implement PostgreSQL with PostGIS extension for spatial queries (e.g. `ST_DWithin` spatial indexing for millisecond radius queries).
2. **Worker KYC & Police Verification:**
   - Integrate Digilocker / Aadhaar XML verification and government trade certification databases to authenticate technicians before listing.
3. **Escrow Payment Infrastructure:**
   - Integrate Razorpay / Stripe UPI escrow.
   - The customer's card/UPI is pre-authorized on booking; payment is held in escrow and released to the worker's bank account only upon mutual customer completion OTP verification.
4. **Omnichannel Communication:**
   - Integrate Twilio / WhatsApp Business Cloud API for automated dispatch alerts and live customer-technician proxy number calling (tele-masking).
   - Integrate Firebase Cloud Messaging (FCM) for mobile push notifications.
5. **AI Matching & Surge Dispatch:**
   - Machine learning dispatch model factoring in worker traffic patterns, past customer satisfaction scores, cancellation rates, and multi-job batching.

---

## 9. File Structure

```
Ramya's Project/
├── index.html              # Main application shell with semantic views & accessible modals
├── README.md               # Complete project documentation & faculty guide
├── css/
│   ├── base.css            # CSS reset, typography, and global layout
│   ├── variables.css       # Design tokens (colors, spacing, shadows, radius, transitions)
│   ├── components.css      # Buttons, cards, badges, modals, toasts, progress bars, score pills
│   └── layout.css          # View panels, grids, and responsive media queries (360/768/1280px)
├── js/
│   ├── config.js           # Configuration flag (LocalStorage vs. Firestore toggle)
│   ├── state.js            # Central reactive store, seeding, and dual-adapter data service
│   ├── data.js             # Seed professionals (10 realistic fictional records with coordinates)
│   ├── map.js              # Leaflet MapController, Haversine proximity math, Nominatim geocoder
│   ├── ui.js               # Toast system, accessible modal focus trapping, SVG icons
│   ├── booking.js          # 8-step booking wizard, status tracking, bookmarks, reviews
│   ├── worker.js           # Professional dashboard workstation, presence heartbeats, dispatch
│   └── app.js              # Application orchestrator, router, debounced search, demo controls
└── scratch/
    └── test_chunk6.mjs     # Automated headless Chrome test suite verifying all Chunk 6 deliverables
```

---

## 10. Automated Test Verification Summary

To execute the automated regression test suite:
```bash
node scratch/test_chunk6.mjs
```
**Test Results (Verified October 2026):**
- [x] **Mobile 360px Viewport:** Zero horizontal scroll / overflow passed.
- [x] **Tablet 768px Viewport:** Zero horizontal scroll / overflow passed.
- [x] **Desktop 1280px Viewport:** Zero horizontal scroll / overflow passed.
- [x] **Prototype Testing View:** Evaluation submission, aggregate score calculation, and dynamic rendering passed.
- [x] **Faculty Demo Modal:** Interactive checklist persistence and clean baseline reset passed.
- [x] **Search Performance:** 300ms debounce verified with zero refilter thrashing.
- [x] **Console Audit:** 0 uncaught errors or exceptions encountered.
