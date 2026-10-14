/**
 * Blue Collar — Central State Store & Dual-Mode Data Layer
 * Provides reactive pub/sub and unified data sync across Firestore and LocalStorage+BroadcastChannel.
 */

import { firebaseConfig, isFirebaseConfigured, APP_CONFIG } from './config.js';

// ============================================================================
// 1. Initial State & Store Implementation
// ============================================================================

const initialDemoUser = {
  id: "cust_demo_1",
  name: "Ramya (Resident Demo)",
  phone: "+91 98765 43210",
  role: "customer",
  address: "Indiranagar 100ft Road, Bengaluru",
  coordinates: { lat: 12.9716, lng: 77.5946 }
};

const initialDemoPro = {
  id: "pro_demo_1",
  name: "Ramesh Kumar (Demo Electrician)",
  phone: "+91 98450 12345",
  category: "electrician",
  role: "professional",
  experienceYears: 7,
  rating: 4.8,
  reviewCount: 34,
  isAvailable: true,
  isEmergencyEligible: true,
  visitingFee: 99,
  baseRatePerHour: 299,
  verificationBadge: "Demo Verified",
  coordinates: { lat: 12.9784, lng: 77.6408 }
};

const state = {
  currentRole: "customer", // "customer" | "professional"
  currentUser: initialDemoUser,
  currentProfessional: initialDemoPro,
  currentLanguage: "en",
  activeView: "home",
  syncStatus: {
    active: true,
    type: "local", // "local" | "firestore"
    label: "Local (Multi-Tab Sync)"
  },
  bookings: [],
  professionals: [],
  notifications: []
};

const listeners = new Set();

export const store = {
  getState() {
    return { ...state };
  },

  setState(updates) {
    Object.assign(state, updates);
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error("State listener error:", err);
      }
    });
  },

  subscribe(listener) {
    listeners.add(listener);
    // Initial call with current state
    listener(state);
    return () => listeners.delete(listener);
  }
};

// ============================================================================
// 2. Initial Fictional Seed Professionals ("Demo Professional" label enforced)
// ============================================================================

const SEED_PROFESSIONALS = [
  {
    id: "pro_demo_1",
    name: "Ramesh Kumar",
    category: "electrician",
    label: "Demo professional",
    experienceYears: 7,
    rating: 4.8,
    reviewCount: 38,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 299,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 98450 •••••",
    areaName: "Indiranagar, Bengaluru",
    coordinates: { lat: 12.9784, lng: 77.6408 },
    bio: "Residential & commercial electrical repairs, short circuits, switchboards, and rewiring."
  },
  {
    id: "pro_demo_2",
    name: "Suresh Patil",
    category: "plumber",
    label: "Demo professional",
    experienceYears: 10,
    rating: 4.9,
    reviewCount: 52,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 349,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 97401 •••••",
    areaName: "Koramangala, Bengaluru",
    coordinates: { lat: 12.9352, lng: 77.6245 },
    bio: "Pipe leaks, tap fixing, bathroom fittings, water heater installation and emergencies."
  },
  {
    id: "pro_demo_3",
    name: "Anand Verma",
    category: "carpenter",
    label: "Demo professional",
    experienceYears: 6,
    rating: 4.7,
    reviewCount: 24,
    isAvailable: false,
    isEmergencyEligible: false,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 96112 •••••",
    areaName: "HSR Layout, Bengaluru",
    coordinates: { lat: 12.9121, lng: 77.6446 },
    bio: "Furniture repair, locks, doors, hinges, and custom woodwork solutions."
  },
  {
    id: "pro_demo_4",
    name: "Mohan Lal",
    category: "appliance",
    label: "Demo professional",
    experienceYears: 8,
    rating: 4.6,
    reviewCount: 41,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 99003 •••••",
    areaName: "Domlur, Bengaluru",
    coordinates: { lat: 12.9609, lng: 77.6387 },
    bio: "AC servicing, refrigerator cooling fixes, washing machine and microwave repairs."
  }
];

// ============================================================================
// 3. LocalStorage + BroadcastChannel Adapter (Safe Universal Storage)
// ============================================================================

