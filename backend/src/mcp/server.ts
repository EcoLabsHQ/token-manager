import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTokenLogo, getTokenLogosByChain, TokenLogo, getPromoCode } from "../db.js";
import { pinMetadata, pinTokenAssets, getFromIPFS, type TokenMetadata } from "../services/pinata.js";
import { createPromoSignature, getSignerAddress } from "../services/signer.js";
import { ethers } from "ethers";

// R2 bucket base URL for token logos
const R2_PUBLIC_URL = "https://pub-3e106f2284d449d682bad32c5eeb3490.r2.dev";

// Subgraph URLs for querying on-chain data
const SUBGRAPH_URLS: Record<number, string> = {
  42220: "https://api.studio.thegraph.com/query/72352/minter-celo/version/latest",
  1: "https://api.studio.thegraph.com/query/72352/minter-ethereum/version/latest",
};

// Factory contract addresses — same address deployed on all supported chains
// Source: subgraph/config/celo.json + subgraph/config/ethereum.json
const FACTORY_ADDRESS = "0x1b23DCe73c327f8e07E45fe3a1605DAfd8286aB4";

const FACTORY_ADDRESSES: Record<number, { l2?: string; l1?: string }> = {
  42220: { l2: FACTORY_ADDRESS }, // L2SuperChainTokenFactory on Celo
  1:     { l1: FACTORY_ADDRESS }, // L1TokenFactory on Ethereum
};

// Map chainId → promo code suffix (_ETH, _CELO, etc.)
const CHAIN_PROMO_SUFFIX: Record<number, string> = {
  1: "_ETH",         // Ethereum Mainnet
  11155111: "_ETH",  // Ethereum Sepolia
  42220: "_CELO",    // Celo
  44787: "_CELO",    // Celo Alfajores
};

// Chain metadata (mainnet + testnets)
const SUPPORTED_CHAINS = [
  {
    chainId: 42220,
    name: "Celo",
    symbol: "CELO",
    type: "L2",
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
    factoryType: "L2SuperChainTokenFactory",
    factoryAddress: FACTORY_ADDRESS,
  },
  {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    type: "L1",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    factoryType: "L1TokenFactory",
    factoryAddress: FACTORY_ADDRESS,
  },
];

// Subgraph response types
interface SubgraphToken {
  id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  totalSupply: string;
  totalUniqueHolders: string;
  totalTransfers: string;
  totalBridges?: string;
  owner: string;
  metadataURI?: string;
  remoteToken?: string;
  bridge?: string;
  createdAt: string;
  createdAtBlock: string;
  createdTxHash: string;
  holders?: Array<{ holder: string; balance: string }>;
  transfers?: Array<{ from: string; to: string; value: string; blockTimestamp: string; transactionHash: string }>;
}

interface TokensResponse {
  tokens: SubgraphToken[];
}

interface TokenResponse {
  token: SubgraphToken | null;
}

/**
 * Query subgraph for token data
 */
async function querySubgraph<T>(chainId: number, query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = SUBGRAPH_URLS[chainId];
  if (!url) {
    throw new Error(`No subgraph URL configured for chain ${chainId}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph query failed: ${response.statusText}`);
  }

  const result = (await response.json()) as { data?: T; errors?: unknown[] };
  if (result.errors) {
    throw new Error(`Subgraph error: ${JSON.stringify(result.errors)}`);
  }

  return result.data as T;
}

