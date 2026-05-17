import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthField } from "../../components/inputs/AuthField";
import { AuthButton } from "../../components/buttons/AuthButton";
import { AuthFooter } from "../../components/cards/AuthFooter";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "../../components/utils/Validations";
import { forgotPassword } from "../../app/authApi";
import { useAppDispatch } from "../../app/hooks";
import { setPendingEmail } from "../../app/appSlices/generalSlice";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setApiError(null);
    setLoading(true);
    try {
      await forgotPassword(data.email.trim());
      dispatch(setPendingEmail(data.email.trim()));
      navigate("/reset-password");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading
        title="Reset your password"
        description="Enter the email associated with your account. We’ll send you a reset code."
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

      <AuthButton type="submit" loading={loading}>
        Send reset code
      </AuthButton>

      <AuthFooter backTo="/sign-in" showTerms />
    </form>
  );
};

export default ForgotPassword;
