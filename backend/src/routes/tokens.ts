import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { z } from 'zod';
import { ethers } from 'ethers';
import { uploadTokenLogo, deleteTokenLogo, getPublicLogoUrl, copyImageToTokenAddress, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from '../services/storage.js';
import { saveTokenLogo, getTokenLogo, deleteTokenLogoRecord, getPromoCode } from '../db.js';
import { createPromoSignature, getSignerAddress } from '../services/signer.js';

const router = Router();

// ============================================
//         CHAIN & FACTORY CONFIGURATION
// ============================================

// Factory addresses per chain
const FACTORY_ADDRESSES: Record<number, { l2?: string; l1?: string }> = {
  42220: {
    l2: process.env.CELO_L2_FACTORY || "0x...",
  },
  44787: {
    l2: process.env.CELO_ALFAJORES_L2_FACTORY || "0x...",
  },
  1: {
    l1: process.env.ETHEREUM_L1_FACTORY || "0x...",
  },
  11155111: {
    l1: process.env.SEPOLIA_L1_FACTORY || "0x...",
  },
};

// Chain metadata
const SUPPORTED_CHAINS: Record<number, {
  name: string;
  symbol: string;
  type: "L1" | "L2";
  rpcUrl: string;
  explorerUrl: string;
  factoryType: string;
}> = {
  42220: {
    name: "Celo",
    symbol: "CELO",
    type: "L2",
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
    factoryType: "L2SuperChainTokenFactory",
  },
  44787: {
    name: "Celo Alfajores",
    symbol: "CELO",
    type: "L2",
    rpcUrl: "https://alfajores-forno.celo-testnet.org",
    explorerUrl: "https://alfajores.celoscan.io",
    factoryType: "L2SuperChainTokenFactory",
  },
  1: {
    name: "Ethereum",
    symbol: "ETH",
    type: "L1",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    factoryType: "L1TokenFactory",
  },
  11155111: {
    name: "Sepolia",
    symbol: "ETH",
    type: "L1",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    factoryType: "L1TokenFactory",
  },
};

// Factory ABIs
const FACTORY_ABIS = {
  L2SuperChainTokenFactory: [
    "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
    "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
    "function creationFee() view returns (uint256)",
    "function feeRecipient() view returns (address)",
    "function predictTokenAddress(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) view returns (address)",
  ],
  L1TokenFactory: [
    "function createToken(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) payable returns (address)",
    "function createTokenWithPromo(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_, uint256 promoFee_, bytes32 promoNonce_, uint256 expiresAt_, bytes signature_) payable returns (address)",
    "function creationFee() view returns (uint256)",
    "function predictTokenAddress(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, string metadataURI_) view returns (address)",
  ],
};

// Extend Express Request to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configurar multer para almacenar en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`));
    }
  },
});

