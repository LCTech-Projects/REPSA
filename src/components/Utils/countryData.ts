export interface CountryData {
    name: string;
    flag: string;
    electricityAccess: string;
    co2PerCapita: string;
    epiScore: string;
    epiSeverity: string;
    coordinates: [number, number]; // [latitude, longitude] for center of country
}

export const africanCountries: CountryData[] = [
    { name: "Mali", flag: "🇲🇱", electricityAccess: "54%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [17.570692, -3.996166] },
    { name: "Nigeria", flag: "🇳🇬", electricityAccess: "62%", co2PerCapita: "0.5t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [9.0820, 8.6753] },
    { name: "South Africa", flag: "🇿🇦", electricityAccess: "85%", co2PerCapita: "7.4t", epiScore: "Low", epiSeverity: "low", coordinates: [-30.5595, 22.9375] },
    { name: "Kenya", flag: "🇰🇪", electricityAccess: "75%", co2PerCapita: "0.3t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-0.0236, 37.9062] },
    { name: "Ethiopia", flag: "🇪🇹", electricityAccess: "45%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [9.1450, 38.7667] },
    { name: "Egypt", flag: "🇪🇬", electricityAccess: "100%", co2PerCapita: "2.2t", epiScore: "Minimal", epiSeverity: "minimal", coordinates: [26.8206, 30.8025] },
    { name: "Ghana", flag: "🇬🇭", electricityAccess: "85%", co2PerCapita: "0.5t", epiScore: "Low", epiSeverity: "low", coordinates: [7.9465, -1.0232] },
    { name: "Tanzania", flag: "🇹🇿", electricityAccess: "38%", co2PerCapita: "0.2t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-6.3690, 34.8888] },
    { name: "Uganda", flag: "🇺🇬", electricityAccess: "42%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [1.3733, 32.2903] },
    { name: "Morocco", flag: "🇲🇦", electricityAccess: "100%", co2PerCapita: "1.7t", epiScore: "Minimal", epiSeverity: "minimal", coordinates: [31.7917, -7.0926] },
    { name: "Algeria", flag: "🇩🇿", electricityAccess: "99%", co2PerCapita: "3.8t", epiScore: "Low", epiSeverity: "low", coordinates: [28.0339, 1.6596] },
    { name: "Angola", flag: "🇦🇴", electricityAccess: "43%", co2PerCapita: "1.1t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-11.2027, 17.8739] },
    { name: "Mozambique", flag: "🇲🇿", electricityAccess: "31%", co2PerCapita: "0.2t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-18.6657, 35.5296] },
    { name: "Zimbabwe", flag: "🇿🇼", electricityAccess: "52%", co2PerCapita: "0.8t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-19.0154, 29.1549] },
    { name: "Zambia", flag: "🇿🇲", electricityAccess: "45%", co2PerCapita: "0.3t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-13.1339, 27.8493] },
    { name: "Senegal", flag: "🇸🇳", electricityAccess: "70%", co2PerCapita: "0.5t", epiScore: "Low", epiSeverity: "low", coordinates: [14.4974, -14.4524] },
    { name: "Ivory Coast", flag: "🇨🇮", electricityAccess: "64%", co2PerCapita: "0.4t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [7.5400, -5.5471] },
    { name: "Cameroon", flag: "🇨🇲", electricityAccess: "65%", co2PerCapita: "0.3t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [7.3697, 12.3547] },
    { name: "Madagascar", flag: "🇲🇬", electricityAccess: "25%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-18.7669, 46.8691] },
    { name: "Sudan", flag: "🇸🇩", electricityAccess: "47%", co2PerCapita: "0.4t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [12.8628, 30.2176] },
    { name: "Chad", flag: "🇹🇩", electricityAccess: "11%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [15.4542, 18.7322] },
    { name: "Niger", flag: "🇳🇪", electricityAccess: "19%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [17.6078, 8.0817] },
    { name: "Burkina Faso", flag: "🇧🇫", electricityAccess: "19%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [12.2383, -1.5616] },
    { name: "Benin", flag: "🇧🇯", electricityAccess: "42%", co2PerCapita: "0.4t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [9.3077, 2.3158] },
    { name: "Togo", flag: "🇹🇬", electricityAccess: "51%", co2PerCapita: "0.3t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [8.6195, 0.8248] },
    { name: "Guinea", flag: "🇬🇳", electricityAccess: "35%", co2PerCapita: "0.2t", epiScore: "Severe", epiSeverity: "severe", coordinates: [9.9456, -9.6966] },
    { name: "Sierra Leone", flag: "🇸🇱", electricityAccess: "26%", co2PerCapita: "0.2t", epiScore: "Severe", epiSeverity: "severe", coordinates: [8.4606, -11.7799] },
    { name: "Liberia", flag: "🇱🇷", electricityAccess: "27%", co2PerCapita: "0.2t", epiScore: "Severe", epiSeverity: "severe", coordinates: [6.4281, -9.4295] },
    { name: "Guinea-Bissau", flag: "🇬🇼", electricityAccess: "22%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [11.8037, -15.1804] },
    { name: "Mauritania", flag: "🇲🇷", electricityAccess: "47%", co2PerCapita: "1.0t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [21.0079, -10.9408] },
    { name: "Libya", flag: "🇱🇾", electricityAccess: "100%", co2PerCapita: "8.2t", epiScore: "Low", epiSeverity: "low", coordinates: [26.3351, 17.2283] },
    { name: "Tunisia", flag: "🇹🇳", electricityAccess: "100%", co2PerCapita: "2.5t", epiScore: "Minimal", epiSeverity: "minimal", coordinates: [33.8869, 9.5375] },
    { name: "Botswana", flag: "🇧🇼", electricityAccess: "72%", co2PerCapita: "2.1t", epiScore: "Low", epiSeverity: "low", coordinates: [-22.3285, 24.6849] },
    { name: "Namibia", flag: "🇳🇦", electricityAccess: "56%", co2PerCapita: "1.4t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-22.9576, 18.4904] },
    { name: "Gabon", flag: "🇬🇦", electricityAccess: "92%", co2PerCapita: "2.8t", epiScore: "Low", epiSeverity: "low", coordinates: [-0.8037, 11.6094] },
    { name: "Equatorial Guinea", flag: "🇬🇶", electricityAccess: "67%", co2PerCapita: "2.1t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [1.6508, 10.2679] },
    { name: "Congo", flag: "🇨🇬", electricityAccess: "50%", co2PerCapita: "0.4t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-0.2280, 15.8277] },
    { name: "DR Congo", flag: "🇨🇩", electricityAccess: "19%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-4.0383, 21.7587] },
    { name: "Central African Republic", flag: "🇨🇫", electricityAccess: "15%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [6.6111, 20.9394] },
    { name: "Rwanda", flag: "🇷🇼", electricityAccess: "53%", co2PerCapita: "0.1t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-1.9441, 29.8739] },
    { name: "Burundi", flag: "🇧🇮", electricityAccess: "11%", co2PerCapita: "0.0t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-3.3731, 29.9189] },
    { name: "Malawi", flag: "🇲🇼", electricityAccess: "13%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [-13.2543, 34.3015] },
    { name: "Somalia", flag: "🇸🇴", electricityAccess: "49%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [5.1521, 46.1996] },
    { name: "Eritrea", flag: "🇪🇷", electricityAccess: "52%", co2PerCapita: "0.1t", epiScore: "Severe", epiSeverity: "severe", coordinates: [15.1794, 39.7823] },
    { name: "Djibouti", flag: "🇩🇯", electricityAccess: "65%", co2PerCapita: "0.3t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [11.8251, 42.5903] },
    { name: "South Sudan", flag: "🇸🇸", electricityAccess: "7%", co2PerCapita: "0.0t", epiScore: "Severe", epiSeverity: "severe", coordinates: [6.8770, 31.3070] },
    { name: "Lesotho", flag: "🇱🇸", electricityAccess: "47%", co2PerCapita: "0.1t", epiScore: "Moderate", epiSeverity: "moderate", coordinates: [-29.6100, 28.2336] },
    { name: "Eswatini", flag: "🇸🇿", electricityAccess: "90%", co2PerCapita: "0.8t", epiScore: "Low", epiSeverity: "low", coordinates: [-26.5225, 31.4659] },
    { name: "Mauritius", flag: "🇲🇺", electricityAccess: "100%", co2PerCapita: "3.0t", epiScore: "Minimal", epiSeverity: "minimal", coordinates: [-20.3484, 57.5522] },
    { name: "Seychelles", flag: "🇸🇨", electricityAccess: "100%", co2PerCapita: "4.2t", epiScore: "Minimal", epiSeverity: "minimal", coordinates: [-4.6796, 55.4920] },
    { name: "Cabo Verde", flag: "🇨🇻", electricityAccess: "96%", co2PerCapita: "0.7t", epiScore: "Low", epiSeverity: "low", coordinates: [16.5388, -24.0132] },
    { name: "Comoros", flag: "🇰🇲", electricityAccess: "70%", co2PerCapita: "0.2t", epiScore: "Low", epiSeverity: "low", coordinates: [-11.6455, 43.3332] },
    { name: "São Tomé and Príncipe", flag: "🇸🇹", electricityAccess: "78%", co2PerCapita: "0.4t", epiScore: "Low", epiSeverity: "low", coordinates: [0.1864, 6.6131] },
];

