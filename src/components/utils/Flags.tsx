const COUNTRY_FLAG_SLUGS: Record<string, string> = {
  algeria: "algeria",
  angola: "angola",
  benin: "benin",
  botswana: "botswana",
  "burkina faso": "burkina-faso",
  burundi: "burundi",
  cameroon: "cameroon",
  "central african republic": "central-african-republic",
  chad: "chad",
  comoros: "comoros",
  congo: "republic-of-the-congo",
  "democratic republic of the congo": "democratic-republic-of-congo",
  djibouti: "djibouti",
  egypt: "egypt",
  "equatorial guinea": "equatorial-guinea",
  eritrea: "eritrea",
  ethiopia: "ethiopia",
  gabon: "gabon",
  gambia: "gambia",
  ghana: "ghana",
  guinea: "guinea",
  kenya: "kenya",
  lesotho: "lesotho",
  liberia: "liberia",
  libya: "libya",
  madagascar: "madagascar",
  malawi: "malawi",
  mali: "mali",
  mauritania: "mauritania",
  mauritius: "mauritius",
  morocco: "morocco",
  mozambique: "mozambique",
  namibia: "namibia",
  niger: "niger",
  rwanda: "rwanda",
  sudan: "sudan",
  senegal: "senegal",
  seychelles: "seychelles",
  "sierra leone": "sierra-leone",
  somalia: "somalia",
  "south africa": "south-africa",
  "south sudan": "south sudan",
  swaziland: "swaziland",
  eswatini: "swaziland",
  tanzania: "tanzania",
  togo: "togo",
  tunisia: "tunisia",
  uganda: "uganda",
  zambia: "zambia",
  nigeria: "nigeria",
  "guinea bissau": "guinea-bissau",
  "cape verde": "cape-verde",
  "sao tome and principe": "sao-tome-and-principe",
  zimbabwe: "zimbabwe",
  "cote d'ivoire": "ivory-coast",
  "cote d ivoire": "ivory-coast",
  "ivory coast": "ivory-coast",
};

const COUNTRY_ALIASES: Record<string, string> = {
  "cabo verde": "cape verde",
  "cape verde": "cape verde",
  "dr congo": "democratic republic of the congo",
  "dem rep congo": "democratic republic of the congo",
  "congo dem rep": "democratic republic of the congo",
  "democratic republic of congo": "democratic republic of the congo",
  "congo rep": "congo",
  "republic of the congo": "congo",
  "gambia the": "gambia",
  "gambia, the": "gambia",
  "the gambia": "gambia",
  "united republic of tanzania": "tanzania",
  "western sahara": "morocco",
  "sao tome and principe": "sao tome and principe",
  "sao tome and principe democratic republic": "sao tome and principe",
};

const normalizeCountryName = (value: string): string => {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return COUNTRY_ALIASES[base] ?? base;
};

const DEFAULT_FLAG_PATH = "/images/world.png";

export const getCountryFlag = (countryName: string): string => {
  const normalized = normalizeCountryName(countryName);
  const slug = COUNTRY_FLAG_SLUGS[normalized];
  if (!slug) {
    return DEFAULT_FLAG_PATH;
  }
  return `/images/flags/${slug}.png`;
};
