import { createBrowserRouter } from "react-router-dom";
import Home from "./Pages/Home";

export const routes = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
]);
