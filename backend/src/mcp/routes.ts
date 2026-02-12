import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server.js";

const router = Router();

// Store transports by session ID for stateful connections
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Create shared MCP server instance
const mcpServer = createMcpServer();

/**
 * POST /mcp - Main MCP endpoint for JSON-RPC messages
 * Handles both initialization and subsequent requests
 */
router.post("/", async (req: Request, res: Response) => {
  console.error("[MCP] Received POST request:", JSON.stringify(req.body).slice(0, 200));

  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport for this session
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - create new transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true, // Return JSON instead of SSE for simpler clients
        onsessioninitialized: (newSessionId) => {
          console.error(`[MCP] Session initialized: ${newSessionId}`);
          transports[newSessionId] = transport;
        },
      });

      // Clean up on close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.error(`[MCP] Session closed: ${sid}`);
          delete transports[sid];
        }
      };

      // Connect transport to MCP server
      await mcpServer.connect(transport);
    } else {
      // Invalid request - no session and not initializing
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Bad Request: Missing session ID or not an initialization request",
        },
        id: null,
      });
      return;
    }

    // Handle the request through the transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP] Error handling request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

/**
 * GET /mcp - SSE endpoint for server-to-client notifications
 * Optional: only needed if you want push notifications from server
 */
router.get("/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid or missing session ID",
      },
      id: null,
    });
    return;
  }

  console.error(`[MCP] SSE stream requested for session: ${sessionId}`);
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

/**
 * DELETE /mcp - Terminate a session
 */
router.delete("/", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports[sessionId]) {
    const transport = transports[sessionId];
    await transport.close();
    delete transports[sessionId];
    console.error(`[MCP] Session terminated: ${sessionId}`);
    res.status(204).send();
  } else {
    res.status(404).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Session not found",
      },
      id: null,
    });
  }
});

export default router;
