import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "./pages/in/home/Home";
import InLayout from "./pages/in/InLayout";
import NotFoundIn from "./pages/in/NotFound";
import NotFoundAuth from "./pages/auth/NotFound";
import AuthLayout from "./pages/auth/AuthLayout";
import SignIn from "./pages/auth/SignIn";
import ForgotPassword from "./pages/auth/ForgotPassword";
import SignUp from "./pages/auth/SignUp";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ResetPassword from "./pages/auth/ResetPassword";
import PasswordUpdated from "./pages/auth/PasswordUpdated";
import { Map } from "./pages/in/Map";
import { Visualization } from "./pages/in/Visualization";
import { Compare } from "./pages/in/Compare";
import { Simulation } from "./pages/in/Simulation";

export const routes = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/in/map" replace />,
  },
  {
    path: "/in",
    element: <InLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="map" replace />,
      },
      {
        path: "home",
        element: <Home />,
      },
      {
        path: "map",
        element: <Map />,
      },
      {
        path: "visualization",
        element: <Visualization />,
      },
      {
        path: "compare",
        element: <Compare />,
      },
      {
        path: "simulation",
        element: <Simulation />,
      },
      {
        path: "*",
        element: <NotFoundIn />,
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/sign-in", element: <SignIn /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/sign-up", element: <SignUp /> },
      { path: "/sign-in/password", element: <Navigate to="/sign-in" replace /> },
      { path: "/sign-up/password", element: <Navigate to="/sign-up" replace /> },
      { path: "/verify-email", element: <VerifyEmail /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/password-updated", element: <PasswordUpdated /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundAuth />,
  },
]);
