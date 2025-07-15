import { useState } from "react";
import {
  useGetElectricityDemandMutation,
  useGetEnergyUsePerCapitaDataMutation,
  useGetPopulationDataMutation,
} from "../appSlices/apiSlice";
import Layout from "../components/Layout";
import {
  electricityDemandArgs,
  energyUseArgs,
  populationArgs,
} from "../components/Utils/Dummy";

const Home = () => {
  const [responseData, setResponseData] = useState(null);
  const [getElectricityDemand, { isLoading: isElectricityDemandLoading }] =
    useGetElectricityDemandMutation();
  const [getPopulationData, { isLoading: isPopulationDataLoading }] =
    useGetPopulationDataMutation();
  const [
    getEnergyUsePerCapitaData,
    { isLoading: isEnergyUsePerCapitaDataLoading },
  ] = useGetEnergyUsePerCapitaDataMutation();

  const fetchElectricityDemandData = async () => {
    try {
      const response = await getElectricityDemand(
        electricityDemandArgs
      ).unwrap();
      setResponseData(response?.data);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchPopolationData = async () => {
    try {
      const response = await getPopulationData(populationArgs).unwrap();
      setResponseData(response?.data);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchEnergyUsePerCapitaData = async () => {
    try {
      const response = await getEnergyUsePerCapitaData(energyUseArgs).unwrap();
      setResponseData(response?.data);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Layout>
      <div className="pt-[70px] px-[24px]">
        <h1 className="text-[24px]">Renewables Ninja Data</h1>
        <div className="flex items-center gap-x-[24px] my-[15px]">
          <button
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            onClick={fetchPopolationData}
          >
            Population Data
          </button>
          <button
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            onClick={fetchElectricityDemandData}
          >
            Electricity Demand Data
          </button>
          <button
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            onClick={fetchEnergyUsePerCapitaData}
          >
            Energy Use Data
          </button>
        </div>

        <div>
          {(isPopulationDataLoading ||
            isElectricityDemandLoading ||
            isEnergyUsePerCapitaDataLoading) &&
            "Loading..."}
        </div>

        {responseData &&
          !isPopulationDataLoading &&
          !isElectricityDemandLoading &&
          !isEnergyUsePerCapitaDataLoading && (
            <div>
              <h3>API Response</h3>
              <pre>{JSON.stringify(responseData, null, 2)}</pre>
            </div>
          )}
      </div>
    </Layout>
  );
};

export default Home;
