import { Bytes, store } from "@graphprotocol/graph-ts"
import { 
  OwnershipTransferStarted as OwnershipTransferStartedEvent,
  OwnershipTransferred as OwnershipTransferredEvent
} from "../generated/templates/L1Token/L1Token"
import { Token, PendingOwnershipTransfer } from "../generated/schema"

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
