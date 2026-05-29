/**
 * Nepal Administrative Data Constants
 * Source: https://github.com/Pratik-Kattel/Nepal-Administrative-Data-JSON
 *
 * 7 Provinces → 77 Districts → 753 Local Units
 */

import type { Province, District, LocalUnit } from "../types";

// ═══════════════════════════════════════════════════════════════════════════════
// PROVINCES (7)
// ═══════════════════════════════════════════════════════════════════════════════

export const provinces: Province[] = [
  {
    id: 1,
    nameEn: "Koshi Pradesh",
    nameNp: "कोशी प्रदेश",
    colorHex: "#E63946",
  },
  {
    id: 2,
    nameEn: "Madhesh Pradesh",
    nameNp: "मधेश प्रदेश",
    colorHex: "#F77F00",
  },
  {
    id: 3,
    nameEn: "Bagmati Pradesh",
    nameNp: "बागमती प्रदेश",
    colorHex: "#38B000",
  },
  {
    id: 4,
    nameEn: "Gandaki Pradesh",
    nameNp: "गण्डकी प्रदेश",
    colorHex: "#3A86FF",
  },
  {
    id: 5,
    nameEn: "Lumbini Pradesh",
    nameNp: "लुम्बिनी प्रदेश",
    colorHex: "#8338EC",
  },
  {
    id: 6,
    nameEn: "Karnali Pradesh",
    nameNp: "कर्णाली प्रदेश",
    colorHex: "#FF006E",
  },
  {
    id: 7,
    nameEn: "Sudurpashchim Pradesh",
    nameNp: "सुदूरपश्चिम प्रदेश",
    colorHex: "#FB5607",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRICTS (77) - Organized by Province
// ═══════════════════════════════════════════════════════════════════════════════

export const districts: District[] = [
  // Province 1: Koshi Pradesh (14 districts)
  { id: 1, provinceId: 1, nameEn: "Bhojpur", nameNp: "भोजपुर" },
  { id: 2, provinceId: 1, nameEn: "Dhankuta", nameNp: "धनकुटा" },
  { id: 3, provinceId: 1, nameEn: "Ilam", nameNp: "इलाम" },
  { id: 4, provinceId: 1, nameEn: "Jhapa", nameNp: "झापा" },
  { id: 5, provinceId: 1, nameEn: "Khotang", nameNp: "खोटाङ" },
  { id: 6, provinceId: 1, nameEn: "Morang", nameNp: "मोरङ" },
  { id: 7, provinceId: 1, nameEn: "Okhaldhunga", nameNp: "ओखलढुङ्गा" },
  { id: 8, provinceId: 1, nameEn: "Panchthar", nameNp: "पाँचथर" },
  { id: 9, provinceId: 1, nameEn: "Sankhuwasabha", nameNp: "सङ्खुवासभा" },
  { id: 10, provinceId: 1, nameEn: "Solukhumbu", nameNp: "सोलुखुम्बु" },
  { id: 11, provinceId: 1, nameEn: "Sunsari", nameNp: "सुनसरी" },
  { id: 12, provinceId: 1, nameEn: "Taplejung", nameNp: "ताप्लेजुङ" },
  { id: 13, provinceId: 1, nameEn: "Terhathum", nameNp: "तेह्रथुम" },
  { id: 14, provinceId: 1, nameEn: "Udayapur", nameNp: "उदयपुर" },

  // Province 2: Madhesh Pradesh (8 districts)
  { id: 15, provinceId: 2, nameEn: "Bara", nameNp: "बारा" },
  { id: 16, provinceId: 2, nameEn: "Dhanusha", nameNp: "धनुषा" },
  { id: 17, provinceId: 2, nameEn: "Mahottari", nameNp: "महोत्तरी" },
  { id: 18, provinceId: 2, nameEn: "Parsa", nameNp: "पर्सा" },
  { id: 19, provinceId: 2, nameEn: "Rautahat", nameNp: "रौतहट" },
  { id: 20, provinceId: 2, nameEn: "Saptari", nameNp: "सप्तरी" },
  { id: 21, provinceId: 2, nameEn: "Sarlahi", nameNp: "सर्लाही" },
  { id: 22, provinceId: 2, nameEn: "Siraha", nameNp: "सिराहा" },

  // Province 3: Bagmati Pradesh (13 districts)
  { id: 23, provinceId: 3, nameEn: "Bhaktapur", nameNp: "भक्तपुर" },
  { id: 24, provinceId: 3, nameEn: "Chitwan", nameNp: "चितवन" },
  { id: 25, provinceId: 3, nameEn: "Dhading", nameNp: "धादिङ" },
  { id: 26, provinceId: 3, nameEn: "Dolakha", nameNp: "दोलखा" },
  { id: 27, provinceId: 3, nameEn: "Kathmandu", nameNp: "काठमाडौं" },
  { id: 28, provinceId: 3, nameEn: "Kavrepalanchok", nameNp: "काभ्रेपलाञ्चोक" },
  { id: 29, provinceId: 3, nameEn: "Lalitpur", nameNp: "ललितपुर" },
  { id: 30, provinceId: 3, nameEn: "Makwanpur", nameNp: "मकवानपुर" },
  { id: 31, provinceId: 3, nameEn: "Nuwakot", nameNp: "नुवाकोट" },
  { id: 32, provinceId: 3, nameEn: "Ramechhap", nameNp: "रामेछाप" },
  { id: 33, provinceId: 3, nameEn: "Rasuwa", nameNp: "रसुवा" },
  { id: 34, provinceId: 3, nameEn: "Sindhuli", nameNp: "सिन्धुली" },
  { id: 35, provinceId: 3, nameEn: "Sindhupalchok", nameNp: "सिन्धुपाल्चोक" },

  // Province 4: Gandaki Pradesh (11 districts)
  { id: 36, provinceId: 4, nameEn: "Baglung", nameNp: "बाग्लुङ" },
  { id: 37, provinceId: 4, nameEn: "Gorkha", nameNp: "गोरखा" },
  { id: 38, provinceId: 4, nameEn: "Kaski", nameNp: "कास्की" },
  { id: 39, provinceId: 4, nameEn: "Lamjung", nameNp: "लमजुङ" },
  { id: 40, provinceId: 4, nameEn: "Manang", nameNp: "मनाङ" },
  { id: 41, provinceId: 4, nameEn: "Mustang", nameNp: "मुस्ताङ" },
  { id: 42, provinceId: 4, nameEn: "Myagdi", nameNp: "म्याग्दी" },
  {
    id: 43,
    provinceId: 4,
    nameEn: "Nawalparasi East",
    nameNp: "नवलपरासी (पूर्व)",
  },
  { id: 44, provinceId: 4, nameEn: "Parbat", nameNp: "पर्बत" },
  { id: 45, provinceId: 4, nameEn: "Syangja", nameNp: "स्याङ्जा" },
  { id: 46, provinceId: 4, nameEn: "Tanahun", nameNp: "तनहुँ" },

  // Province 5: Lumbini Pradesh (12 districts)
  { id: 47, provinceId: 5, nameEn: "Arghakhanchi", nameNp: "अर्घाखाँची" },
  { id: 48, provinceId: 5, nameEn: "Banke", nameNp: "बाँके" },
  { id: 49, provinceId: 5, nameEn: "Bardiya", nameNp: "बर्दिया" },
  { id: 50, provinceId: 5, nameEn: "Dang", nameNp: "दाङ" },
  { id: 51, provinceId: 5, nameEn: "Gulmi", nameNp: "गुल्मी" },
  { id: 52, provinceId: 5, nameEn: "Kapilvastu", nameNp: "कपिलवस्तु" },
  {
    id: 53,
    provinceId: 5,
    nameEn: "Nawalparasi West",
    nameNp: "नवलपरासी (पश्चिम)",
  },
  { id: 54, provinceId: 5, nameEn: "Palpa", nameNp: "पाल्पा" },
  { id: 55, provinceId: 5, nameEn: "Pyuthan", nameNp: "प्युठान" },
  { id: 56, provinceId: 5, nameEn: "Rolpa", nameNp: "रोल्पा" },
  { id: 57, provinceId: 5, nameEn: "Rupandehi", nameNp: "रुपन्देही" },
  { id: 58, provinceId: 5, nameEn: "Rukum East", nameNp: "रुकुम (पूर्व)" },

  // Province 6: Karnali Pradesh (10 districts)
  { id: 59, provinceId: 6, nameEn: "Dailekh", nameNp: "दैलेख" },
  { id: 60, provinceId: 6, nameEn: "Dolpa", nameNp: "डोल्पा" },
  { id: 61, provinceId: 6, nameEn: "Humla", nameNp: "हुम्ला" },
  { id: 62, provinceId: 6, nameEn: "Jajarkot", nameNp: "जाजरकोट" },
  { id: 63, provinceId: 6, nameEn: "Jumla", nameNp: "जुम्ला" },
  { id: 64, provinceId: 6, nameEn: "Kalikot", nameNp: "कालिकोट" },
  { id: 65, provinceId: 6, nameEn: "Mugu", nameNp: "मुगु" },
  { id: 66, provinceId: 6, nameEn: "Rukum West", nameNp: "रुकुम (पश्चिम)" },
  { id: 67, provinceId: 6, nameEn: "Salyan", nameNp: "सल्यान" },
  { id: 68, provinceId: 6, nameEn: "Surkhet", nameNp: "सुर्खेत" },

  // Province 7: Sudurpashchim Pradesh (9 districts)
  { id: 69, provinceId: 7, nameEn: "Achham", nameNp: "अछाम" },
  { id: 70, provinceId: 7, nameEn: "Baitadi", nameNp: "बैतडी" },
  { id: 71, provinceId: 7, nameEn: "Bajhang", nameNp: "बझाङ" },
  { id: 72, provinceId: 7, nameEn: "Bajura", nameNp: "बाजुरा" },
  { id: 73, provinceId: 7, nameEn: "Dadeldhura", nameNp: "डडेल्धुरा" },
  { id: 74, provinceId: 7, nameEn: "Darchula", nameNp: "दार्चुला" },
  { id: 75, provinceId: 7, nameEn: "Doti", nameNp: "डोटी" },
  { id: 76, provinceId: 7, nameEn: "Kailali", nameNp: "कैलाली" },
  { id: 77, provinceId: 7, nameEn: "Kanchanpur", nameNp: "कञ्चनपुर" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get districts for a specific province
 */
export function getDistrictsByProvince(provinceId: number): District[] {
  return districts.filter((d) => d.provinceId === provinceId);
}

/**
 * Get province by ID
 */
export function getProvinceById(id: number): Province | undefined {
  return provinces.find((p) => p.id === id);
}

/**
 * Get district by ID
 */
export function getDistrictById(id: number): District | undefined {
  return districts.find((d) => d.id === id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL UNITS SUMMARY (753 total)
// Full dataset loaded from API/database at runtime
// ═══════════════════════════════════════════════════════════════════════════════

export const localUnitSummary = {
  metropolitan: 6, // महानगरपालिका
  subMetropolitan: 11, // उपमहानगरपालिका
  municipality: 276, // नगरपालिका
  ruralMunicipality: 460, // गाउँपालिका
  total: 753,
};

// Major cities (metropolitans) - for quick reference
export const metropolitanCities = [
  { districtId: 27, nameEn: "Kathmandu", nameNp: "काठमाडौं" },
  { districtId: 29, nameEn: "Lalitpur", nameNp: "ललितपुर" },
  { districtId: 23, nameEn: "Bhaktapur", nameNp: "भक्तपुर" },
  { districtId: 6, nameEn: "Biratnagar", nameNp: "विराटनगर" },
  { districtId: 38, nameEn: "Pokhara", nameNp: "पोखरा" },
  { districtId: 24, nameEn: "Bharatpur", nameNp: "भरतपुर" },
];