// Schema de validación
const uploadParamsSchema = z.object({
  chainId: z.string().regex(/^\d+$/).transform(Number),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

/**
 * POST /api/tokens/:chainId/:address/logo
 * Sube un logo para un token
 */
router.post(
  '/:chainId/:address/logo',
  upload.single('logo'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      // Validar parámetros
      const paramsResult = uploadParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: paramsResult.error.issues,
        });
        return;
      }

      const { chainId, address } = paramsResult.data;

      // Verificar que se subió un archivo
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Verificar si ya existe un logo para este token
      const existingLogo = await getTokenLogo(address, chainId);
      if (existingLogo) {
        // Eliminar el logo anterior de R2
        try {
          await deleteTokenLogo(existingLogo.file_key);
        } catch (e) {
          console.warn('Failed to delete old logo from R2:', e);
        }
        // Eliminar el registro de la DB
        await deleteTokenLogoRecord(address, chainId);
      }

      // Subir el nuevo logo a R2
      const result = await uploadTokenLogo(
        chainId,
        address,
        req.file.buffer,
        req.file.mimetype
      );

      // Guardar el registro en la DB
      await saveTokenLogo({
        tokenAddress: address,
        chainId,
        fileKey: result.fileKey,
        contentType: result.contentType,
        fileSize: result.fileSize,
      });

      res.json({
        success: true,
        data: {
          url: result.publicUrl,
          contentType: result.contentType,
          fileSize: result.fileSize,
        },
      });
    } catch (error: unknown) {
      console.error('Error uploading token logo:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024}KB` });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to upload logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Schema for pre-upload with hash identifier (not an address)
const preUploadParamsSchema = z.object({
  chainId: z.string().regex(/^\d+$/).transform(Number),
  identifier: z.string().regex(/^[a-fA-F0-9]{16}$/), // 16 hex chars (first 16 chars of keccak256 hash)
});

/**
 * POST /api/tokens/:chainId/pre-upload/:identifier/logo
 * Sube un logo antes de crear el token, usando un hash identifier
 * Este endpoint NO guarda en la DB, solo sube a R2 con el identifier como clave
 */
router.post(
  '/:chainId/pre-upload/:identifier/logo',
  upload.single('logo'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      const paramsResult = preUploadParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(400).json({
          error: 'Invalid parameters',
          details: paramsResult.error.issues,
        });
        return;
      }

      const { chainId, identifier } = paramsResult.data;

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Upload to R2 with the identifier (not a token address)
      const result = await uploadTokenLogo(
        chainId,
        identifier, // Use hash identifier instead of address
        req.file.buffer,
        req.file.mimetype
      );

      res.json({
        success: true,
        data: {
          url: result.publicUrl,
          contentType: result.contentType,
          fileSize: result.fileSize,
          identifier,
        },
      });
    } catch (error: unknown) {
      console.error('Error uploading pre-token logo:', error);

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: `File too large. Max size: ${MAX_FILE_SIZE / 1024}KB` });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to upload logo',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/tokens/:chainId/:address/logo
 * Obtiene la URL del logo de un token
 */
router.get('/:chainId/:address/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;

    const logo = await getTokenLogo(address, chainId);
    if (!logo) {
      res.status(404).json({ error: 'Logo not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        url: getPublicLogoUrl(logo.file_key),
        contentType: logo.content_type,
        fileSize: logo.file_size,
        createdAt: logo.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting token logo:', error);
    res.status(500).json({
      error: 'Failed to get logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/tokens/:chainId/:address/logo
 * Elimina el logo de un token
 */
router.delete('/:chainId/:address/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;

    const logo = await getTokenLogo(address, chainId);
    if (!logo) {
      res.status(404).json({ error: 'Logo not found' });
      return;
    }

    // Eliminar de R2
    await deleteTokenLogo(logo.file_key);

    // Eliminar de la DB
    await deleteTokenLogoRecord(address, chainId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting token logo:', error);
    res.status(500).json({
      error: 'Failed to delete logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/tokens/logos/batch
 * Obtiene las URLs de logos para múltiples tokens
 * Query: tokens = [{chainId: number, address: string}, ...]
 */
router.post('/logos/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const tokensSchema = z.array(
      z.object({
        chainId: z.number(),
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      })
    ).max(50); // Limitar a 50 tokens por request

    const result = tokensSchema.safeParse(req.body.tokens);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: result.error.issues,
      });
      return;
    }

    const tokens = result.data;
    const logos: Record<string, string> = {};

    // Obtener todos los logos
    for (const token of tokens) {
      const logo = await getTokenLogo(token.address, token.chainId);
      if (logo) {
        const key = `${token.chainId}:${token.address.toLowerCase()}`;
        logos[key] = getPublicLogoUrl(logo.file_key);
      }
    }

    res.json({
      success: true,
      data: logos,
    });
  } catch (error) {
    console.error('Error getting batch logos:', error);
    res.status(500).json({
      error: 'Failed to get logos',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/:chainId/:address/logo/copy
 * Copia una imagen de un hash temporal a la dirección real del token
 * Body: { sourceHash: string } - el hash usado para subir la imagen originalmente
 */
router.post('/:chainId/:address/logo/copy', async (req: Request, res: Response): Promise<void> => {
  try {
    const paramsResult = uploadParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      res.status(400).json({
        error: 'Invalid parameters',
        details: paramsResult.error.issues,
      });
      return;
    }

    const { chainId, address } = paramsResult.data;
    const { sourceHash } = req.body;

    if (!sourceHash || typeof sourceHash !== 'string') {
      res.status(400).json({ error: 'sourceHash is required' });
      return;
    }

    // Copy the image from hash to token address
    const result = await copyImageToTokenAddress(chainId, sourceHash, address);

    if (!result) {
      res.status(404).json({ error: 'Source image not found' });
      return;
    }

    // Save the new logo record in DB
    await saveTokenLogo({
      tokenAddress: address,
      chainId,
      fileKey: result.fileKey,
      contentType: result.contentType,
      fileSize: result.fileSize,
    });

    res.json({
      success: true,
      data: {
        url: result.publicUrl,
        contentType: result.contentType,
        fileSize: result.fileSize,
      },
    });
  } catch (error) {
    console.error('Error copying logo:', error);
    res.status(500).json({
      error: 'Failed to copy logo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
//         TOKEN CREATION CALLDATA ENDPOINTS
// ============================================

// Validation schemas for token creation
const createTokenSchema = z.object({
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid owner address'),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  decimals: z.number().int().min(0).max(18).default(18),
  initialSupply: z.string().min(1), // In token units (e.g., "1000000")
  maxSupply: z.string().default("0"), // "0" for unlimited
  metadataURI: z.string().default(""), // IPFS URI
  // Optional promo code
  promoCode: z.string().optional(),
});

const createTokenWithBridgeSchema = createTokenSchema.extend({
  remoteToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid remote token address'),
});

/**
 * GET /api/tokens/chains
 * Returns supported chains and factory configuration
 */
router.get('/chains', async (_req: Request, res: Response): Promise<void> => {
  try {
    const chains = Object.entries(SUPPORTED_CHAINS).map(([chainId, config]) => ({
      chainId: parseInt(chainId),
      ...config,
      factoryAddress: FACTORY_ADDRESSES[parseInt(chainId)],
    }));

    res.json({
      success: true,
      data: {
        chains,
        factoryABIs: FACTORY_ABIS,
      },
    });
  } catch (error) {
    console.error('Error getting chains:', error);
    res.status(500).json({
      error: 'Failed to get chain configuration',
    });
  }
});

/**
 * GET /api/tokens/:chainId/fee
 * Returns the creation fee for a specific chain
 */
router.get('/:chainId/fee', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = parseInt(req.params.chainId);
    const chain = SUPPORTED_CHAINS[chainId];
    
    if (!chain) {
      res.status(400).json({ error: `Chain ${chainId} not supported` });
      return;
    }

    const factory = FACTORY_ADDRESSES[chainId];
    const factoryAddress = factory?.l2 || factory?.l1;

    if (!factoryAddress || factoryAddress === '0x...') {
      res.status(400).json({ error: `Factory not configured for chain ${chainId}` });
      return;
    }

    // Create provider and read fee from contract
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const abi = FACTORY_ABIS[chain.factoryType as keyof typeof FACTORY_ABIS];
    const contract = new ethers.Contract(factoryAddress, abi, provider);
    
    const fee = await contract.creationFee();

    res.json({
      success: true,
      data: {
        chainId,
        factoryAddress,
        creationFee: fee.toString(),
        creationFeeFormatted: ethers.formatEther(fee),
        nativeSymbol: chain.symbol,
      },
    });
  } catch (error) {
    console.error('Error getting fee:', error);
    res.status(500).json({
      error: 'Failed to get creation fee',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/:chainId/create/calldata
 * Generates calldata for creating a token on a specific chain
 * 
 * For Celo (L2): Creates an L2SuperChainToken
 * For Ethereum (L1): Creates an L1Token
 */
router.post('/:chainId/create/calldata', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = parseInt(req.params.chainId);
    const chain = SUPPORTED_CHAINS[chainId];
    
    if (!chain) {
      res.status(400).json({ error: `Chain ${chainId} not supported` });
      return;
    }

    const parseResult = createTokenSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { owner, name, symbol, decimals, initialSupply, maxSupply, metadataURI, promoCode } = parseResult.data;

    const factory = FACTORY_ADDRESSES[chainId];
    const factoryAddress = factory?.l2 || factory?.l1;

    if (!factoryAddress || factoryAddress === '0x...') {
      res.status(400).json({ error: `Factory not configured for chain ${chainId}` });
      return;
    }

    // Parse supplies to wei
    const initialSupplyWei = ethers.parseUnits(initialSupply, decimals);
    const maxSupplyWei = maxSupply === "0" ? 0n : ethers.parseUnits(maxSupply, decimals);

    // Build interface
    const abi = FACTORY_ABIS[chain.factoryType as keyof typeof FACTORY_ABIS];
    const iface = new ethers.Interface(abi);

    let calldata: string;
    let value: string;
    let functionName: string;
    let promoData: any = null;

    // Check if promo code is provided
    if (promoCode) {
      const promo = await getPromoCode(promoCode.toUpperCase());
      
      if (!promo) {
        res.status(400).json({ error: 'Promo code not found' });
        return;
      }

      if (!promo.is_active) {
        res.status(400).json({ error: 'Promo code is not active' });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      if (promo.expires_at <= now) {
        res.status(400).json({ error: 'Promo code has expired' });
        return;
      }

      if (promo.current_uses >= promo.max_uses) {
        res.status(400).json({ error: 'Promo code has reached maximum uses' });
        return;
      }

      // Generate nonce
      const promoNonce = ethers.keccak256(
        ethers.solidityPacked(['string', 'address', 'uint256', 'uint256'], [promoCode, owner, chainId, Date.now()])
      );

      // Create signature
      const signatureResult = await createPromoSignature({
        userAddress: owner,
        promoFee: promo.discount_fee,
        promoNonce,
        expiresAt: promo.expires_at,
        chainId,
        factoryAddress,
      });

      functionName = 'createTokenWithPromo';
      calldata = iface.encodeFunctionData('createTokenWithPromo', [
        owner,
        name,
        symbol,
        decimals,
        initialSupplyWei,
        maxSupplyWei,
        metadataURI,
        BigInt(promo.discount_fee),
        promoNonce,
        promo.expires_at,
        signatureResult.signature,
      ]);
      value = promo.discount_fee;
      promoData = {
        promoFee: promo.discount_fee,
        promoNonce,
        expiresAt: promo.expires_at,
        signature: signatureResult.signature,
        signerAddress: await getSignerAddress(),
      };
    } else {
      // Without promo - need to fetch creation fee
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const contract = new ethers.Contract(factoryAddress, abi, provider);
      const fee = await contract.creationFee();

      functionName = 'createToken';
      calldata = iface.encodeFunctionData('createToken', [
        owner,
        name,
        symbol,
        decimals,
        initialSupplyWei,
        maxSupplyWei,
        metadataURI,
      ]);
      value = fee.toString();
    }

    res.json({
      success: true,
      data: {
        chainId,
        to: factoryAddress,
        data: calldata,
        value,
        valueFormatted: ethers.formatEther(value),
        functionName,
        gasLimit: '500000', // Recommended gas limit
        rpcUrl: chain.rpcUrl,
        explorerUrl: chain.explorerUrl,
        promoData,
        params: {
          owner,
          name,
          symbol,
          decimals,
          initialSupply,
          initialSupplyWei: initialSupplyWei.toString(),
          maxSupply,
          maxSupplyWei: maxSupplyWei.toString(),
          metadataURI,
        },
      },
    });
  } catch (error) {
    console.error('Error generating calldata:', error);
    res.status(500).json({
      error: 'Failed to generate calldata',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/:chainId/create-with-bridge/calldata
 * Generates calldata for creating an L2 token that's linked to an L1 token (for bridging)
 * This is used after creating an L1 token to create its L2 counterpart
 */
router.post('/:chainId/create-with-bridge/calldata', async (req: Request, res: Response): Promise<void> => {
  try {
    const chainId = parseInt(req.params.chainId);
    const chain = SUPPORTED_CHAINS[chainId];
    
    if (!chain || chain.type !== 'L2') {
      res.status(400).json({ error: `Chain ${chainId} is not a supported L2 chain` });
      return;
    }

    const parseResult = createTokenWithBridgeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { owner, name, symbol, decimals, initialSupply, maxSupply, metadataURI, remoteToken } = parseResult.data;

    const factory = FACTORY_ADDRESSES[chainId];
    const factoryAddress = factory?.l2;

    if (!factoryAddress || factoryAddress === '0x...') {
      res.status(400).json({ error: `L2 Factory not configured for chain ${chainId}` });
      return;
    }

    // L2 Bridge address (standard for OP Stack chains)
    const L2_BRIDGE = '0x4200000000000000000000000000000000000010';

    // Parse supplies to wei
    const initialSupplyWei = ethers.parseUnits(initialSupply, decimals);
    const maxSupplyWei = maxSupply === "0" ? 0n : ethers.parseUnits(maxSupply, decimals);

    // Build interface for createTokenWithBridge (NO FEE - already paid on L1)
    const iface = new ethers.Interface([
      "function createTokenWithBridge(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, address bridge_, address remoteToken_, string metadataURI_) returns (address)",
    ]);

    const calldata = iface.encodeFunctionData('createTokenWithBridge', [
      owner,
      name,
      symbol,
      decimals,
      initialSupplyWei,
      maxSupplyWei,
      L2_BRIDGE,
      remoteToken,
      metadataURI,
    ]);

    res.json({
      success: true,
      data: {
        chainId,
        to: factoryAddress,
        data: calldata,
        value: '0', // No fee for bridge-linked tokens
        functionName: 'createTokenWithBridge',
        gasLimit: '500000',
        rpcUrl: chain.rpcUrl,
        explorerUrl: chain.explorerUrl,
        params: {
          owner,
          name,
          symbol,
          decimals,
          initialSupply,
          initialSupplyWei: initialSupplyWei.toString(),
          maxSupply,
          maxSupplyWei: maxSupplyWei.toString(),
          bridge: L2_BRIDGE,
          remoteToken,
          metadataURI,
        },
      },
    });
  } catch (error) {
    console.error('Error generating bridge calldata:', error);
    res.status(500).json({
      error: 'Failed to generate calldata',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/bridge/calldata
 * Generates calldata for bridging tokens from L1 to L2
 * Returns both approve and bridge calldata
 */
const bridgeSchema = z.object({
  l1TokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  l2TokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().min(1), // In token units
  decimals: z.number().int().min(0).max(18).default(18),
});

router.post('/bridge/calldata', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = bridgeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { l1TokenAddress, l2TokenAddress, recipient, amount, decimals } = parseResult.data;

    // L1 Bridge address
    const L1_BRIDGE = '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe';
    
    const amountWei = ethers.parseUnits(amount, decimals);

    // Approve calldata
    const approveIface = new ethers.Interface([
      "function approve(address spender, uint256 amount) returns (bool)",
    ]);
    const approveCalldata = approveIface.encodeFunctionData('approve', [L1_BRIDGE, amountWei]);

    // Bridge calldata
    const bridgeIface = new ethers.Interface([
      "function bridgeERC20To(address _localToken, address _remoteToken, address _to, uint256 _amount, uint32 _minGasLimit, bytes _extraData)",
    ]);
    const bridgeCalldata = bridgeIface.encodeFunctionData('bridgeERC20To', [
      l1TokenAddress,
      l2TokenAddress,
      recipient,
      amountWei,
      200000, // minGasLimit
      '0x',   // extraData
    ]);

    // Get L1 chain info
    const l1Chain = SUPPORTED_CHAINS[1] || SUPPORTED_CHAINS[11155111];

    res.json({
      success: true,
      data: {
        steps: [
          {
            step: 1,
            description: 'Approve bridge to spend tokens',
            chainId: 1, // or 11155111 for Sepolia
            to: l1TokenAddress,
            data: approveCalldata,
            value: '0',
            functionName: 'approve',
            gasLimit: '100000',
          },
          {
            step: 2,
            description: 'Bridge tokens to L2',
            chainId: 1, // or 11155111 for Sepolia
            to: L1_BRIDGE,
            data: bridgeCalldata,
            value: '0',
            functionName: 'bridgeERC20To',
            gasLimit: '250000',
          },
        ],
        params: {
          l1TokenAddress,
          l2TokenAddress,
          recipient,
          amount,
          amountWei: amountWei.toString(),
          l1Bridge: L1_BRIDGE,
        },
        note: 'Execute step 1 first, wait for confirmation, then execute step 2. Bridged tokens will arrive on L2 after ~15-20 minutes.',
      },
    });
  } catch (error) {
    console.error('Error generating bridge calldata:', error);
    res.status(500).json({
      error: 'Failed to generate bridge calldata',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/tokens/full-deployment/calldata
 * Generates all calldata needed for a full token deployment
 * For celo-native: Just L2 creation
 * For ethereum-enabled: L1 creation + L2 creation with bridge + optional bridge transfer
 */
const fullDeploymentSchema = z.object({
  tokenType: z.enum(['celo-native', 'ethereum-enabled']),
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  decimals: z.number().int().min(0).max(18).default(18),
  initialSupply: z.string().min(1),
  maxSupply: z.string().default("0"),
  metadataURI: z.string().default(""),
  promoCode: z.string().optional(),
  bridgeInitialSupply: z.boolean().default(true), // Whether to bridge initial supply to L2
});

router.post('/full-deployment/calldata', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = fullDeploymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { 
      tokenType, owner, name, symbol, decimals, 
      initialSupply, maxSupply, metadataURI, promoCode, bridgeInitialSupply 
    } = parseResult.data;

    const steps: any[] = [];
    const initialSupplyWei = ethers.parseUnits(initialSupply, decimals);
    const maxSupplyWei = maxSupply === "0" ? 0n : ethers.parseUnits(maxSupply, decimals);

    if (tokenType === 'celo-native') {
      // Simple L2 token creation on Celo
      const chainId = 42220; // Celo mainnet (or 44787 for testnet)
      const chain = SUPPORTED_CHAINS[chainId];
      const factory = FACTORY_ADDRESSES[chainId];
      const factoryAddress = factory?.l2;

      if (!factoryAddress || factoryAddress === '0x...') {
        res.status(400).json({ error: 'Celo L2 Factory not configured' });
        return;
      }

      const abi = FACTORY_ABIS.L2SuperChainTokenFactory;
      const iface = new ethers.Interface(abi);

      let calldata: string;
      let value: string;
      let functionName: string;
      let promoData: any = null;

      if (promoCode) {
        const promo = await getPromoCode(promoCode.toUpperCase());
        if (!promo || !promo.is_active) {
          res.status(400).json({ error: 'Invalid promo code' });
          return;
        }

        const promoNonce = ethers.keccak256(
          ethers.solidityPacked(['string', 'address', 'uint256', 'uint256'], [promoCode, owner, chainId, Date.now()])
        );

        const signatureResult = await createPromoSignature({
          userAddress: owner,
          promoFee: promo.discount_fee,
          promoNonce,
          expiresAt: promo.expires_at,
          chainId,
          factoryAddress,
        });

        functionName = 'createTokenWithPromo';
        calldata = iface.encodeFunctionData('createTokenWithPromo', [
          owner, name, symbol, decimals, initialSupplyWei, maxSupplyWei, metadataURI,
          BigInt(promo.discount_fee), promoNonce, promo.expires_at, signatureResult.signature,
        ]);
        value = promo.discount_fee;
        promoData = { promoFee: promo.discount_fee, promoNonce, expiresAt: promo.expires_at, signature: signatureResult.signature };
      } else {
        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const contract = new ethers.Contract(factoryAddress, abi, provider);
        const fee = await contract.creationFee();

        functionName = 'createToken';
        calldata = iface.encodeFunctionData('createToken', [
          owner, name, symbol, decimals, initialSupplyWei, maxSupplyWei, metadataURI,
        ]);
        value = fee.toString();
      }

      steps.push({
        step: 1,
        description: 'Create L2 token on Celo',
        chainId,
        chainName: chain.name,
        to: factoryAddress,
        data: calldata,
        value,
        valueFormatted: ethers.formatEther(value),
        functionName,
        gasLimit: '500000',
        rpcUrl: chain.rpcUrl,
        explorerUrl: chain.explorerUrl,
        promoData,
        expectedResult: 'Token address will be in TokenCreated event',
      });

    } else {
      // Ethereum-enabled: L1 + L2 + Bridge
      const l1ChainId = 1; // Ethereum mainnet (or 11155111 for Sepolia)
      const l2ChainId = 42220; // Celo mainnet
      const l1Chain = SUPPORTED_CHAINS[l1ChainId];
      const l2Chain = SUPPORTED_CHAINS[l2ChainId];
      const l1Factory = FACTORY_ADDRESSES[l1ChainId]?.l1;
      const l2Factory = FACTORY_ADDRESSES[l2ChainId]?.l2;

      if (!l1Factory || l1Factory === '0x...' || !l2Factory || l2Factory === '0x...') {
        res.status(400).json({ error: 'Factories not configured' });
        return;
      }

      const l1Abi = FACTORY_ABIS.L1TokenFactory;
      const l1Iface = new ethers.Interface(l1Abi);

      // Step 1: Create L1 token
      let l1Calldata: string;
      let l1Value: string;
      let l1FunctionName: string;
      let promoData: any = null;

      if (promoCode) {
        const promo = await getPromoCode(promoCode.toUpperCase());
        if (!promo || !promo.is_active) {
          res.status(400).json({ error: 'Invalid promo code' });
          return;
        }

        const promoNonce = ethers.keccak256(
          ethers.solidityPacked(['string', 'address', 'uint256', 'uint256'], [promoCode, owner, l1ChainId, Date.now()])
        );

        const signatureResult = await createPromoSignature({
          userAddress: owner,
          promoFee: promo.discount_fee,
          promoNonce,
          expiresAt: promo.expires_at,
          chainId: l1ChainId,
          factoryAddress: l1Factory,
        });

        l1FunctionName = 'createTokenWithPromo';
        l1Calldata = l1Iface.encodeFunctionData('createTokenWithPromo', [
          owner, name, symbol, decimals, initialSupplyWei, maxSupplyWei, metadataURI,
          BigInt(promo.discount_fee), promoNonce, promo.expires_at, signatureResult.signature,
        ]);
        l1Value = promo.discount_fee;
        promoData = { promoFee: promo.discount_fee, promoNonce, expiresAt: promo.expires_at, signature: signatureResult.signature };
      } else {
        const provider = new ethers.JsonRpcProvider(l1Chain.rpcUrl);
        const contract = new ethers.Contract(l1Factory, l1Abi, provider);
        const fee = await contract.creationFee();

        l1FunctionName = 'createToken';
        l1Calldata = l1Iface.encodeFunctionData('createToken', [
          owner, name, symbol, decimals, initialSupplyWei, maxSupplyWei, metadataURI,
        ]);
        l1Value = fee.toString();
      }

      steps.push({
        step: 1,
        description: 'Create L1 token on Ethereum',
        chainId: l1ChainId,
        chainName: l1Chain.name,
        to: l1Factory,
        data: l1Calldata,
        value: l1Value,
        valueFormatted: ethers.formatEther(l1Value),
        functionName: l1FunctionName,
        gasLimit: '500000',
        rpcUrl: l1Chain.rpcUrl,
        explorerUrl: l1Chain.explorerUrl,
        promoData,
        expectedResult: 'L1 token address will be in TokenCreated event. Save this for step 2.',
      });

      // Step 2: Create L2 token with bridge
      const L2_BRIDGE = '0x4200000000000000000000000000000000000010';
      const l2BridgeIface = new ethers.Interface([
        "function createTokenWithBridge(address owner_, string name_, string symbol_, uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_, address bridge_, address remoteToken_, string metadataURI_) returns (address)",
      ]);

      steps.push({
        step: 2,
        description: 'Create L2 token on Celo with bridge link',
        chainId: l2ChainId,
        chainName: l2Chain.name,
        to: l2Factory,
        // Note: remoteToken placeholder - agent must replace with L1 address from step 1
        dataTemplate: 'Use createTokenWithBridge with L1 token address from step 1',
        dataParams: {
          function: 'createTokenWithBridge',
          args: [owner, name, symbol, decimals, initialSupplyWei.toString(), maxSupplyWei.toString(), L2_BRIDGE, '{L1_TOKEN_ADDRESS}', metadataURI],
        },
        value: '0',
        functionName: 'createTokenWithBridge',
        gasLimit: '500000',
        rpcUrl: l2Chain.rpcUrl,
        explorerUrl: l2Chain.explorerUrl,
        note: 'Replace {L1_TOKEN_ADDRESS} with the token address from step 1',
      });

      // Step 3-4: Bridge initial supply (if requested and initialSupply > 0)
      if (bridgeInitialSupply && parseFloat(initialSupply) > 0) {
        const L1_BRIDGE = '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe';

        const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount) returns (bool)"]);
        const approveCalldata = approveIface.encodeFunctionData('approve', [L1_BRIDGE, initialSupplyWei]);

        steps.push({
          step: 3,
          description: 'Approve bridge to spend L1 tokens',
          chainId: l1ChainId,
          chainName: l1Chain.name,
          toTemplate: '{L1_TOKEN_ADDRESS}',
          data: approveCalldata,
          value: '0',
          functionName: 'approve',
          gasLimit: '100000',
          rpcUrl: l1Chain.rpcUrl,
          note: 'Replace {L1_TOKEN_ADDRESS} with the token address from step 1',
        });

        const bridgeIface = new ethers.Interface([
          "function bridgeERC20To(address _localToken, address _remoteToken, address _to, uint256 _amount, uint32 _minGasLimit, bytes _extraData)",
        ]);

        steps.push({
          step: 4,
          description: 'Bridge initial supply to L2',
          chainId: l1ChainId,
          chainName: l1Chain.name,
          to: L1_BRIDGE,
          dataTemplate: 'Use bridgeERC20To with L1 and L2 token addresses',
          dataParams: {
            function: 'bridgeERC20To',
            args: ['{L1_TOKEN_ADDRESS}', '{L2_TOKEN_ADDRESS}', owner, initialSupplyWei.toString(), 200000, '0x'],
          },
          value: '0',
          functionName: 'bridgeERC20To',
          gasLimit: '250000',
          rpcUrl: l1Chain.rpcUrl,
          note: 'Bridged tokens arrive on L2 after ~15-20 minutes',
        });
      }
    }

    res.json({
      success: true,
      data: {
        tokenType,
        totalSteps: steps.length,
        steps,
        params: {
          owner,
          name,
          symbol,
          decimals,
          initialSupply,
          initialSupplyWei: initialSupplyWei.toString(),
          maxSupply,
          maxSupplyWei: maxSupplyWei.toString(),
          metadataURI,
        },
        instructions: tokenType === 'celo-native' 
          ? 'Execute step 1 and extract the token address from the TokenCreated event.'
          : 'Execute steps in order. After step 1, extract L1 token address and use it in step 2. After step 2, extract L2 token address. Steps 3-4 are optional for bridging initial supply.',
      },
    });
  } catch (error) {
    console.error('Error generating full deployment calldata:', error);
    res.status(500).json({
      error: 'Failed to generate deployment calldata',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
