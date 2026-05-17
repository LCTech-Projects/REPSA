import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
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
import { useAppDispatch } from "../../app/hooks";
import { setPendingEmail } from "../../app/appSlices/generalSlice";

const SignUp = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
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
      dispatch(setPendingEmail(trimmedEmail));
      navigate("/verify-email");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading
        title="Create your account"
        description="Explore electricity data through Repsa’s modern API, interactive dashboard, and powerful database."
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
