# Token Minter MCP Server

A Model Context Protocol server that provides token creation and management capabilities on Celo and Ethereum networks. This server enables LLMs to create ERC-20 tokens, manage metadata on IPFS, query token information via subgraphs, and generate transaction calldata for blockchain interactions.

## Available Tools

### Information & Discovery

- `get_supported_chains` - Get all supported blockchain networks with chain IDs, factory addresses, and RPC URLs.
  - No arguments required

- `get_token_creation_params` - Get required parameters and ABI for creating a token on a specific chain.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID (42220 for Celo, 1 for Ethereum)

### Token Querying

- `list_tokens` - List all tokens created through the factory on a specific chain.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID
  - Optional arguments:
    - `first` (number): Number of tokens to return (max 100, default 10)
    - `skip` (number): Number of tokens to skip for pagination (default 0)
    - `orderBy` (string): Field to order by ("createdAt", "totalSupply", "name")
    - `orderDirection` (string): Order direction ("asc", "desc")

- `get_token_details` - Get detailed information about a specific token including holders and transfers.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID
    - `tokenAddress` (string): The token contract address (0x prefixed)

- `get_tokens_by_owner` - Get all tokens owned by a specific address.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID
    - `ownerAddress` (string): The owner's wallet address (0x prefixed)

### Metadata & IPFS

- `pin_token_metadata` - Pin token metadata JSON to IPFS via Pinata.
  - Required arguments:
    - `name` (string): Token name
    - `symbol` (string): Token symbol
    - `decimals` (number): Number of decimals (0-18)
  - Optional arguments:
    - `description` (string): Token description
    - `externalLink` (string): External website URL
    - `imageBase64` (string): Base64 encoded image
    - `imageFilename` (string): Image filename with extension
    - `imageContentType` (string): Image MIME type
    - `properties` (object): Additional properties

- `get_token_metadata` - Retrieve token metadata from IPFS.
  - Required arguments:
    - `ipfsUri` (string): IPFS URI (ipfs://...) or CID

### Promo Codes

- `validate_promo_code` - Validate a promotional code and get signature for discounted creation.
  - Required arguments:
    - `code` (string): The promotional code
    - `userAddress` (string): The user's wallet address
    - `chainId` (number): The chain ID for token creation

### Token Logos

- `get_token_logo` - Get the logo URL for a specific token.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID
    - `tokenAddress` (string): The token contract address

- `list_token_logos` - List all tokens with logos on a chain.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID

### Transaction Building

- `build_create_token_transaction` - Build a transaction object for creating a new token.
  - Required arguments:
    - `chainId` (number): The blockchain chain ID
    - `owner` (string): Address that will own the token
    - `name` (string): Token name
    - `symbol` (string): Token symbol
    - `initialSupply` (string): Initial supply in token units
    - `metadataURI` (string): IPFS URI for token metadata
  - Optional arguments:
    - `decimals` (number): Number of decimals (default 18)
    - `maxSupply` (string): Maximum supply (default "0" for unlimited)
    - `promoFee` (string): Promo fee in wei
    - `promoNonce` (string): Promo nonce
    - `expiresAt` (number): Promo expiration timestamp
    - `signature` (string): Promo signature

## Installation

### Using npm (recommended)

```bash
cd backend
npm install
npm run dev  # Starts HTTP server with MCP endpoint
```

### Running as stdio server

For local development or direct integration:

```bash
cd backend
npm run mcp  # Runs MCP server in stdio mode
```

## Configuration

### Configure for Claude Desktop

Add to your Claude settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

**Using HTTP transport:**
```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp",
      "transport": "http"
    }
  }
}
```

**Using stdio transport:**
```json
{
  "mcpServers": {
    "token-minter": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/minter/backend"
    }
  }
}
```

### Configure for VS Code (Copilot/Cline)

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "token-minter": {
        "url": "http://localhost:3001/mcp"
      }
    }
  }
}
```

### Configure for Cursor

Add to Cursor settings:

```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/minter

# IPFS/Pinata
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=gateway.pinata.cloud

# R2 Storage (for logos)
R2_PUBLIC_URL=https://tokens.example.com

# Promo code signing
PROMO_SIGNER_PRIVATE_KEY=0x...

# Subgraph URLs
CELO_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../minter-celo/version/latest
ETHEREUM_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../minter-ethereum/version/latest

# Factory addresses
CELO_L2_FACTORY=0x...
ETHEREUM_L1_FACTORY=0x...
```

## Example Interactions

### 1. Get supported chains:

```json
{
  "name": "get_supported_chains",
  "arguments": {}
}
```

Response:
```json
{
  "chains": [
    {
      "chainId": 42220,
      "name": "Celo",
      "type": "L2",
      "rpcUrl": "https://forno.celo.org"
    },
    {
      "chainId": 1,
      "name": "Ethereum",
      "type": "L1",
      "rpcUrl": "https://eth.llamarpc.com"
    }
  ]
}
```

### 2. Pin token metadata to IPFS:

```json
{
  "name": "pin_token_metadata",
  "arguments": {
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "description": "A token for the community"
  }
}
```

Response:
```json
{
  "success": true,
  "metadataURI": "ipfs://QmXyz...",
  "cid": "QmXyz...",
  "gatewayUrl": "https://gateway.pinata.cloud/ipfs/QmXyz..."
}
```

### 3. Build token creation transaction:

```json
{
  "name": "build_create_token_transaction",
  "arguments": {
    "chainId": 42220,
    "owner": "0x1234...abcd",
    "name": "Community Token",
    "symbol": "COMM",
    "decimals": 18,
    "initialSupply": "1000000",
    "maxSupply": "0",
    "metadataURI": "ipfs://QmXyz..."
  }
}
```

Response:
```json
{
  "chainId": 42220,
  "to": "0xFactoryAddress...",
  "data": "0x...",
  "value": "1000000000000000",
  "gasLimit": "500000",
  "rpcUrl": "https://forno.celo.org"
}
```

## Debugging

You can use the MCP inspector to debug the server:

```bash
npx @modelcontextprotocol/inspector node dist/mcp/index.js
```

Or test the HTTP endpoint directly:

```bash
# Initialize session
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# List tools (use session ID from previous response)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Examples of Questions for Claude

1. "What chains are supported for token creation?"
2. "Create a token called 'Community Coin' with symbol 'COMM' on Celo with 1 million supply"
3. "List all tokens I've created on Celo" (provide your address)
4. "Get the details of token 0x... on Celo"
5. "What's the current creation fee on Celo?"
6. "Pin metadata for my token to IPFS"
7. "Generate the transaction to create my token"

## Build

```bash
cd backend
npm run build
```

Docker build:
```bash
cd backend
docker build -t token-minter/mcp .
```

## Contributing

We encourage contributions to help expand and improve the Token Minter MCP Server. Whether you want to add new tools, enhance existing functionality, or improve documentation, your input is valuable.

Pull requests are welcome!

## License

This project is licensed under the MIT License.
