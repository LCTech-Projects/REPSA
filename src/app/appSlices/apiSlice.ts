import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getAccessToken } from "../authStorage";

export const apiSlice = createApi({
  reducerPath: "api",
  refetchOnReconnect: true,
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || "http://127.0.0.1:5000",
    prepareHeaders: (headers) => {
      const token = getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["User"],
  endpoints: (builder) => ({
    getSiteLevelPV: builder.mutation({
      query: (args) => ({
        url: `/get_pv_data`,
        method: "POST",
        body: args,
      }),
    }),
    getSiteLevelWind: builder.mutation({
      query: (args) => ({
        url: `/get_wind_data`,
        method: "POST",
        body: args,
      }),
    }),
    getElectricityDemand: builder.mutation({
      query: (args) => ({
        url: `/get_electricity_demand_data`,
        method: "POST",
        body: args,
      }),
    }),
    getPopulationData: builder.mutation({
      query: (args) => ({
        url: `/get_population_data`,
        method: "POST",
        body: args,
      }),
    }),
    getEnergyUsePerCapitaData: builder.mutation({
      query: (args) => ({
        url: `/get_energy_use_per_capita`,
        method: "POST",
        body: args,
      }),
    }),
    getCountrySummary: builder.query<any, { country: string; year?: number }>({
      query: ({ country, year }) => ({
        url: `/api/historical/country-summary`,
        params: { country, ...(year && { year }) },
      }),
    }),
    getCountryDetails: builder.query<
      any,
      { country: string; start_year?: number; end_year?: number; selected_year?: number }
    >({
      query: ({ country, start_year, end_year, selected_year }) => ({
        url: `/api/historical/country-details`,
        params: {
          country,
          ...(start_year && { start_year }),
          ...(end_year && { end_year }),
          ...(selected_year && { selected_year }),
        },
      }),
    }),
    getAvailableYears: builder.query<any, void>({
      query: () => ({
        url: `/api/historical/available-years`,
      }),
    }),
    getAllCountriesEnergyPoverty: builder.query<any, { year?: number }>({
      query: ({ year }) => ({
        url: `/api/historical/all-countries-energy-poverty`,
        params: year ? { year } : {},
      }),
    }),
    getHourlyElectricityDemand: builder.query<
      any,
      { country: string; date?: string; year?: number }
    >({
      query: ({ country, date, year }) => ({
        url: `/api/historical/hourly-electricity-demand`,
        params: { country, ...(date && { date }), ...(year && { year }) },
      }),
    }),
    getAvailableCountries: builder.query<any, void>({
      query: () => ({
        url: `/api/historical/available-countries`,
      }),
    }),
    getAvailableDates: builder.query<any, { country: string; year?: number }>({
      query: ({ country, year }) => ({
        url: `/api/historical/available-years/${country}`,
        params: year ? { year } : {},
      }),
    }),
    getRealtimeData: builder.query<any, { country: string }>({
      query: ({ country }) => ({
        url: `/api/realtime/realtime-data`,
        params: { country },
      }),
    }),
    analyzePolicy: builder.mutation<
      any,
      { policy_text: string; country?: string; target_year?: number }
    >({
      query: (body) => ({
        url: `/api/story-mode/analyze-policy`,
        method: "POST",
        body,
      }),
    }),
    simulateScenario: builder.mutation<
      any,
      {
        policy_metrics: Record<string, any>;
        country?: string;
        start_year?: number;
        target_year?: number;
      }
    >({
      query: (body) => ({
        url: `/api/story-mode/simulate-scenario`,
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetSiteLevelWindMutation,
  useGetSiteLevelPVMutation,
  useGetElectricityDemandMutation,
  useGetPopulationDataMutation,
  useGetEnergyUsePerCapitaDataMutation,
  useAnalyzePolicyMutation,
  useSimulateScenarioMutation,
} = apiSlice;

export const {
  useGetCountrySummaryQuery,
  useGetCountryDetailsQuery,
  useGetAvailableYearsQuery,
  useGetAllCountriesEnergyPovertyQuery,
  useGetHourlyElectricityDemandQuery,
  useGetAvailableCountriesQuery,
  useGetAvailableDatesQuery,
  useGetRealtimeDataQuery,
} = apiSlice;
