/**
 * Job categories for Nepal manpower platform
 * Covers both skilled and unskilled labor categories
 */

import type { JobCategory } from "../types";

export const jobCategories: Omit<JobCategory, "id">[] = [
  // Construction & Building
  {
    slug: "mason",
    nameEn: "Mason",
    nameNp: "डकर्मी",
    icon: "🧱",
    description: "Brick and stone laying, plastering, concrete work",
    isActive: true,
  },
  {
    slug: "carpenter",
    nameEn: "Carpenter",
    nameNp: "काठको मिस्त्री",
    icon: "🪚",
    description: "Wood furniture, doors, windows, roofing",
    isActive: true,
  },
  {
    slug: "painter",
    nameEn: "Painter",
    nameNp: "रङ्गाउने",
    icon: "🎨",
    description: "House painting, wall design, polishing",
    isActive: true,
  },
  {
    slug: "welder",
    nameEn: "Welder",
    nameNp: "वेल्डर",
    icon: "⚡",
    description: "Metal welding, grills, gates, fabrication",
    isActive: true,
  },
  {
    slug: "construction_labor",
    nameEn: "Construction Labor",
    nameNp: "निर्माण मजदुर",
    icon: "👷",
    description: "General construction helper, loading, material handling",
    isActive: true,
  },

  // Utilities & Maintenance
  {
    slug: "plumber",
    nameEn: "Plumber",
    nameNp: "प्लम्बर",
    icon: "🔧",
    description: "Water pipes, drainage, bathroom fittings",
    isActive: true,
  },
  {
    slug: "electrician",
    nameEn: "Electrician",
    nameNp: "बिजुली मिस्त्री",
    icon: "💡",
    description: "Wiring, switches, repairs, solar installation",
    isActive: true,
  },

  // Agriculture & Land
  {
    slug: "gardener",
    nameEn: "Gardener",
    nameNp: "माली",
    icon: "🌱",
    description: "Garden maintenance, planting, landscaping",
    isActive: true,
  },
  {
    slug: "soil_plougher",
    nameEn: "Soil Plougher",
    nameNp: "हलो जोत्ने",
    icon: "🚜",
    description: "Land preparation, ploughing, tilling",
    isActive: true,
  },
  {
    slug: "harvester",
    nameEn: "Harvester",
    nameNp: "कटनी गर्ने",
    icon: "🌾",
    description: "Crop harvesting, threshing, seasonal farm work",
    isActive: true,
  },

  // Domestic & Household
  {
    slug: "domestic_helper",
    nameEn: "Domestic Helper",
    nameNp: "घरेलु सहयोगी",
    icon: "🏠",
    description: "Cooking, cleaning, household tasks",
    isActive: true,
  },

  // Transportation
  {
    slug: "driver",
    nameEn: "Driver",
    nameNp: "चालक",
    icon: "🚗",
    description: "Vehicle driving - car, jeep, tempo, truck",
    isActive: true,
  },
];

/**
 * Get job category by slug
 */
export function getJobCategoryBySlug(slug: string) {
  return jobCategories.find((j) => j.slug === slug);
}

/**
 * Get all active job categories
 */
export function getActiveJobCategories() {
  return jobCategories.filter((j) => j.isActive);
}
