/**
 * Province visual metadata
 * Shared by web and android for consistent place-based imagery.
 */

export type ProvinceVisual = {
  provinceId: number;
  majorCityEn: string;
  majorCityNp: string;
  imageUrl: string;
  imageUrlSmall: string;
  credit: string;
};

function buildVisualWiki(
  provinceId: number,
  fileName: string,
  majorCityEn: string,
  majorCityNp: string,
): ProvinceVisual {
  const encodedFileName = encodeURIComponent(fileName);
  const baseUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFileName}`;

  return {
    provinceId,
    majorCityEn,
    majorCityNp,
    imageUrl: `${baseUrl}?width=1280`,
    imageUrlSmall: `${baseUrl}?width=720`,
    credit: "Wikimedia Commons",
  };
}

export const provinceVisuals: ProvinceVisual[] = [
  buildVisualWiki(
    1,
    "Mount_Everest_as_seen_from_Drukair2_PLW_edit.jpg", // Mount Everest
    "Sagarmatha",
    "सगरमाथा",
  ),
  buildVisualWiki(
    2,
    "Janaki_Mandir_of_Janakpur,_Nepal.jpg", // Janaki Temple
    "Janakpur",
    "जनकपुर",
  ),
  buildVisualWiki(
    3,
    "Boudha_Stupa_2018_04.jpg", // Boudhanath Stupa
    "Kathmandu",
    "काठमाडौं",
  ),
  buildVisualWiki(
    4,
    "Phewa_Lake_of_Pokhara_city.jpg", // Phewa Lake
    "Pokhara",
    "पोखरा",
  ),
  buildVisualWiki(
    5,
    "Lumbini_Mayadevi_Temple.jpg", // Lumbini - Birthplace of Buddha
    "Lumbini",
    "लुम्बिनी",
  ),
  buildVisualWiki(
    6,
    "Rara_Lake,_Mugu,_Nepal.jpg", // Rara Lake
    "Rara Region",
    "रारा क्षेत्र",
  ),
  buildVisualWiki(
    7,
    "Khaptad,_Khaptad_National_Park,_Nepal.jpg", // Khaptad National Park
    "Khaptad",
    "खप्तड",
  ),
];

export const provinceVisualsById = Object.fromEntries(
  provinceVisuals.map((visual) => [visual.provinceId, visual]),
) as Record<number, ProvinceVisual>;
