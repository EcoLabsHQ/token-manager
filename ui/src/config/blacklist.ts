/**
 * Token address blacklist.
 * Tokens whose address (lowercase) appears here will be hidden from all UI views.
 */
export const TOKEN_BLACKLIST = new Set<string>([
  '0x1e45b6408c370dfd2a6f27d9a0980034a88b3d7f', // Regenerative (REFI)
  '0x56f0304cd4cb21f25180915d8dff019a333d9dad', // USDREFIT (USDREFT)
  '0x6c17fd262ad3c8777a213f964da98685e54be25d', // USDREFITEST (USDREFITEST)
  '0x1887a65950397cbedb2ccfa52141910f15fa2fc7', // USDREFIV1 (USDREFI)
  '0xb774b352eea28a68e35e7f9089e36663b7dfba4f', // LuchoTOk (LKL)
]);

/**
 * Returns true if the token address is blacklisted and should NOT be rendered.
 */
export function isBlacklisted(address: string): boolean {
  return TOKEN_BLACKLIST.has(address.toLowerCase());
}
