import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthField } from "../../components/inputs/AuthField";
import { AuthButton } from "../../components/buttons/AuthButton";
import { GoogleButton } from "../../components/buttons/GoogleButton";
import { AuthFooter } from "../../components/cards/AuthFooter";
import { AuthLink } from "../../components/AuthLink";
import {
  signInSchema,
  type SignInFormValues,
} from "../../components/utils/Validations";
import { useAuth } from "../../app/AuthContext";
import type {
  ReturnLocationState,
  SignInLocationState,
} from "../../app/authNavigation";

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<SignInFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormValues) => {
    setApiError(null);
    setLoading(true);
    try {
      await signIn(data.email.trim(), data.password);
      const authState = location.state as SignInLocationState | null;
      const from = authState?.from ?? "/in/map";
      const returnState: ReturnLocationState | undefined =
        authState?.pendingDownloadFormat
          ? {
              downloadFormat: authState.pendingDownloadFormat,
              hourlyDownloadScope: authState.pendingHourlyDownloadScope,
            }
          : undefined;
      navigate(from, { replace: true, state: returnState });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading
        title="Sign in to your Account"
        description="Sign in to explore electricity data through Repsa’s modern API, interactive dashboard, and powerful database."
      />

      {apiError && (
        <p className="text-sm text-red-600 text-center font-inter">{apiError}</p>
      )}

      <AuthField
        control={control}
        name="email"
        label="Email Address"
        type="email"
        autoComplete="email"
      />

      <AuthField
        control={control}
        name="password"
        label="Password"
        pass
        autoComplete="current-password"
      />

      <div className="w-full flex justify-end -mt-1 mb-1">
        <AuthLink to="/forgot-password">Forgot password?</AuthLink>
      </div>

      <AuthButton type="submit" loading={loading}>
        Sign in
      </AuthButton>
      <GoogleButton />

      <AuthFooter
        showTerms
        prompt="Don't have an account?"
        actionLabel="Sign up"
        actionTo="/sign-up"
      />
    </form>
  );
};

export default SignIn;
