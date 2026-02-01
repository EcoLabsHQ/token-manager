import { ethers } from 'ethers';

const PROMO_SIGNER_PRIVATE_KEY = process.env.PROMO_SIGNER_PRIVATE_KEY;

if (!PROMO_SIGNER_PRIVATE_KEY) {
  throw new Error('PROMO_SIGNER_PRIVATE_KEY is required');
}

const wallet = new ethers.Wallet(PROMO_SIGNER_PRIVATE_KEY);

export interface PromoSignatureParams {
  userAddress: string;
  promoFee: string;
  promoNonce: string;
  expiresAt: number;
  chainId: number;
  factoryAddress: string;
}

export interface PromoSignatureResult {
  signature: string;
  promoFee: string;
  promoNonce: string;
  expiresAt: number;
  chainId: number;
  factoryAddress: string;
  signerAddress: string;
}

/**
 * Creates a signature for promotional fee discount
 * The signature matches what the smart contract expects:
 * keccak256(abi.encodePacked(msg.sender, promoFee_, promoNonce_, expiresAt_, block.chainid, address(this)))
 */
export async function createPromoSignature(
  params: PromoSignatureParams
): Promise<PromoSignatureResult> {
  const { userAddress, promoFee, promoNonce, expiresAt, chainId, factoryAddress } = params;

  // Create the message hash matching the contract's expected format
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'bytes32', 'uint256', 'uint256', 'address'],
    [userAddress, promoFee, promoNonce, expiresAt, chainId, factoryAddress]
  );

  // Sign the message (ethers.js automatically adds the Ethereum prefix)
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));

  return {
    signature,
    promoFee,
    promoNonce,
    expiresAt,
    chainId,
    factoryAddress,
    signerAddress: wallet.address,
  };
}

export function getSignerAddress(): string {
  return wallet.address;
}
