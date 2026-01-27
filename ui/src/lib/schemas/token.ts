import { z } from 'zod';

// Token type schema
export const tokenTypeSchema = z.enum(['celo-native', 'ethereum-enabled']);
export type TokenType = z.infer<typeof tokenTypeSchema>;

// Token form schema
export const tokenFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(32, 'Token name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Token name can only contain letters, numbers, and spaces'),
  
  symbol: z
    .string()
    .min(1, 'Token symbol is required')
    .max(11, 'Token symbol must be 11 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Token symbol must be uppercase letters and numbers only')
    .transform((val) => val.toUpperCase()),
  
  initialSupply: z
    .string()
    .min(1, 'Initial supply is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Initial supply must be a positive number',
    })
    .refine((val) => Number(val) <= Number.MAX_SAFE_INTEGER, {
      message: 'Initial supply is too large',
    }),
  
  maxSupply: z
    .string()
    .min(1, 'Max supply is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Max supply must be a positive number',
    })
    .refine((val) => Number(val) <= Number.MAX_SAFE_INTEGER, {
      message: 'Max supply is too large',
    }),
  
  decimals: z
    .number()
    .int('Decimals must be a whole number')
    .min(0, 'Decimals must be at least 0')
    .max(18, 'Decimals must be 18 or less'),
}).refine((data) => Number(data.maxSupply) >= Number(data.initialSupply), {
  message: 'Max supply must be greater than or equal to initial supply',
  path: ['maxSupply'],
});

export type TokenFormData = z.infer<typeof tokenFormSchema>;

// Full create token schema (includes token type)
export const createTokenSchema = z.object({
  tokenType: tokenTypeSchema,
  ...tokenFormSchema.shape,
});

export type CreateTokenData = z.infer<typeof createTokenSchema>;

// Default form values
export const defaultTokenFormValues: TokenFormData = {
  name: '',
  symbol: '',
  initialSupply: '',
  maxSupply: '',
  decimals: 18,
};
