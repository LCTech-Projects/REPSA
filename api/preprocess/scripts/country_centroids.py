"""Approximate geographic centroids (lat, lon) for African countries in the panel."""

from __future__ import annotations

from typing import Dict, Tuple

LatLon = Tuple[float, float]

# Decimal degrees; used for haversine nearest-anchor assignment.
COUNTRY_CENTROIDS: Dict[str, LatLon] = {
    "Algeria": (28.0339, 1.6596),
    "Angola": (-11.2027, 17.8739),
    "Benin": (9.3077, 2.3158),
    "Botswana": (-22.3285, 24.6849),
    "Burkina Faso": (12.2383, -1.5616),
    "Burundi": (-3.3731, 29.9189),
    "Cameroon": (7.3697, 12.3547),
    "Cape Verde": (15.1217, -23.6051),
    "Central African Republic": (6.6111, 20.9394),
    "Chad": (15.4542, 18.7322),
    "Comoros": (-11.6455, 43.3333),
    "Congo": (-0.2280, 15.8277),
    "Cote d'Ivoire": (7.5400, -5.5471),
    "Democratic Republic of the Congo": (-4.0383, 21.7587),
    "Djibouti": (11.8251, 42.5903),
    "Egypt": (26.8206, 30.8025),
    "Equatorial Guinea": (1.6508, 10.2679),
    "Eritrea": (15.1794, 39.7823),
    "Eswatini": (-26.5225, 31.4659),
    "Ethiopia": (9.1450, 40.4897),
    "Gabon": (-0.8037, 11.6094),
    "Gambia": (13.4432, -15.3101),
    "Ghana": (7.9465, -1.0232),
    "Guinea": (9.9456, -9.6966),
    "Guinea-Bissau": (11.8037, -15.1804),
    "Kenya": (-0.0236, 37.9062),
    "Lesotho": (-29.6100, 28.2336),
    "Liberia": (6.4281, -9.4295),
    "Libya": (26.3351, 17.2283),
    "Madagascar": (-18.7669, 46.8691),
    "Malawi": (-13.2543, 34.3015),
    "Mali": (17.5707, -3.9962),
    "Mauritania": (21.0079, -10.9408),
    "Mauritius": (-20.3484, 57.5522),
    "Morocco": (31.7917, -7.0926),
    "Mozambique": (-18.6657, 35.5296),
    "Namibia": (-22.9576, 18.4904),
    "Niger": (17.6078, 8.0817),
    "Nigeria": (9.0820, 8.6753),
    "Rwanda": (-1.9403, 29.8739),
    "Sao Tome and Principe": (0.1864, 6.6131),
    "Senegal": (14.4974, -14.4524),
    "Seychelles": (-4.6796, 55.4920),
    "Sierra Leone": (8.4606, -11.7799),
    "Somalia": (5.1521, 46.1996),
    "South Africa": (-30.5595, 22.9375),
    "South Sudan": (6.8770, 31.3070),
    "Sudan": (12.8628, 30.2176),
    "Tanzania": (-6.3690, 34.8888),
    "Togo": (8.6195, 0.8248),
    "Tunisia": (33.8869, 9.5375),
    "Uganda": (1.3733, 32.2903),
    "Zambia": (-13.1339, 27.8493),
    "Zimbabwe": (-19.0154, 29.1549),
}

ANCHOR_COUNTRIES = ("South Africa", "Nigeria", "Morocco")
