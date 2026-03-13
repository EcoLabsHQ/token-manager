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
    .regex(/^[a-zA-Z0-9]+$/, 'Token symbol must contain letters and numbers only')
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

  tokenLogo: z
    .string()
    .optional(),
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
  tokenLogo: undefined,
};

// ─── Metadata Update Schema ───────────────────────────────────────────────────

const urlOrEmpty = z
  .string()
  .optional()
  .refine((val) => !val || /^https?:\/\/.+/.test(val), {
    message: 'Must be a valid URL (https://...)',
  });

export const metadataUpdateSchema = z.object({
  /** Human-readable description of the token / project */
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),

  /** Official project website, used as the top-level external_link in ERC-7572 */
  external_link: urlOrEmpty,

  /** Project website (stored inside properties) */
  website: urlOrEmpty,

  /** Contact e-mail */
  email: z
    .string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Must be a valid email address',
    }),

  /** Token category — helps explorers classify the token */
  category: z
    .enum(['', 'governance', 'utility', 'currency', 'stablecoin', 'nft', 'defi', 'social', 'other'])
    .optional(),

  /** Comma-separated tags */
  tags: z.string().max(200, 'Tags must be 200 characters or less').optional(),

  /** Twitter / X handle or profile URL */
  social_twitter: z
    .string()
    .max(100)
    .optional(),

  /** Discord server invite link or handle */
  social_discord: z
    .string()
    .max(100)
    .optional(),

  /** Telegram channel or group link */
  social_telegram: z
    .string()
    .max(100)
    .optional(),
});

export type MetadataUpdateFormData = z.infer<typeof metadataUpdateSchema>;

export const defaultMetadataUpdateValues: MetadataUpdateFormData = {
  description: '',
  external_link: '',
  website: '',
  email: '',
  category: '',
  tags: '',
  social_twitter: '',
  social_discord: '',
  social_telegram: '',
};
