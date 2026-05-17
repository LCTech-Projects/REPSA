import { z } from "zod";

const passwordField = z
  .string()
  .min(1, { message: "Password is required" })
  .refine(
    (value) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(value ?? ""),
    "Password must have at least 8 characters, one digit, and one uppercase letter",
  );

export const signUpSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: passwordField,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Both passwords must match",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

export type SignInFormValues = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const verifyEmailSchema = z.object({
  code: z
    .string()
    .min(1, "Verification code is required")
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;

export const resetPasswordSchema = z
  .object({
    code: z
      .string()
      .min(1, "Reset code is required")
      .length(6, "Code must be exactly 6 digits")
      .regex(/^\d+$/, "Code must contain only numbers"),
    password: passwordField,
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Both passwords must match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
