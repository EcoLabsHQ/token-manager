import { BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { 
  OwnershipTransferStarted as OwnershipTransferStartedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Transfer as TransferEventContract
} from "../generated/templates/L1Token/L1Token"
import { Token, TokenHolder, PendingOwnershipTransfer, TransferEvent, BridgeEvent } from "../generated/schema"

const ZERO_ADDRESS = Bytes.fromHexString("0x0000000000000000000000000000000000000000")
// L1StandardBridge address on Sepolia for Celo L2
const L1_STANDARD_BRIDGE = Bytes.fromHexString("0xEc18a3c30131A0Db4246e785355fBc16E2eAF408")

function getOrCreateTokenHolder(tokenAddress: Bytes, holderAddress: Bytes): TokenHolder {
  const id = tokenAddress.concat(holderAddress)
  let holder = TokenHolder.load(id)
  if (!holder) {
    holder = new TokenHolder(id)
    holder.token = tokenAddress
    holder.holder = holderAddress
    holder.balance = BigInt.fromI32(0)
  }
  return holder
}

export function handleTransfer(event: TransferEventContract): void {
  const tokenAddress = event.address
  const from = event.params.from
  const to = event.params.to
  const value = event.params.value

  let token = Token.load(tokenAddress)
  if (!token) {
    return
  }

  // Increment total transfers counter
  token.totalTransfers = token.totalTransfers.plus(BigInt.fromI32(1))

  // Create immutable transfer event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let transferEvent = new TransferEvent(eventId)
  transferEvent.token = tokenAddress
  transferEvent.from = from
  transferEvent.to = to
  transferEvent.value = value
  transferEvent.blockNumber = event.block.number
  transferEvent.blockTimestamp = event.block.timestamp
  transferEvent.transactionHash = event.transaction.hash
  transferEvent.save()

  // Check if this is a bridge event (transfer to/from L1StandardBridge)
  const isDepositToL2 = to.equals(L1_STANDARD_BRIDGE) // Tokens going TO bridge = deposit to L2
  const isWithdrawFromL2 = from.equals(L1_STANDARD_BRIDGE) // Tokens coming FROM bridge = withdrawal from L2

  if (isDepositToL2 || isWithdrawFromL2) {
    // Increment total bridges counter
    token.totalBridges = token.totalBridges.plus(BigInt.fromI32(1))

    // Create bridge event entity
    let bridgeEvent = new BridgeEvent(eventId)
    bridgeEvent.token = tokenAddress
    bridgeEvent.eventType = isDepositToL2 ? "deposit" : "withdrawal"
    bridgeEvent.account = isDepositToL2 ? from : to // The user address
    bridgeEvent.amount = value
    bridgeEvent.sender = L1_STANDARD_BRIDGE // The bridge contract
    bridgeEvent.blockNumber = event.block.number
    bridgeEvent.blockTimestamp = event.block.timestamp
    bridgeEvent.transactionHash = event.transaction.hash
    bridgeEvent.save()
  }

  // Handle minting (from zero address)
  if (from.equals(ZERO_ADDRESS)) {
    token.totalSupply = token.totalSupply.plus(value)
  }
  // Handle burning (to zero address)
  else if (to.equals(ZERO_ADDRESS)) {
    token.totalSupply = token.totalSupply.minus(value)
  }

  // Update sender balance (if not minting)
  if (!from.equals(ZERO_ADDRESS)) {
    let fromHolder = getOrCreateTokenHolder(tokenAddress, from)
    fromHolder.balance = fromHolder.balance.minus(value)
    
    // Check if sender's balance dropped to zero
    if (fromHolder.balance.equals(BigInt.fromI32(0))) {
      token.totalUniqueHolders = token.totalUniqueHolders.minus(BigInt.fromI32(1))
      store.remove("TokenHolder", fromHolder.id.toHexString())
    } else {
      fromHolder.save()
    }
  }

  // Update receiver balance (if not burning)
  if (!to.equals(ZERO_ADDRESS)) {
    let toHolder = getOrCreateTokenHolder(tokenAddress, to)
    const wasZero = toHolder.balance.equals(BigInt.fromI32(0))
    toHolder.balance = toHolder.balance.plus(value)
    
    // Check if this is a new holder
    if (wasZero && toHolder.balance.gt(BigInt.fromI32(0))) {
      token.totalUniqueHolders = token.totalUniqueHolders.plus(BigInt.fromI32(1))
    }
    toHolder.save()
  }

  token.save()
}

export function handleOwnershipTransferStarted(event: OwnershipTransferStartedEvent): void {
  const tokenAddress = event.address
  
  let token = Token.load(tokenAddress)
  if (!token) {
    return
  }

  // Use token address as ID since only one pending transfer can exist per token
  let pendingTransfer = new PendingOwnershipTransfer(tokenAddress)
  pendingTransfer.token = tokenAddress
  pendingTransfer.previousOwner = event.params.previousOwner
  pendingTransfer.newOwner = event.params.newOwner
  pendingTransfer.createdAt = event.block.timestamp
  pendingTransfer.createdAtBlock = event.block.number
  pendingTransfer.createdTxHash = event.transaction.hash
  pendingTransfer.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
  const tokenAddress = event.address
  
  // Update the token owner
  let token = Token.load(tokenAddress)
  if (token) {
    token.owner = event.params.newOwner
    token.save()
  }

  // Remove the pending transfer if it exists (ownership was accepted)
  let pendingTransfer = PendingOwnershipTransfer.load(tokenAddress)
  if (pendingTransfer) {
    store.remove("PendingOwnershipTransfer", tokenAddress.toHexString())
  }
}
