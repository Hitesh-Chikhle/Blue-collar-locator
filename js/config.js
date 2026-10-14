/**
 * Blue Collar — Application Configuration
 * All Firebase keys are kept here as placeholder values and never hard-coded elsewhere.
 */

export const firebaseConfig = {
  apiKey: "PLACEHOLDER_FIREBASE_API_KEY",
  authDomain: "blue-collar-prototype.firebaseapp.com",
  projectId: "blue-collar-prototype",
  storageBucket: "blue-collar-prototype.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

/**
 * Checks if real Firebase configuration values have been supplied.
 * If false, the application seamlessly falls back to localStorage + BroadcastChannel.
 */
export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "PLACEHOLDER_FIREBASE_API_KEY" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "blue-collar-prototype"
  );
}

export const APP_CONFIG = {
  name: "Blue Collar - Local Service Finder",
  academicProjectNote: "College Design Thinking Prototype",
  defaultLocation: {
    lat: 12.9716, // Bengaluru center (default fallback)
    lng: 77.5946,
    address: "Bengaluru, Karnataka, India"
  },
  supportedLanguages: [
    { code: "en", name: "English", native: "English" },
    { code: "hi", name: "Hindi", native: "हिंदी" },
    { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" }
  ],
  categories: [
    { id: "electrician", name: "Electrician", icon: "zap" },
    { id: "plumber", name: "Plumber", icon: "droplet" },
    { id: "carpenter", name: "Carpenter", icon: "tool" },
    { id: "appliance", name: "AC & Appliance", icon: "cpu" },
    { id: "mechanic", name: "Mechanic", icon: "settings" },
    { id: "cleaner", name: "Cleaner", icon: "sparkles" },
    { id: "painter", name: "Painter", icon: "feather" }
  ],
  emergencyCategories: ["plumber", "electrician", "appliance"],
  broadcastChannelName: "blue_collar_sync_channel"
};
