import { geoMercator, geoPath } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";
import africaGeoRaw from "./africa.geojson?raw";

export type AfricanGeoData = GeoJSON.FeatureCollection;

// Local GeoJSON — no fetch.
export const AFRICAN_GEO_DATA = JSON.parse(africaGeoRaw) as AfricanGeoData;

export function normalizeCountryName(value: string): string {
  const aliases: Record<string, string> = {
    "cabo verde": "cape verde",
    "cape verde": "cape verde",
    "ivory coast": "cote d'ivoire",
    "cote d ivoire": "cote d'ivoire",
    "cote d'ivoire": "cote d'ivoire",
    "cote divoire": "cote d'ivoire",
    "dr congo": "democratic republic of the congo",
    "dem rep congo": "democratic republic of the congo",
    "congo dem rep": "democratic republic of the congo",
    "democratic republic of congo": "democratic republic of the congo",
    "united republic of tanzania": "tanzania",
    swaziland: "eswatini",
    eswatini: "eswatini",
    "western sahara": "morocco",
    "congo rep": "congo",
    "republic of the congo": "congo",
    "gambia the": "gambia",
    "gambia, the": "gambia",
    "the gambia": "gambia",
    "sao tome and principe": "sao tome and principe",
    "sao tome and principe democratic republic": "sao tome and principe",
  };

  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return aliases[base] ?? base;
}

export function createAfricaProjection(
  geoData: AfricanGeoData,
  width: number,
  height: number,
) {
  const projection = geoMercator()
    .center([20, 5])
    .scale(800)
    .translate([width / 2, height / 2]);

  const pathGenerator = geoPath().projection(projection);
  const bounds = pathGenerator.bounds(geoData as GeoPermissibleObjects);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const scale = 0.9 / Math.max(dx / width, dy / height);

  projection
    .scale(scale * 800)
    .translate([width / 2, height / 2])
    .center([20, 5]);

  return { projection, pathGenerator };
}
