import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthField } from "../../components/inputs/AuthField";
import { AuthButton } from "../../components/buttons/AuthButton";
import { GoogleButton } from "../../components/buttons/GoogleButton";
import { AuthFooter } from "../../components/cards/AuthFooter";
import {
  signUpSchema,
  type SignUpFormValues,
} from "../../components/utils/Validations";
import { register } from "../../app/authApi";
import { useAuth } from "../../app/AuthContext";
import type {
  ReturnLocationState,
  SignInLocationState,
} from "../../app/authNavigation";

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<SignUpFormValues>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormValues) => {
    const trimmedEmail = data.email.trim();
    setApiError(null);
    setLoading(true);
    try {
      await register(trimmedEmail, data.password);
      await signIn(trimmedEmail, data.password);
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
      setApiError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading title="Create your account" />

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
        autoComplete="new-password"
      />

      <AuthField
        control={control}
        name="confirmPassword"
        label="Confirm Password"
        pass
        autoComplete="new-password"
      />

      <AuthButton type="submit" loading={loading}>
        Sign up
      </AuthButton>
      <GoogleButton />

      <AuthFooter
        showTerms
        prompt="Already have an account?"
        actionLabel="Sign in"
        actionTo="/sign-in"
      />
    </form>
  );
};

export default SignUp;
