import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTokenLogo, getTokenLogosByChain, TokenLogo, getPromoCode } from "../db.js";
import { pinMetadata, pinTokenAssets, getFromIPFS, type TokenMetadata } from "../services/pinata.js";
import { createPromoSignature, getSignerAddress } from "../services/signer.js";
import { ethers } from "ethers";

// R2 bucket base URL - configure in environment
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "https://tokens.example.com";

// Subgraph URLs for querying on-chain data
const SUBGRAPH_URLS: Record<number, string> = {
  42220: process.env.CELO_SUBGRAPH_URL || "https://api.studio.thegraph.com/query/YOUR_ID/minter-celo/version/latest",
  1: process.env.ETHEREUM_SUBGRAPH_URL || "https://api.studio.thegraph.com/query/YOUR_ID/minter-ethereum/version/latest",
};

// Factory addresses per chain
const FACTORY_ADDRESSES: Record<number, { l2?: string; l1?: string }> = {
  42220: {
    l2: process.env.CELO_L2_FACTORY || "0x...", // L2SuperChainTokenFactory on Celo
  },
  1: {
    l1: process.env.ETHEREUM_L1_FACTORY || "0x...", // L1TokenFactory on Ethereum
  },
};

// Chain metadata
const SUPPORTED_CHAINS = [
  {
    chainId: 42220,
    name: "Celo",
    symbol: "CELO",
    type: "L2",
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
    factoryType: "L2SuperChainTokenFactory",
  },
  {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    type: "L1",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    factoryType: "L1TokenFactory",
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
                factoryAddress: FACTORY_ADDRESSES[chainId],
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
      description: "Validate a promotional code and get a signature for discounted token creation. Returns the signature data needed for createTokenWithPromo.",
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

        // Check promo code
        const promoCode = await getPromoCode(code.toUpperCase());

        if (!promoCode) {
          return {
            content: [
              {
                type: "text",
                text: `Promo code "${code}" not found`,
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
          ethers.solidityPacked(["string", "address", "uint256", "uint256"], [code, userAddress, chainId, Date.now()])
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
                  usage: "Use these values with createTokenWithPromo: promoFee_, promoNonce_, expiresAt_, signature_",
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
      description: "Build a transaction object for creating a new token. Returns the transaction data that can be signed and sent by a wallet.",
      inputSchema: {
        chainId: z.number().int().positive().describe("The blockchain chain ID"),
        owner: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("Address that will own the token"),
        name: z.string().min(1).max(100).describe("Token name"),
        symbol: z.string().min(1).max(20).describe("Token symbol"),
        decimals: z.number().int().min(0).max(18).default(18).describe("Number of decimals"),
        initialSupply: z.string().describe("Initial supply (in token units, e.g., '1000000')"),
        maxSupply: z.string().default("0").describe("Maximum supply (0 for unlimited)"),
        metadataURI: z.string().describe("IPFS URI for token metadata"),
        // Optional promo params
        promoFee: z.string().optional().describe("Promo fee in wei (from validate_promo_code)"),
        promoNonce: z.string().optional().describe("Promo nonce (from validate_promo_code)"),
        expiresAt: z.number().optional().describe("Promo expiration timestamp"),
        signature: z.string().optional().describe("Promo signature (from validate_promo_code)"),
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
      promoFee,
      promoNonce,
      expiresAt,
      signature,
    }) => {
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
        const chain = SUPPORTED_CHAINS.find((c) => c.chainId === chainId);

        // Parse supplies to wei
        const initialSupplyWei = ethers.parseUnits(initialSupply, decimals);
        const maxSupplyWei = maxSupply === "0" ? BigInt(0) : ethers.parseUnits(maxSupply, decimals);

        // Build interface
        const iface = new ethers.Interface([
          "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
          "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
        ]);

        let data: string;
        let value: string;

        if (promoFee && promoNonce && expiresAt && signature) {
          // With promo
          data = iface.encodeFunctionData("createTokenWithPromo", [
            owner,
            name,
            symbol,
            decimals,
            initialSupplyWei,
            maxSupplyWei,
            metadataURI,
            BigInt(promoFee),
            promoNonce,
            expiresAt,
            signature,
          ]);
          value = promoFee;
        } else {
          // Without promo - need to fetch creation fee
          data = iface.encodeFunctionData("createToken", [owner, name, symbol, decimals, initialSupplyWei, maxSupplyWei, metadataURI]);
          // Note: The actual fee should be fetched from the contract
          value = "0"; // Placeholder - agent should call creationFee() on the factory
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId,
                  to: factoryAddress,
                  data,
                  value,
                  gasLimit: "500000", // Estimate
                  rpcUrl: chain?.rpcUrl,
                  note: value === "0" ? "IMPORTANT: You must call creationFee() on the factory contract to get the required value to send" : "Transaction ready to sign",
                  params: {
                    owner,
                    name,
                    symbol,
                    decimals,
                    initialSupplyWei: initialSupplyWei.toString(),
                    maxSupplyWei: maxSupplyWei.toString(),
                    metadataURI,
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
          content: [
            {
              type: "text",
              text: `Error building transaction: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  return server;
}
