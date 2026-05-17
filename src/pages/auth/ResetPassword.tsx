import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthField } from "../../components/inputs/AuthField";
import { AuthButton } from "../../components/buttons/AuthButton";
import { AuthFooter } from "../../components/cards/AuthFooter";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "../../components/utils/Validations";
import { resetPassword } from "../../app/authApi";
import { useAppSelector } from "../../app/hooks";
import { selectPendingEmail } from "../../app/appSlices/generalSlice";

const ResetPassword = () => {
  const navigate = useNavigate();
  const email = useAppSelector(selectPendingEmail);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      code: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!email) {
      navigate("/forgot-password");
      return;
    }

    setApiError(null);
    setLoading(true);
    try {
      await resetPassword(email, data.code, data.password);
      navigate("/password-updated");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading
        title="Create a new password"
        description="Choose a strong password to secure your account."
      />

      {apiError && (
        <p className="text-sm text-red-600 text-center font-inter">{apiError}</p>
      )}

      <AuthField
        control={control}
        name="code"
        label="Reset code"
        otp
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
      />

      <AuthField
        control={control}
        name="password"
        label="New password"
        pass
        autoComplete="new-password"
      />

      <AuthField
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        pass
        autoComplete="new-password"
      />

      <AuthButton type="submit" loading={loading}>
        Reset Password
      </AuthButton>

      <AuthFooter backTo="/sign-in" />
    </form>
  );
};

export default ResetPassword;
