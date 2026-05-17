import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchCurrentUser, signIn as apiSignIn } from "./authApi";
import {
  clearAccessToken,
  clearUserEmail,
  getAccessToken,
  getUserEmail,
  setAccessToken,
  setUserEmail,
} from "./authStorage";

type AuthContextValue = {
  isAuthenticated: boolean;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAccessToken());
  const [userEmail, setUserEmailState] = useState<string | null>(getUserEmail());

  useEffect(() => {
    const token = getAccessToken();
    setIsAuthenticated(!!token);

    if (!token) {
      setUserEmailState(null);
      return;
    }

    const storedEmail = getUserEmail();
    if (storedEmail) {
      setUserEmailState(storedEmail);
      return;
    }

    fetchCurrentUser()
      .then((result) => {
        const email = result.data?.email;
        if (email) {
          setUserEmail(email);
          setUserEmailState(email);
        }
      })
      .catch(() => {
        clearAccessToken();
        clearUserEmail();
        setIsAuthenticated(false);
        setUserEmailState(null);
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiSignIn(email, password);
    if (!result.data?.access_token) {
      throw new Error("Sign in failed");
    }
    setAccessToken(result.data.access_token);
    const signedInEmail = result.data.user?.email ?? email.trim();
    setUserEmail(signedInEmail);
    setUserEmailState(signedInEmail);
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    clearAccessToken();
    clearUserEmail();
    setIsAuthenticated(false);
    setUserEmailState(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, userEmail, signIn, signOut }),
    [isAuthenticated, userEmail, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