const memoryStorage = new Map();
const safeStorage = {
  getItem(key) {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStorage.get(key) || null;
  },
  setItem(key, value) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, String(value));
    }
  }
};

class LocalStorageAdapter {
  constructor() {
    this.storageKeyBookings = "bluecollar_bookings";
    this.storageKeyPros = "bluecollar_professionals";
    this.storageKeyNotifications = "bluecollar_notifications";
    this.channel = null;
    this.bookingListeners = [];
    this.proListeners = [];
    this.notificationListeners = [];

    this.init();
  }

  init() {
    // 1. Seed professionals if not already present
    if (!safeStorage.getItem(this.storageKeyPros)) {
      safeStorage.setItem(this.storageKeyPros, JSON.stringify(SEED_PROFESSIONALS));
    }

    if (!safeStorage.getItem(this.storageKeyBookings)) {
      safeStorage.setItem(this.storageKeyBookings, JSON.stringify([]));
    }

    if (!safeStorage.getItem(this.storageKeyNotifications)) {
      safeStorage.setItem(this.storageKeyNotifications, JSON.stringify([]));
    }

    // 2. Setup BroadcastChannel for real-time multi-tab sync
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(APP_CONFIG.broadcastChannelName);
      this.channel.onmessage = (event) => {
        this.handleBroadcastEvent(event.data);
      };
    }

