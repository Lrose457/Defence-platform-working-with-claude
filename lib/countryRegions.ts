const regionByCountryName: Record<string, string> = {
  "Afghanistan, Islamic Republic of": "Asia",
  Albania: "Europe",
  Algeria: "Africa",
  "Andorra, Principality of": "Europe",
  Angola: "Africa",
  "Antigua and Barbuda": "North America",
  Argentina: "South America",
  "Armenia, Republic of": "Asia",
  "Aruba, Kingdom of the Netherlands": "North America",
  Austria: "Europe",
  "Azerbaijan, Republic of": "Asia",
  "Bahamas, The": "North America",
  "Bahrain, Kingdom of": "Middle East",
  Bangladesh: "Asia",
  Barbados: "North America",
  "Belarus, Republic of": "Europe",
  Belgium: "Europe",
  Belize: "North America",
  Benin: "Africa",
  Bhutan: "Asia",
  Bolivia: "South America",
  "Bosnia and Herzegovina": "Europe",
  Botswana: "Africa",
  Brazil: "South America",
  "Brunei Darussalam": "Asia",
  Bulgaria: "Europe",
  "Burkina Faso": "Africa",
  Burundi: "Africa",
  "Cabo Verde": "Africa",
  Cambodia: "Asia",
  Cameroon: "Africa",
  "Central African Republic": "Africa",
};

export function getCountryRegion(
  country: { name?: string | null; region?: string | null },
) {
  const recordedRegion = country.region?.trim();

  if (recordedRegion && recordedRegion.toLowerCase() !== "unspecified") {
    return recordedRegion;
  }

  return regionByCountryName[country.name ?? ""] ?? "Unspecified";
}