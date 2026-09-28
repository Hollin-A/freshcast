import * as z from "zod";

export const newPasswordSchema = z
  .string()
  .min(8, { error: "Password must be at least 8 characters" });

// POST /api/auth/signup
export const signupRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email({ error: "Please enter a valid email" }),
  password: newPasswordSchema,
});

// Signup form. Unlike the API, the form does not cap `name` at 100 chars.
export const signupFormSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }),
  email: z.email({ error: "Please enter a valid email" }),
  password: newPasswordSchema,
});
export type SignupFormValues = z.infer<typeof signupFormSchema>;

export const loginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email" }),
  password: z.string().min(1, { error: "Password is required" }),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

// POST /api/auth/forgot-password and the forgot-password form
export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Please enter a valid email" }),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

// POST /api/auth/reset-password
export const resetPasswordRequestSchema = z.object({
  email: z.email({ error: "Invalid email" }),
  token: z.string().min(1),
  password: newPasswordSchema,
});

export const resetPasswordFormSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, { error: "Please confirm your password" }),
  })
  .check((ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value.confirmPassword,
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });
    }
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