/**
 * Creates and configures the MCP server with comprehensive token management tools
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "token-minter",
    version: "2.0.0",
  });

  // ============================================
  //         INFORMATION & DISCOVERY
  // ============================================

  // Tool: Get supported chains and factory info
  server.registerTool(
    "get_supported_chains",
    {
      description: "Get information about all supported blockchain networks for token creation, including chain IDs, factory addresses, and RPC URLs",
      inputSchema: {},
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                chains: SUPPORTED_CHAINS,
                factories: FACTORY_ADDRESSES,
                description: "Use Celo (chainId: 42220) for L2 SuperChain tokens with interoperability. Use Ethereum (chainId: 1) for L1 tokens with bridge support.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: Get token creation parameters
  server.registerTool(
    "get_token_creation_params",
    {
      description: "Get the required parameters and ABI for creating a token on a specific chain. Returns the factory address, ABI fragment, and required parameters.",
      inputSchema: {
        chainId: z
          .number()
          .int()
          .positive()
          .describe("The blockchain chain ID (42220 for Celo, 1 for Ethereum)"),
      },
    },
    async ({ chainId }) => {
      const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
      if (!chain) {
        return {
          content: [
            {
              type: "text",
              text: `Chain ${chainId} is not supported. Supported chains: ${SUPPORTED_CHAINS.map((c) => `${c.name} (${c.chainId})`).join(", ")}`,
            },
          ],
        };
      }

      const factoryABI = {
        L2SuperChainTokenFactory: [
          "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
          "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
          "function creationFee() view returns (uint256)",
          "function feeRecipient() view returns (address)",
        ],
        L1TokenFactory: [
          "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
          "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
          "function creationFee() view returns (uint256)",
        ],
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                chainId,
                chainName: chain.name,
                factoryType: chain.factoryType,
                factoryAddress: chain.factoryAddress,
                rpcUrl: chain.rpcUrl,
                explorerUrl: chain.explorerUrl,
                abi: factoryABI[chain.factoryType as keyof typeof factoryABI],
                requiredParams: {
                  owner_: "Address that will own the token",
                  name_: "Token name (e.g., 'My Token')",
                  symbol_: "Token symbol (e.g., 'MTK')",
                  decimals_: "Number of decimals (usually 18)",
                  initialSupply_: "Initial supply in wei (use ethers.parseUnits)",
                  maxSupply_: "Maximum supply in wei (0 for unlimited)",
                  metadataURI_: "IPFS URI for metadata (use pin_token_metadata tool first)",
                },
                payableAmount: "Must send creationFee() amount in native token (CELO or ETH)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============================================
  //         TOKEN QUERYING (SUBGRAPH)
  // ============================================

  // Tool: List tokens on a chain
  server.registerTool(
    "list_tokens",
    {
      description: "List all tokens created through the factory on a specific chain. Returns token addresses, names, symbols, supplies, and creation info.",
      inputSchema: {
        chainId: z
          .number()
          .int()
          .positive()
          .describe("The blockchain chain ID (42220 for Celo, 1 for Ethereum)"),
        first: z.number().int().min(1).max(100).default(10).describe("Number of tokens to return (max 100)"),
        skip: z.number().int().min(0).default(0).describe("Number of tokens to skip (for pagination)"),
        orderBy: z.enum(["createdAt", "totalSupply", "name"]).default("createdAt").describe("Field to order by"),
        orderDirection: z.enum(["asc", "desc"]).default("desc").describe("Order direction"),
      },
    },
    async ({ chainId, first, skip, orderBy, orderDirection }) => {
      try {
        const query = `
          query GetTokens($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
            tokens(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
              id
              tokenAddress
              name
              symbol
              decimals
              initialSupply
              maxSupply
              totalSupply
              totalUniqueHolders
              totalTransfers
              owner
              metadataURI
              createdAt
              createdAtBlock
              createdTxHash
            }
          }
        `;

        const data = await querySubgraph<TokensResponse>(chainId, query, { first, skip, orderBy, orderDirection });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  totalReturned: data.tokens.length,
                  tokens: data.tokens,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error listing tokens: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool: Get token details
  server.registerTool(
    "get_token_details",
    {
      description: "Get detailed information about a specific token including metadata, holders, and recent transfers",
      inputSchema: {
        chainId: z
          .number()
          .int()
          .positive()
          .describe("The blockchain chain ID"),
        tokenAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("The token contract address"),
      },
    },
    async ({ chainId, tokenAddress }) => {
      try {
        const query = `
          query GetToken($id: Bytes!) {
            token(id: $id) {
              id
              tokenAddress
              name
              symbol
              decimals
              initialSupply
              maxSupply
              totalSupply
              totalUniqueHolders
              totalTransfers
              totalBridges
              owner
              metadataURI
              remoteToken
              bridge
              createdAt
              createdAtBlock
              createdTxHash
              holders(first: 10, orderBy: balance, orderDirection: desc) {
                holder
                balance
              }
              transfers(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
                from
                to
                value
                blockTimestamp
                transactionHash
              }
            }
          }
        `;

        const data = await querySubgraph<TokenResponse>(chainId, query, { id: tokenAddress.toLowerCase() });

        if (!data.token) {
          return {
            content: [
              {
                type: "text",
                text: `Token ${tokenAddress} not found on chain ${chainId}`,
              },
            ],
          };
        }

        // Try to fetch logo
        const logo = await getTokenLogo(tokenAddress, chainId);
        const logoUrl = logo ? `${R2_PUBLIC_URL}/${logo.file_key}` : null;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...data.token,
                  logoUrl,
                  explorerUrl: `${SUPPORTED_CHAINS.find((c) => c.chainId === chainId)?.explorerUrl}/token/${tokenAddress}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error fetching token details: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool: Get tokens by owner
  server.registerTool(
    "get_tokens_by_owner",
    {
      description: "Get all tokens owned by a specific address on a chain",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID"),
        ownerAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("The owner's wallet address"),
      },
    },
    async ({ chainId, ownerAddress }) => {
      try {
        const query = `
          query GetTokensByOwner($owner: Bytes!) {
            tokens(where: { owner: $owner }) {
              id
              tokenAddress
              name
              symbol
              decimals
              totalSupply
              maxSupply
              metadataURI
              createdAt
            }
          }
        `;

        const data = await querySubgraph<TokensResponse>(chainId, query, { owner: ownerAddress.toLowerCase() });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  owner: ownerAddress,
                  tokenCount: data.tokens.length,
                  tokens: data.tokens,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error fetching tokens by owner: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  //         METADATA & IPFS
  // ============================================

  // Tool: Pin token metadata to IPFS
  server.registerTool(
    "pin_token_metadata",
    {
      description: "Pin token metadata JSON to IPFS via Pinata. Returns the IPFS URI to use when creating a token. Optionally include a base64 encoded image.",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Token name"),
        symbol: z.string().min(1).max(20).describe("Token symbol"),
        decimals: z.number().int().min(0).max(18).describe("Number of decimals"),
        description: z.string().max(1000).optional().describe("Token description"),
        externalLink: z.string().url().optional().describe("External website URL"),
        imageBase64: z.string().optional().describe("Base64 encoded image (optional)"),
        imageFilename: z.string().optional().describe("Image filename with extension"),
        imageContentType: z
          .enum(["image/png", "image/jpeg", "image/svg+xml", "image/webp"])
          .optional()
          .describe("Image MIME type"),
        properties: z
          .object({
            maxSupply: z.string().optional(),
            initialSupply: z.string().optional(),
            creator: z.string().optional(),
            chainId: z.number().optional(),
          })
          .passthrough()
          .optional()
          .describe("Additional properties"),
      },
    },
    async ({ name, symbol, decimals, description, externalLink, imageBase64, imageFilename, imageContentType, properties }) => {
      try {
        let imageBuffer: Buffer | undefined;

        if (imageBase64 && imageFilename && imageContentType) {
          // Remove data URL prefix if present
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          imageBuffer = Buffer.from(base64Data, "base64");
        }

        const metadata: Omit<TokenMetadata, "image"> = {
          name,
          symbol,
          description,
          decimals,
          external_link: externalLink,
          properties,
        };

        const result = await pinTokenAssets(metadata, imageBuffer, imageFilename, imageContentType);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  metadataURI: result.metadataURI,
                  cid: result.cid,
                  gatewayUrl: result.gatewayUrl,
                  imageURI: result.imageURI,
                  usage: `Use the metadataURI value (${result.metadataURI}) as the metadataURI_ parameter when calling createToken`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error pinning metadata: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool: Get metadata from IPFS
  server.registerTool(
    "get_token_metadata",
    {
      description: "Retrieve token metadata from IPFS given a CID or IPFS URI",
      inputSchema: {
        ipfsUri: z
          .string()
          .describe("IPFS URI (ipfs://...) or CID"),
      },
    },
    async ({ ipfsUri }) => {
      try {
        // Extract CID from URI if needed
        const cid = ipfsUri.replace("ipfs://", "");
        const data = await getFromIPFS(cid);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error fetching metadata from IPFS: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  //         PROMO CODES
  // ============================================

  // Tool: Validate promo code
  server.registerTool(
    "validate_promo_code",
    {
      description: "Validate a promotional code and get a signature for discounted token creation. Returns the signature data needed for createTokenWithPromo. The code can be provided without a chain suffix (e.g. 'LAUNCH') and the correct chain-specific variant (e.g. 'LAUNCH:42220') will be resolved automatically using the chainId.",
      inputSchema: {
        code: z.string().min(1).max(50).describe("The promotional code"),
        userAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("The user's wallet address"),
        chainId: z.number().int().positive().describe("The chain ID where the token will be created"),
      },
    },
    async ({ code, userAddress, chainId }) => {
      try {
        const factory = FACTORY_ADDRESSES[chainId];
        if (!factory) {
          return {
            content: [
              {
                type: "text",
                text: `Chain ${chainId} is not supported`,
              },
            ],
          };
        }

        const factoryAddress = factory.l2 || factory.l1;
        if (!factoryAddress) {
          return {
            content: [
              {
                type: "text",
                text: `No factory address configured for chain ${chainId}`,
              },
            ],
          };
        }

        // Check promo code: try with chain suffix first (e.g. CODE_CELO / CODE_ETH), then the bare code
        const codeUpper = code.toUpperCase();
        const chainSuffix = CHAIN_PROMO_SUFFIX[chainId];
        const codeWithChain = chainSuffix ? `${codeUpper}${chainSuffix}` : codeUpper;
        let promoCode = codeWithChain !== codeUpper ? await getPromoCode(codeWithChain) : null;
        const resolvedCode = promoCode ? codeWithChain : codeUpper;
        if (!promoCode) {
          promoCode = await getPromoCode(codeUpper);
        }

        if (!promoCode) {
          return {
            content: [
              {
                type: "text",
                text: `Promo code "${code}" not found for chain ${chainId}${chainSuffix ? ` (tried "${codeWithChain}" and "${codeUpper}")` : ""}`,
              },
            ],
          };
        }

        if (!promoCode.is_active) {
          return {
            content: [
              {
                type: "text",
                text: `Promo code "${code}" is no longer active`,
              },
            ],
          };
        }

        const now = Math.floor(Date.now() / 1000);
        if (promoCode.expires_at <= now) {
          return {
            content: [
              {
                type: "text",
                text: `Promo code "${code}" has expired`,
              },
            ],
          };
        }

        if (promoCode.current_uses >= promoCode.max_uses) {
          return {
            content: [
              {
                type: "text",
                text: `Promo code "${code}" has reached maximum uses`,
              },
            ],
          };
        }

        // Generate nonce
        const promoNonce = ethers.keccak256(
          ethers.solidityPacked(["string", "address", "uint256", "uint256"], [resolvedCode, userAddress, chainId, Date.now()])
        );

        // Create signature
        const signatureResult = await createPromoSignature({
          userAddress,
          promoFee: promoCode.discount_fee,
          promoNonce,
          expiresAt: promoCode.expires_at,
          chainId,
          factoryAddress,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  promoFee: promoCode.discount_fee,
                  promoNonce,
                  expiresAt: promoCode.expires_at,
                  signature: signatureResult.signature,
                  signerAddress: await getSignerAddress(),
                  usage: "Pass these values to the build_create_token_transaction tool: promoFee, promoNonce, expiresAt, signature. Or simply pass the promoCode directly to build_create_token_transaction and it will validate automatically.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error validating promo code: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  //         TOKEN LOGOS
  // ============================================

  // Tool: Get token logo URL by chain and address
  server.registerTool(
    "get_token_logo",
    {
      description: "Get the logo URL for a specific token by its chain ID and contract address",
      inputSchema: {
        chainId: z
          .number()
          .int()
          .positive()
          .describe("The blockchain chain ID (e.g., 1 for Ethereum, 42220 for Celo)"),
        tokenAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("The token contract address (0x prefixed, 40 hex characters)"),
      },
    },
    async ({ chainId, tokenAddress }) => {
      try {
        const logo = await getTokenLogo(tokenAddress, chainId);

        if (!logo) {
          return {
            content: [
              {
                type: "text",
                text: `No logo found for token ${tokenAddress} on chain ${chainId}`,
              },
            ],
          };
        }

        const logoUrl = `${R2_PUBLIC_URL}/${logo.file_key}`;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  tokenAddress: logo.token_address,
                  chainId: logo.chain_id,
                  logoUrl,
                  contentType: logo.content_type,
                  fileSize: logo.file_size,
                  updatedAt: logo.updated_at,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error fetching token logo: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Tool: List all token logos for a chain
  server.registerTool(
    "list_token_logos",
    {
      description: "List all tokens with logos registered on a specific blockchain",
      inputSchema: {
        chainId: z
          .number()
          .int()
          .positive()
          .describe("The blockchain chain ID (e.g., 1 for Ethereum, 42220 for Celo)"),
      },
    },
    async ({ chainId }) => {
      try {
        const logos = await getTokenLogosByChain(chainId);

        if (logos.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No tokens with logos found on chain ${chainId}`,
              },
            ],
          };
        }

        const formattedLogos = logos.map((logo: TokenLogo) => ({
          tokenAddress: logo.token_address,
          logoUrl: `${R2_PUBLIC_URL}/${logo.file_key}`,
          contentType: logo.content_type,
          fileSize: logo.file_size,
          updatedAt: logo.updated_at,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  totalTokens: logos.length,
                  tokens: formattedLogos,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error listing token logos: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  //         TRANSACTION BUILDING
  // ============================================

  // Tool: Build create token transaction
  server.registerTool(
    "build_create_token_transaction",
    {
      description:
        "Build a ready-to-sign transaction for creating a new ERC-20 token. Automatically fetches the current creation fee from the factory contract and includes it as the transaction value. Returns complete transaction data (to, data, value, chainId, rpcUrl) plus step-by-step instructions for signing with ethers.js, viem, or cast. Supports promo codes: either pass a promoCode string for automatic validation, or pass the individual promo fields (promoFee, promoNonce, expiresAt, signature) obtained previously from validate_promo_code.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID (42220 for Celo, 1 for Ethereum)"),
        owner: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("Address that will own the token (the agent's wallet address)"),
        name: z.string().min(1).max(100).describe("Token name (e.g. 'Community Token')"),
        symbol: z.string().min(1).max(20).describe("Token symbol (e.g. 'COMM')"),
        decimals: z.number().int().min(0).max(18).default(18).describe("Number of decimals (default 18)"),
        initialSupply: z.string().describe("Initial supply in token units, e.g. '1000000' (not wei)"),
        maxSupply: z.string().default("0").describe("Maximum supply in token units (0 = unlimited)"),
        metadataURI: z.string().describe("IPFS URI for token metadata — use pin_token_metadata first to get this"),
        // Promo code shortcut: pass the code and it will be validated automatically
        promoCode: z.string().optional().describe("Promotional code for discounted creation. If provided, it will be validated automatically and the discounted fee applied — no need to call validate_promo_code first."),
        // Optional pre-validated promo params (from validate_promo_code)
        promoFee: z.string().optional().describe("Discounted fee in wei (from validate_promo_code — not needed if promoCode is provided)"),
        promoNonce: z.string().optional().describe("Promo nonce (from validate_promo_code — not needed if promoCode is provided)"),
        expiresAt: z.number().optional().describe("Promo expiration timestamp (from validate_promo_code — not needed if promoCode is provided)"),
        signature: z.string().optional().describe("Promo signature (from validate_promo_code — not needed if promoCode is provided)"),
      },
    },
    async ({
      chainId,
      owner,
      name,
      symbol,
      decimals,
      initialSupply,
      maxSupply,
      metadataURI,
      promoCode,
      promoFee,
      promoNonce,
      expiresAt,
      signature,
    }) => {
      try {
        const factory = FACTORY_ADDRESSES[chainId];
        if (!factory) {
          return {
            content: [{ type: "text", text: `Chain ${chainId} is not supported` }],
          };
        }

        const factoryAddress = factory.l2 || factory.l1;
        if (!factoryAddress) {
          return {
            content: [{ type: "text", text: `No factory address configured for chain ${chainId}` }],
          };
        }

        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
        if (!chain) {
          return {
            content: [{ type: "text", text: `Chain metadata not found for ${chainId}` }],
          };
        }

        // If a promoCode string was provided, validate it now and derive promo params
        if (promoCode && !(promoFee && promoNonce && expiresAt && signature)) {
          // Apply chain suffix (_CELO / _ETH) the same way validate_promo_code does
          const codeUpper = promoCode.toUpperCase();
          const suffix = CHAIN_PROMO_SUFFIX[chainId];
          const codeWithSuffix = suffix ? `${codeUpper}${suffix}` : codeUpper;
          let dbPromo = suffix ? await getPromoCode(codeWithSuffix) : null;
          const resolvedPromoCode = dbPromo ? codeWithSuffix : codeUpper;
          if (!dbPromo) dbPromo = await getPromoCode(codeUpper);

          if (!dbPromo) {
            return { content: [{ type: "text", text: `Promo code "${promoCode}" not found for chain ${chainId}${suffix ? ` (tried "${codeWithSuffix}" and "${codeUpper}")` : ""}` }] };
          }
          if (!dbPromo.is_active) {
            return { content: [{ type: "text", text: `Promo code "${promoCode}" is no longer active` }] };
          }
          const now = Math.floor(Date.now() / 1000);
          if (dbPromo.expires_at <= now) {
            return { content: [{ type: "text", text: `Promo code "${promoCode}" has expired` }] };
          }
          if (dbPromo.current_uses >= dbPromo.max_uses) {
            return { content: [{ type: "text", text: `Promo code "${promoCode}" has reached maximum uses` }] };
          }

          const derivedNonce = ethers.keccak256(
            ethers.solidityPacked(
              ["string", "address", "uint256", "uint256"],
              [resolvedPromoCode, owner, chainId, Date.now()]
            )
          );
          const signatureResult = await createPromoSignature({
            userAddress: owner,
            promoFee: dbPromo.discount_fee,
            promoNonce: derivedNonce,
            expiresAt: dbPromo.expires_at,
            chainId,
            factoryAddress,
          });

          promoFee = dbPromo.discount_fee;
          promoNonce = derivedNonce;
          expiresAt = dbPromo.expires_at;
          signature = signatureResult.signature;
        }

        // Parse supplies to wei
        // maxSupply=0 means unlimited → map to uint256 max so the contract doesn't revert
        const initialSupplyWei = ethers.parseUnits(initialSupply, decimals);
        const maxSupplyWei = maxSupply === "0" ? ethers.MaxUint256 : ethers.parseUnits(maxSupply, decimals);

        // Build ABI interface
        const iface = new ethers.Interface([
          "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
          "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
        ]);

        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        let data: string;
        let value: string;
        let feeFormatted: string;

        if (promoFee && promoNonce && expiresAt && signature) {
          // Promo path: fee comes from validate_promo_code or inline validation
          data = iface.encodeFunctionData("createTokenWithPromo", [
            owner, name, symbol, decimals,
            initialSupplyWei, maxSupplyWei, metadataURI,
            BigInt(promoFee), promoNonce, expiresAt, signature,
          ]);
          value = promoFee;
          feeFormatted = ethers.formatEther(BigInt(promoFee)) + " " + chain.symbol + " (promo price)";
        } else {
          // Standard path: fetch real creation fee from contract
          const factoryContract = new ethers.Contract(
            factoryAddress,
            ["function creationFee() view returns (uint256)"],
            provider
          );
          const fee: bigint = await factoryContract.creationFee();
          data = iface.encodeFunctionData("createToken", [
            owner, name, symbol, decimals,
            initialSupplyWei, maxSupplyWei, metadataURI,
          ]);
          value = fee.toString();
          feeFormatted = ethers.formatEther(fee) + " " + chain.symbol;
        }

        // Simulate the transaction to get an accurate gas estimate (+20% safety buffer)
        let gasLimit: string;
        let gasEstimateNote: string;
        try {
          const estimated = await provider.estimateGas({
            from: owner,
            to: factoryAddress,
            data,
            value: BigInt(value),
          });
          const withBuffer = (estimated * 120n) / 100n;
          gasLimit = withBuffer.toString();
          gasEstimateNote = `Simulated: ${estimated.toString()} gas, +20% buffer applied`;
        } catch (simErr) {
          gasLimit = "800000";
          gasEstimateNote = `Simulation failed (${simErr instanceof Error ? simErr.message : simErr}), using safe fallback of 800000`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  // ── Ready-to-sign transaction ──────────────────────────
                  transaction: {
                    chainId,
                    to: factoryAddress,
                    data,
                    value,
                    gasLimit,
                  },
                  // ── Context ───────────────────────────────────────────
                  rpcUrl: chain.rpcUrl,
                  explorerUrl: chain.explorerUrl,
                  creationFee: feeFormatted,
                  gasEstimate: gasEstimateNote,
                  // ── How to send (for the agent) ───────────────────────
                  how_to_send: {
                    note: "The MCP server never handles private keys. Sign and broadcast the transaction from your own wallet using one of the methods below.",
                    ethers_js: [
                      `const provider = new ethers.JsonRpcProvider("${chain.rpcUrl}");`,
                      `const wallet = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);`,
                      `const tx = await wallet.sendTransaction({ to: "${factoryAddress}", data: "<data above>", value: ${value}n, gasLimit: ${gasLimit}n });`,
                      `const receipt = await tx.wait();`,
                      `console.log("Token created! TX:", receipt.hash);`,
                    ].join("\n"),
                    viem: [
                      `const hash = await walletClient.sendTransaction({ to: "${factoryAddress}", data: "<data above>", value: ${value}n, gas: ${gasLimit}n, chain: { id: ${chainId} } });`,
                    ].join("\n"),
                    cast: `cast send ${factoryAddress} --data <data above> --value ${value} --gas-limit ${gasLimit} --rpc-url ${chain.rpcUrl} --private-key $PRIVATE_KEY`,
                  },
                  // ── Human-readable params ─────────────────────────────
                  params: {
                    owner, name, symbol, decimals, initialSupply, maxSupply, metadataURI,
                    ...(promoFee && promoNonce && expiresAt && signature
                      ? { promoCode: promoCode ?? "(pre-validated)", promoFee, promoNonce, expiresAt }
                      : {}),
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error building transaction: ${errorMessage}` }],
        };
      }
    }
  );

  // ============================================
  //         ON-CHAIN READS
  // ============================================

  // Tool: Query creation fee from factory contract
  server.registerTool(
    "get_creation_fee",
    {
      description:
        "Query the factory contract on-chain to get the current token creation fee. Returns the fee in wei and human-readable format. The fee must be sent as the transaction value when creating a token.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID (42220 for Celo, 1 for Ethereum)"),
      },
    },
    async ({ chainId }) => {
      try {
        const factory = FACTORY_ADDRESSES[chainId];
        if (!factory) {
          return {
            content: [{ type: "text", text: `Chain ${chainId} is not supported` }],
          };
        }

        const factoryAddress = factory.l2 || factory.l1;
        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
        if (!chain || !factoryAddress) {
          return {
            content: [{ type: "text", text: `No factory address configured for chain ${chainId}` }],
          };
        }

        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const factoryContract = new ethers.Contract(
          factoryAddress,
          ["function creationFee() view returns (uint256)"],
          provider
        );

        const fee: bigint = await factoryContract.creationFee();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  chainName: chain.name,
                  factoryAddress,
                  creationFeeWei: fee.toString(),
                  creationFeeFormatted: ethers.formatEther(fee) + " " + chain.symbol,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text",
              text: `Error fetching creation fee: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // ============================================
  //         WALLET & TRANSACTION TOOLS
  // ============================================

  // Tool: Get native balance of a wallet
  server.registerTool(
    "get_wallet_balance",
    {
      description: "Get the native token balance (CELO or ETH) of a wallet address on a given chain. Useful to check if there are enough funds before creating a token.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID (42220 for Celo, 1 for Ethereum)"),
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("Wallet address to check"),
      },
    },
    async ({ chainId, address }) => {
      try {
        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
        if (!chain) {
          return { content: [{ type: "text", text: `Chain ${chainId} is not supported` }] };
        }
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const balanceWei = await provider.getBalance(address);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  chainName: chain.name,
                  address,
                  balanceWei: balanceWei.toString(),
                  balanceFormatted: ethers.formatEther(balanceWei) + " " + chain.symbol,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error fetching balance: ${error instanceof Error ? error.message : error}` }] };
      }
    }
  );

  // Tool: Estimate gas for an arbitrary transaction
  server.registerTool(
    "estimate_gas",
    {
      description: "Simulate a transaction on-chain and return the estimated gas units required, plus a recommended gasLimit with a 20% safety buffer.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID"),
        from: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Sender address"),
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Recipient / contract address"),
        data: z.string().describe("Encoded calldata (0x prefixed)"),
        value: z.string().default("0").describe("Value in wei"),
      },
    },
    async ({ chainId, from, to, data, value }) => {
      try {
        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
        if (!chain) {
          return { content: [{ type: "text", text: `Chain ${chainId} is not supported` }] };
        }
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const estimated = await provider.estimateGas({ from, to, data, value: BigInt(value) });
        const withBuffer = (estimated * 120n) / 100n;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  estimatedGas: estimated.toString(),
                  recommendedGasLimit: withBuffer.toString(),
                  note: "recommendedGasLimit = estimatedGas + 20% buffer",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Gas estimation failed (simulation reverted): ${error instanceof Error ? error.message : error}` }] };
      }
    }
  );

  // Tool: Get transaction status and receipt
  server.registerTool(
    "get_transaction_status",
    {
      description: "Fetch the status and receipt of a transaction by hash. If the transaction created a token via the factory, also returns the new token contract address parsed from the TokenCreated event.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID"),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe("Transaction hash (0x prefixed, 64 hex chars)"),
      },
    },
    async ({ chainId, txHash }) => {
      try {
        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
        if (!chain) {
          return { content: [{ type: "text", text: `Chain ${chainId} is not supported` }] };
        }
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "pending", txHash, message: "Transaction not yet mined" }, null, 2) }],
          };
        }

        // Try to extract the created token address from the TokenCreated event
        // event TokenCreated(address indexed tokenAddress, ...)
        const TOKEN_CREATED_TOPIC = ethers.id("TokenCreated(address,string,string,uint256,uint256,uint8,address,string)");
        let tokenAddress: string | null = null;
        for (const log of receipt.logs) {
          if (log.topics[0] === TOKEN_CREATED_TOPIC && log.topics[1]) {
            tokenAddress = ethers.getAddress("0x" + log.topics[1].slice(26));
            break;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  txHash,
                  status: receipt.status === 1 ? "success" : "reverted",
                  blockNumber: receipt.blockNumber,
                  gasUsed: receipt.gasUsed.toString(),
                  ...(tokenAddress ? { tokenAddress, explorerUrl: `${chain.explorerUrl}/token/${tokenAddress}` } : {}),
                  txExplorerUrl: `${chain.explorerUrl}/tx/${txHash}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: `Error fetching transaction: ${error instanceof Error ? error.message : error}` }] };
      }
    }
  );

  return server;
}
