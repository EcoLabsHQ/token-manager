export type TokenType = 'celo-native' | 'ethereum-enabled';

export interface Token {
  id: string;
  name: string;
  symbol: string;
  type: TokenType;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
  l1Address?: string;
  l2Address: string;
  createdAt: Date;
  tokenLogo?: string;
}

export interface TokenFormData {
  name: string;
  symbol: string;
  initialSupply: string;
  maxSupply: string;
  decimals: number;
  tokenLogo?: string;
}

export type CreateTokenStep = 'choose-type' | 'token-info' | 'review' | 'deploying' | 'success';