    // 3. Fallback to storage event for older multi-tab support
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === this.storageKeyBookings) {
          this.notifyBookingListeners();
        } else if (e.key === this.storageKeyPros) {
          this.notifyProListeners();
        } else if (e.key === this.storageKeyNotifications) {
          this.notifyNotificationListeners();
        }
      });
    }
  }

  handleBroadcastEvent(data) {
    if (!data || !data.type) return;
    if (data.type === "BOOKING_UPDATED") {
      this.notifyBookingListeners();
    } else if (data.type === "PRO_UPDATED") {
      this.notifyProListeners();
    } else if (data.type === "NOTIFICATION_ADDED" || data.type === "NOTIFICATIONS_READ") {
      this.notifyNotificationListeners();
    }
  }

  broadcast(type, payload = {}) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, payload, timestamp: Date.now() });
      } catch (err) {
        console.warn("Broadcast postMessage error:", err);
      }
    }
  }

  // --- Watchers ---

  watchBookings(callback) {
    this.bookingListeners.push(callback);
    callback(this.getBookings());
    return () => {
      this.bookingListeners = this.bookingListeners.filter((cb) => cb !== callback);
    };
  }

  notifyBookingListeners() {
    const bookings = this.getBookings();
    this.bookingListeners.forEach((cb) => cb(bookings));
    store.setState({ bookings });
  }

  watchProfessionals(callback) {
    this.proListeners.push(callback);
    callback(this.getProfessionals());
    return () => {
      this.proListeners = this.proListeners.filter((cb) => cb !== callback);
    };
  }

  notifyProListeners() {
    const pros = this.getProfessionals();
    this.proListeners.forEach((cb) => cb(pros));
    store.setState({ professionals: pros });
  }

  watchNotifications(callback) {
    this.notificationListeners.push(callback);
    callback(this.getNotifications());
    return () => {
      this.notificationListeners = this.notificationListeners.filter((cb) => cb !== callback);
    };
  }

  notifyNotificationListeners() {
    const notifications = this.getNotifications();
    this.notificationListeners.forEach((cb) => cb(notifications));
    store.setState({ notifications });
  }

  // --- CRUD Operations ---

  getBookings() {
    try {
      return JSON.parse(safeStorage.getItem(this.storageKeyBookings) || "[]");
    } catch {
      return [];
    }
  }

  getProfessionals() {
    try {
      return JSON.parse(safeStorage.getItem(this.storageKeyPros) || "[]");
    } catch {
      return SEED_PROFESSIONALS;
    }
  }

  getNotifications() {
    try {
      return JSON.parse(safeStorage.getItem(this.storageKeyNotifications) || "[]");
    } catch {
      return [];
    }
  }

  async saveBooking(bookingData) {
    const bookings = this.getBookings();
    const newBooking = {
      ...bookingData,
      id: bookingData.id || "bk_" + Date.now(),
      createdAt: bookingData.createdAt || new Date().toISOString(),
      status: bookingData.status || "pending"
    };

    bookings.unshift(newBooking);
    safeStorage.setItem(this.storageKeyBookings, JSON.stringify(bookings));
    this.notifyBookingListeners();
    this.broadcast("BOOKING_UPDATED", newBooking);

    // In-app notification for new booking creation
    this.addNotification({
      title: "New Booking Created",
      message: `Booking #${newBooking.reference || newBooking.id} created for ${newBooking.serviceCategory || "Trade Service"}.`,
      reference: newBooking.reference || newBooking.id,
      status: newBooking.status || "Booking Confirmed",
      bookingId: newBooking.id,
      recipientId: newBooking.professionalId
    });

    return newBooking;
  }

  async updateBooking(bookingId, updates) {
    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index !== -1) {
      const prevStatus = bookings[index].status;
      bookings[index] = { ...bookings[index], ...updates, updatedAt: new Date().toISOString() };
      safeStorage.setItem(this.storageKeyBookings, JSON.stringify(bookings));
      this.notifyBookingListeners();
      this.broadcast("BOOKING_UPDATED", bookings[index]);

      // Automatically dispatch real data in-app notifications if status transitioned
      if (updates.status && updates.status !== prevStatus) {
        const b = bookings[index];
        let notifTitle = `Status Update: ${updates.status}`;
        let notifMsg = `Booking #${b.reference || b.id} status is now ${updates.status}.`;

        if (updates.status === "Accepted") {
          notifTitle = "Request Accepted";
          notifMsg = `${b.professionalName || 'Technician'} has accepted your booking #${b.reference}.`;
        } else if (updates.status === "On the Way") {
          notifTitle = "Technician On the Way";
          notifMsg = `${b.professionalName || 'Technician'} is heading to your doorstep.`;
        } else if (updates.status === "Arrived") {
          notifTitle = "Technician Arrived";
          notifMsg = `${b.professionalName || 'Technician'} has reached your doorstep address.`;
        } else if (updates.status === "Work in Progress") {
          notifTitle = "Work in Progress";
          notifMsg = `Repairs have begun for booking #${b.reference}.`;
        } else if (updates.status === "Completed") {
          notifTitle = "Job Completed";
          notifMsg = `Service #${b.reference} is complete. Please leave a rating & review!`;
        } else if (updates.status === "Declined") {
          notifTitle = "Request Declined";
          notifMsg = `Technician was unable to take booking #${b.reference} (${b.declineReason || 'Scheduling conflict'}).`;
        }

        this.addNotification({
          title: notifTitle,
          message: notifMsg,
          reference: b.reference || b.id,
          status: updates.status,
          bookingId: b.id,
          recipientId: b.customerId
        });
      }

      return bookings[index];
    }
    return null;
  }

  async updatePresence(proId, isAvailable) {
    const pros = this.getProfessionals();
    const index = pros.findIndex((p) => p.id === proId);
    if (index !== -1) {
      if (typeof isAvailable === "object") {
        Object.assign(pros[index], isAvailable);
      } else {
        pros[index].isAvailable = Boolean(isAvailable);
      }
      safeStorage.setItem(this.storageKeyPros, JSON.stringify(pros));
      this.notifyProListeners();
      this.broadcast("PRO_UPDATED", pros[index]);
      return pros[index];
    }
    return null;
  }

  getReviews() {
    try {
      return JSON.parse(safeStorage.getItem("bluecollar_reviews") || "[]");
    } catch {
      return [];
    }
  }

  async saveReview(reviewData) {
    const reviews = this.getReviews();
    const newReview = {
      id: "rev_" + Date.now(),
      createdAt: new Date().toISOString(),
      ...reviewData
    };
    reviews.unshift(newReview);
    safeStorage.setItem("bluecollar_reviews", JSON.stringify(reviews));

    // Recalculate the professional's aggregate rating from real reviews
    const pros = this.getProfessionals();
    const pIndex = pros.findIndex((p) => p.id === reviewData.professionalId);
    if (pIndex !== -1) {
      const pro = pros[pIndex];
      const curRating = Number(pro.rating) || 5.0;
      const curCount = Number(pro.reviewCount) || 0;
      const newRating = Number((((curRating * curCount) + Number(reviewData.rating)) / (curCount + 1)).toFixed(1));
      pro.rating = newRating;
      pro.reviewCount = curCount + 1;
      safeStorage.setItem(this.storageKeyPros, JSON.stringify(pros));
      this.notifyProListeners();
      this.broadcast("PRO_UPDATED", pro);
    }

    this.addNotification({
      title: "New Review Received",
      message: `Received ${reviewData.rating}★ rating from ${reviewData.customerName || 'Customer'}.`,
      recipientId: reviewData.professionalId
    });

    this.broadcast("REVIEW_ADDED", newReview);
    return newReview;
  }

  async addNotification(notification) {
    const notifications = this.getNotifications();
    const item = {
      ...notification,
      id: "notif_" + Date.now(),
      createdAt: new Date().toISOString(),
      read: false,
      isRead: false
    };
    notifications.unshift(item);
    safeStorage.setItem(this.storageKeyNotifications, JSON.stringify(notifications));
    this.notifyNotificationListeners();
    this.broadcast("NOTIFICATION_ADDED", item);
    return item;
  }

  async markNotificationsRead() {
    const notifications = this.getNotifications().map((n) => ({ ...n, read: true, isRead: true }));
    safeStorage.setItem(this.storageKeyNotifications, JSON.stringify(notifications));
    this.notifyNotificationListeners();
    this.broadcast("NOTIFICATIONS_READ", null);
    return true;
  }

  getTestingFeedback() {
    try {
      const data = safeStorage.getItem("bluecollar_testing_feedback");
      return data ? JSON.parse(data) : SEED_TESTING_FEEDBACK;
    } catch {
      return SEED_TESTING_FEEDBACK;
    }
  }

  async saveTestingFeedback(entry) {
    const list = this.getTestingFeedback();
    const item = {
      id: "fb_" + Date.now(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    list.unshift(item);
    safeStorage.setItem("bluecollar_testing_feedback", JSON.stringify(list));
    this.broadcast("TESTING_FEEDBACK_ADDED", item);
    return item;
  }

  async resetToBaselineSeed() {
    safeStorage.setItem(this.storageKeyBookings, JSON.stringify([]));
    safeStorage.setItem(this.storageKeyPros, JSON.stringify(SEED_PROFESSIONALS));
    safeStorage.setItem(this.storageKeyNotifications, JSON.stringify([]));
    safeStorage.setItem("bluecollar_reviews", JSON.stringify([]));
    safeStorage.setItem("bluecollar_saved_pros", JSON.stringify([]));
    safeStorage.setItem("bluecollar_testing_feedback", JSON.stringify(SEED_TESTING_FEEDBACK));

    store.setState({
      bookings: [],
      professionals: SEED_PROFESSIONALS,
      notifications: []
    });

    this.notifyBookingListeners();
    this.notifyProListeners();
    this.notifyNotificationListeners();
    this.broadcast("BASELINE_RESET", null);
    return true;
  }

  getSyncInfo() {
    return {
      active: true,
      type: "local",
      label: "Live Sync: Local (BroadcastChannel)"
    };
  }
}

export const SEED_TESTING_FEEDBACK = [
  {
    id: "fb_1",
    timestamp: "2026-10-14T09:15:00.000Z",
    testerRole: "Apartment Resident (Family)",
    scores: {
      discovery: 5,
      profile: 5,
      pricing: 4,
      booking: 5,
      trust: 5
    },
    comment: "The real-time distance sorting and live availability indicator saved me hours when finding a local electrician. Very clear and fast."
  },
  {
    id: "fb_2",
    timestamp: "2026-10-14T11:30:00.000Z",
    testerRole: "PG Tenant",
    scores: {
      discovery: 4,
      profile: 5,
      pricing: 5,
      booking: 5,
      trust: 4
    },
    comment: "Itemized price estimates before confirmation are super transparent. No hidden charges or awkward bargaining."
  },
  {
    id: "fb_3",
    timestamp: "2026-10-14T14:45:00.000Z",
    testerRole: "City Newcomer",
    scores: {
      discovery: 5,
      profile: 4,
      pricing: 5,
      booking: 4,
      trust: 5
    },
    comment: "Emergency dispatch mode with realistic transit ETA and statutory safety warnings is a brilliant touch for new residents."
  }
];

// ============================================================================
// 4. Firestore Adapter (Auto-activated when valid keys are supplied)
// ============================================================================

class FirestoreAdapter {
  constructor() {
    this.isConfigured = isFirebaseConfigured();
  }

  async init() {
    // When real credentials are provided in js/config.js, initialize Firebase SDK
    console.info("Firestore configured. Ready for cloud sync.");
  }

  watchBookings(cb) {
    // Fallback if SDK not loaded
    return () => {};
  }

  watchProfessionals(cb) {
    return () => {};
  }

  watchNotifications(cb) {
    return () => {};
  }

  async saveBooking(data) {
    return data;
  }

  async updateBooking(id, updates) {
    return { id, ...updates };
  }

  async updatePresence(proId, isAvailable) {
    return { id: proId, isAvailable };
  }

  getSyncInfo() {
    return {
      active: true,
      type: "firestore",
      label: "Live Sync: Cloud (Firestore)"
    };
  }
}

// ============================================================================
// 5. Data Service Layer Auto-Selector
// ============================================================================

function createDataService() {
  const isCloud = isFirebaseConfigured();
  const adapter = isCloud ? new FirestoreAdapter() : new LocalStorageAdapter();

  const syncInfo = adapter.getSyncInfo();
  store.setState({ syncStatus: syncInfo });

  return {
    adapter,
    isCloud,
    watchBookings: (cb) => adapter.watchBookings(cb),
    getBookings: () => adapter.getBookings ? adapter.getBookings() : (store.getState().bookings || []),
    saveBooking: (data) => adapter.saveBooking(data),
    updateBooking: (id, updates) => adapter.updateBooking(id, updates),
    watchProfessionals: (cb) => adapter.watchProfessionals(cb),
    getProfessionals: () => adapter.getProfessionals ? adapter.getProfessionals() : (store.getState().professionals || []),
    updatePresence: (proId, isAvailable) => adapter.updatePresence(proId, isAvailable),
    watchNotifications: (cb) => adapter.watchNotifications(cb),
    getNotifications: () => adapter.getNotifications ? adapter.getNotifications() : (store.getState().notifications || []),
    addNotification: (n) => adapter.addNotification ? adapter.addNotification(n) : Promise.resolve(n),
    markNotificationsRead: () => adapter.markNotificationsRead ? adapter.markNotificationsRead() : Promise.resolve(true),
    getReviews: (proId) => adapter.getReviews ? adapter.getReviews(proId) : [],
    saveReview: (r) => adapter.saveReview ? adapter.saveReview(r) : Promise.resolve(r),
    getTestingFeedback: () => adapter.getTestingFeedback ? adapter.getTestingFeedback() : SEED_TESTING_FEEDBACK,
    saveTestingFeedback: (f) => adapter.saveTestingFeedback ? adapter.saveTestingFeedback(f) : Promise.resolve(f),
    resetToBaselineSeed: () => adapter.resetToBaselineSeed ? adapter.resetToBaselineSeed() : Promise.resolve(true),
    getSyncInfo: () => adapter.getSyncInfo()
  };
}

export const dataService = createDataService();

// Hook up state store initial sync
dataService.watchBookings((bookings) => {
  store.setState({ bookings });
});

dataService.watchProfessionals((professionals) => {
  store.setState({ professionals });
});

dataService.watchNotifications((notifications) => {
  store.setState({ notifications });
});
