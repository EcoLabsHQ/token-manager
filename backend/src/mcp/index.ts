#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

/**
 * MCP Server Entry Point
 * 
 * This server exposes tools for interacting with token data:
 * - get_token_logo: Get logo URL for a specific token
 * - list_token_logos: List all tokens with logos on a chain
 * 
 * Run with: npm run mcp
 * Or directly: tsx src/mcp/index.ts
 */
async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Log to stderr (not stdout) to avoid corrupting JSON-RPC messages
  console.error("Minter MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
});
