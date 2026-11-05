import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export { z };
export function parse<T>(schema: z.ZodType<T>, input: unknown): T { const result = schema.safeParse(input); if (!result.success) throw new BadRequestException(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')); return result.data; }
export const amount = z.number().int().min(0).max(2000000000);
export const identifier = z.string().min(1).max(100);
export const date = z.iso.datetime({offset:true});
