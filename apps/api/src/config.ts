import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgres://heatmap:heatmap@localhost:5432/heatmap'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default('http://localhost:4200'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment);
}
