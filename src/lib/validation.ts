import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export const registerSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const measurementSchema = z.object({
  type: z.enum(["glucemia", "blood_pressure", "weight"], {
    error: "Tipo debe ser glucemia, blood_pressure o weight",
  }),
  value: z.number().optional(),
  systolic: z.number().optional(),
  diastolic: z.number().optional(),
  notes: z.string().optional(),
});

export const deviceTokenSchema = z.object({
  token: z.string().min(16).max(512),
  platform: z.enum(["ios", "android", "web"]),
});
