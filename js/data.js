/**
 * Blue Collar — Seed Professionals & Dynamic Location Generator
 * All records are fictional and clearly labeled as "Demo professional".
 * Estimates for ETA, visiting fees, and demo verification badges are strictly academic.
 */

export const BASE_DEMO_PROFESSIONALS = [
  {
    id: "pro_1",
    name: "Ramesh Kumar",
    category: "electrician",
    categoryLabel: "Electrician",
    label: "Demo professional",
    skills: ["Short Circuits", "Switchboards", "Wiring", "Fan Repair"],
    experienceYears: 8,
    rating: 4.8,
    reviewCount: 42,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 299,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 98450 •••••",
    bio: "Specializes in prompt domestic rewiring, tripping circuit breakers, and inverter maintenance.",
    offsetKm: { dLat: 0.012, dLng: 0.010 } // ~1.5 km northeast
  },
  {
    id: "pro_2",
    name: "Suresh Patil",
    category: "plumber",
    categoryLabel: "Plumber",
    label: "Demo professional",
    skills: ["Pipe Leakage", "Tap Repair", "Geyser Connection", "Drain Blockage"],
    experienceYears: 11,
    rating: 4.9,
    reviewCount: 58,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 349,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 97401 •••••",
    bio: "Emergency pipeline leaks, tap replacements, flush tank repairs, and sanitary fixes.",
    offsetKm: { dLat: -0.015, dLng: 0.008 } // ~1.8 km southeast
  },
  {
    id: "pro_3",
    name: "Anand Verma",
    category: "carpenter",
    categoryLabel: "Carpenter",
    label: "Demo professional",
    skills: ["Door Locks", "Hinges & Handles", "Furniture Assembly", "Bed Repair"],
    experienceYears: 6,
    rating: 4.7,
    reviewCount: 29,
    isAvailable: true,
    isEmergencyEligible: false,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 96112 •••••",
    bio: "Skilled woodwork, modular wardrobe door alignments, lock replacements, and custom furniture.",
    offsetKm: { dLat: 0.022, dLng: -0.018 } // ~3.1 km northwest
  },
  {
    id: "pro_4",
    name: "Mohan Lal",
    category: "ac_technician",
    categoryLabel: "AC Technician",
    label: "Demo professional",
    skills: ["Split AC Service", "Gas Refill", "Cooling Coil", "Compressor Diagnostics"],
    experienceYears: 9,
    rating: 4.6,
    reviewCount: 47,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 199,
    baseRatePerHour: 499,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 99003 •••••",
    bio: "Certified AC technician for gas leakage detection, deep jet cleaning, and PCB repair.",
    offsetKm: { dLat: -0.020, dLng: -0.015 } // ~2.8 km southwest
  },
  {
    id: "pro_5",
    name: "Kavita Reddy",
    category: "appliance",
    categoryLabel: "Appliance Repair",
    label: "Demo professional",
    skills: ["Washing Machine", "Refrigerator", "Microwave", "Water Purifier / RO"],
    experienceYears: 7,
    rating: 4.9,
    reviewCount: 63,
    isAvailable: false,
    isEmergencyEligible: false,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 98860 •••••",
    bio: "Expert diagnostics for single/double door fridges, front & top load washers, and RO filter servicing.",
    offsetKm: { dLat: 0.035, dLng: 0.020 } // ~4.5 km northeast
  },
  {
    id: "pro_6",
    name: "Imran Sheikh",
    category: "mechanic",
    categoryLabel: "Mechanic",
    label: "Demo professional",
    skills: ["Two-Wheeler Puncture", "Battery Jumpstart", "Brake Overhaul", "Oil Change"],
    experienceYears: 10,
    rating: 4.7,
    reviewCount: 36,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 249,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 94481 •••••",
    bio: "Mobile mechanic offering doorstep bike servicing, immediate puncture assistance, and dead battery jumpstarts.",
    offsetKm: { dLat: 0.018, dLng: 0.030 } // ~3.8 km east
  },
  {
    id: "pro_7",
    name: "Lakshmi Bai",
    category: "cleaning",
    categoryLabel: "Cleaning",
    label: "Demo professional",
    skills: ["Deep Home Cleaning", "Bathroom Sanitization", "Kitchen Degreasing", "Sofa Shampooing"],
    experienceYears: 5,
    rating: 4.8,
    reviewCount: 51,
    isAvailable: true,
    isEmergencyEligible: false,
    visitingFee: 199,
    baseRatePerHour: 349,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 91104 •••••",
    bio: "Intensive deep sanitation for new PG move-ins, tile scrubbing, kitchen grease removal, and upholstery shampoo.",
    offsetKm: { dLat: -0.030, dLng: 0.010 } // ~3.4 km south
  },
  {
    id: "pro_8",
    name: "Rajesh Sharma",
    category: "painter",
    categoryLabel: "Painter",
    label: "Demo professional",
    skills: ["Waterproofing", "Wall Touch-up", "Interior Repainting", "Texture Coating"],
    experienceYears: 12,
    rating: 4.6,
    reviewCount: 33,
    isAvailable: false,
    isEmergencyEligible: false,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 97312 •••••",
    bio: "Quality wall putty, dampness treatment, touch-up painting for rental handover, and exterior coatings.",
    offsetKm: { dLat: 0.045, dLng: -0.025 } // ~5.8 km northwest
  },
  {
    id: "pro_9",
    name: "Deepak Yadav",
    category: "electrician",
    categoryLabel: "Electrician",
    label: "Demo professional",
    skills: ["Inverter Installation", "LED Concealed Lighting", "MCB Box Replacement"],
    experienceYears: 4,
    rating: 4.5,
    reviewCount: 19,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 99,
    baseRatePerHour: 249,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 98440 •••••",
    bio: "Fast response electrical assistance for college dorms, studio flats, and emergency power dropouts.",
    offsetKm: { dLat: -0.010, dLng: -0.025 } // ~2.9 km southwest
  },
  {
    id: "pro_10",
    name: "Naveen Gowda",
    category: "plumber",
    categoryLabel: "Plumber",
    label: "Demo professional",
    skills: ["Overhead Tank Cleaning", "Motor Pump Repair", "Borewell Lines"],
    experienceYears: 14,
    rating: 4.9,
    reviewCount: 78,
    isAvailable: true,
    isEmergencyEligible: true,
    visitingFee: 149,
    baseRatePerHour: 399,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 99800 •••••",
    bio: "Heavy plumbing diagnostics, water pressure booster pump servicing, and overhead tank overflows.",
    offsetKm: { dLat: 0.008, dLng: 0.040 } // ~4.4 km east
  },
  {
    id: "pro_11",
    name: "Sunil M.",
    category: "other",
    categoryLabel: "Handyman & General",
    label: "Demo professional",
    skills: ["Curtain Rod Fixing", "TV Wall Mount", "Drilling & Hanging", "Pest Sealant"],
    experienceYears: 6,
    rating: 4.7,
    reviewCount: 26,
    isAvailable: true,
    isEmergencyEligible: false,
    visitingFee: 99,
    baseRatePerHour: 249,
    verificationBadge: "Demo Verified",
    phoneMasked: "+91 94800 •••••",
    bio: "Multipurpose handyman assistance for new move-ins: TV mounting, mirror hanging, and general repairs.",
    offsetKm: { dLat: 0.025, dLng: 0.015 } // ~3.2 km northeast
  }
];

/**
 * Dynamically places the demo professionals around the user's active geographic center.
 * This guarantees realistic Haversine distances (1-8 km) and accurate ETAs for any selected city.
 */
export function getProfessionalsAroundLocation(userLat, userLng) {
  return BASE_DEMO_PROFESSIONALS.map((pro) => {
    // 1 deg lat is approx 111 km. 0.01 deg is ~1.1 km.
    const lat = Number((userLat + pro.offsetKm.dLat).toFixed(5));
    const lng = Number((userLng + pro.offsetKm.dLng).toFixed(5));
    
    return {
      ...pro,
      coordinates: { lat, lng }
    };
  });
}
