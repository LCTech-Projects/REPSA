import {
  HiOutlineBeaker,
  HiOutlineChartBarSquare,
  HiOutlineGlobeAlt,
} from "react-icons/hi2";
import type { IconType } from "react-icons";

export const features=[
    {
        icon: "/images/electricityAccess.png",
        text: "Electricity Access",
        subtext: "About 43% of the population in sub-Saharan Africa lacks access to electricity, forcing them to rely on traditional and inefficiency energy sources"
    },
    {
        icon: "/images/cleanCooking.png",
        text: "Clean Cooking",
        subtext: "Nearly 80% of households in sub-Saharan Africa still rely on wood, charcoal, and other harmful fuels for cooking,posing serious health risks."
    },
    {
        icon: "/images/regionalComparison.png",
        text: "Regional Comparison",
        subtext: "There are 3 in 5 Africans with limited access to electricity. Sub-Sanara Africa still lags behind other regions, with urgent needs for universal access"
    }
]


export const explore=[
    {
        icon: "/images/mapExplore.png",
        tag: "Most Popular",
        text: "Explore the Map",
        subtext: "Visualize energy access across Africa with interactive data layers and regional insights.",
        features: ["Real-time data", "Interactive filters", "Satellite Overlays"],
        actionLabel: "Start Exploring",
        actionLink: "/in/map"
    },
    {
        icon: "/images/simulationExplore.png",
        text: "Run Simulation",
        subtext: "Model energy scenario and forecast future needs with advanced simulation tools",
        features: ["Scenario", "Simulations"],
        actionLabel: "Launch",
        actionLink: "/in/simulation"
    },
    {
        icon: "/images/visualizationExplore.png",
        text: "Visualization",
        subtext: "Interactive charts and graphs that reveal data trends, anomalies and insights.",
        features: ["Charts", "Graphs"],
        actionLabel: "Create",
        actionLink: "/in/visualization"
    },
    {
        icon: "/images/compareExplore.png",
        text: "Compare Countries",
        subtext: "side-by-side comparison of energy across multiple african countries.",
        features: ["Comparison Table"],
        actionLabel: "Compare Now",
        actionLink: "/in/compare"
    },
    
]


export const pillars: {
    icon: IconType;
    title: string;
    body: string;
}[] = [
    {
        icon: HiOutlineGlobeAlt,
        title: "Explore with confidence",
        body: "Maps, yearly and hourly views, and country comparisons help you see access, demand, and poverty patterns across Africa.",
    },
    {
        icon: HiOutlineChartBarSquare,
        title: "Plan with evidence",
        body: "Run scenarios on harmonised data so you can test policy choices before they reach the grid or the budget.",
    },
    {
        icon: HiOutlineBeaker,
        title: "Built on open methods",
        body: "Documented sources, transparent processing, and downloadable outputs you can cite in research and policy work.",
    },
]


export const yearFilterLimit=2023