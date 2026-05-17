import { routes } from "./Routes";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./app/AuthContext";

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={routes} />
    </AuthProvider>
  );
}

export default App;
