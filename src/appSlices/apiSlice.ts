// Import the RTK Query methods from the React-specific entry point
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
// Define our single API slice object
export const apiSlice = createApi({
  reducerPath: "api",
  refetchOnReconnect: true,
  baseQuery: fetchBaseQuery({
    baseUrl: "http://127.0.0.1:5000",
    prepareHeaders: (headers) => {
        const token="d7f2868e499d27fffb975b1089c667e3c1cd5336"
        headers.set("Authorization", `Bearer ${token}`);
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
  }),
});

export const {

 useGetSiteLevelWindMutation,
 useGetSiteLevelPVMutation,
 useGetElectricityDemandMutation,
 useGetPopulationDataMutation,
 useGetEnergyUsePerCapitaDataMutation

} = apiSlice;
