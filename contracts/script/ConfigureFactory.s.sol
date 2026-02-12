// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {Script, console2} from "forge-std/Script.sol";

interface IConfigurableFactory {
    function setCreationFee(uint256 newFee_) external;
    function setPromoSigner(address newSigner_) external;
    function creationFee() external view returns (uint256);
    function promoSigner() external view returns (address);
    function owner() external view returns (address);
}

/// @title ConfigureFactory
/// @notice Script to configure a TokenFactory (L1 or L2) with creation fee and promo signer
/// @dev Usage:
///   forge script script/ConfigureFactory.s.sol:ConfigureFactory \
///     --rpc-url <rpc-url> \
///     --account <account-name> \
///     --broadcast \
///     -vvvv
///
///   Required environment variables:
///     FACTORY_ADDRESS - Address of the factory to configure
///
///   Optional environment variables:
///     CREATION_FEE - New creation fee in wei (default: 0.1 ether)
///     PROMO_SIGNER - Address of the promo code signer (default: skip if not set)
contract ConfigureFactory is Script {
    function run() external {
        // Get factory address (required)
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        require(factoryAddress != address(0), "FACTORY_ADDRESS not set");

        // Get optional parameters
        uint256 creationFee = vm.envOr("CREATION_FEE", uint256(0.1 ether));
        address promoSigner = vm.envOr("PROMO_SIGNER", address(0));

        IConfigurableFactory factory = IConfigurableFactory(factoryAddress);

        console2.log("=== Factory Configuration ===");
        console2.log("Factory Address:", factoryAddress);
        console2.log("Factory Owner:", factory.owner());
        console2.log("");
        console2.log("Current Configuration:");
        console2.log("  Creation Fee:", factory.creationFee());
        console2.log("  Promo Signer:", factory.promoSigner());
        console2.log("");
        console2.log("New Configuration:");
        console2.log("  Creation Fee:", creationFee);
        if (promoSigner != address(0)) {
            console2.log("  Promo Signer:", promoSigner);
        } else {
            console2.log("  Promo Signer: (unchanged)");
        }
        console2.log("");

        vm.startBroadcast();

        // Set creation fee
        factory.setCreationFee(creationFee);
        console2.log("setCreationFee() called");

        // Set promo signer (only if provided)
        if (promoSigner != address(0)) {
            factory.setPromoSigner(promoSigner);
            console2.log("setPromoSigner() called");
        }

        vm.stopBroadcast();

        // Verify configuration
        console2.log("");
        console2.log("=== Verification ===");
        console2.log("  Creation Fee:", factory.creationFee());
        console2.log("  Promo Signer:", factory.promoSigner());
        console2.log("");
        console2.log("Configuration complete!");
    }
}

/// @title ConfigureFactoryBatch
/// @notice Script to configure multiple factories at once
/// @dev Usage:
///   forge script script/ConfigureFactory.s.sol:ConfigureFactoryBatch \
///     --rpc-url <rpc-url> \
///     --account <account-name> \
///     --broadcast \
///     -vvvv
///
///   Required environment variables:
///     FACTORY_ADDRESSES - Comma-separated list of factory addresses
///
///   Optional environment variables:
///     CREATION_FEE - New creation fee in wei (default: 0.1 ether)
///     PROMO_SIGNER - Address of the promo code signer (default: skip if not set)
contract ConfigureFactoryBatch is Script {
    function run() external {
        // Get factory addresses (required)
        string memory factoryAddressesStr = vm.envString("FACTORY_ADDRESSES");
        address[] memory factoryAddresses = _parseAddresses(factoryAddressesStr);
        require(factoryAddresses.length > 0, "FACTORY_ADDRESSES not set or empty");

        // Get optional parameters
        uint256 creationFee = vm.envOr("CREATION_FEE", uint256(0.1 ether));
        address promoSigner = vm.envOr("PROMO_SIGNER", address(0));

        console2.log("=== Batch Factory Configuration ===");
        console2.log("Number of factories:", factoryAddresses.length);
        console2.log("Creation Fee:", creationFee);
        if (promoSigner != address(0)) {
            console2.log("Promo Signer:", promoSigner);
        }
        console2.log("");

        vm.startBroadcast();

        for (uint256 i = 0; i < factoryAddresses.length; i++) {
            address factoryAddress = factoryAddresses[i];
            IConfigurableFactory factory = IConfigurableFactory(factoryAddress);

            console2.log("Configuring factory:", factoryAddress);

            factory.setCreationFee(creationFee);

            if (promoSigner != address(0)) {
                factory.setPromoSigner(promoSigner);
            }

            console2.log("  Done");
        }

        vm.stopBroadcast();

        console2.log("");
        console2.log("Batch configuration complete!");
    }

    function _parseAddresses(
        string memory addressesStr
    ) internal pure returns (address[] memory) {
        // Simple comma-separated address parser
        bytes memory b = bytes(addressesStr);
        uint256 count = 1;

        // Count commas to determine array size
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ",") {
                count++;
            }
        }

        address[] memory addresses = new address[](count);
        uint256 start = 0;
        uint256 idx = 0;

        for (uint256 i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == ",") {
                bytes memory addrBytes = new bytes(i - start);
                for (uint256 j = start; j < i; j++) {
                    addrBytes[j - start] = b[j];
                }
                addresses[idx] = _parseAddress(string(addrBytes));
                idx++;
                start = i + 1;
            }
        }

        return addresses;
    }

    function _parseAddress(
        string memory addrStr
    ) internal pure returns (address) {
        bytes memory b = bytes(addrStr);

        // Skip leading whitespace and '0x' prefix
        uint256 start = 0;
        while (start < b.length && (b[start] == " " || b[start] == "\t")) {
            start++;
        }
        if (
            start + 1 < b.length && b[start] == "0" && (b[start + 1] == "x" || b[start + 1] == "X")
        ) {
            start += 2;
        }

        // Parse hex digits
        uint160 result = 0;
        for (uint256 i = start; i < b.length && i < start + 40; i++) {
            uint8 digit;
            if (b[i] >= "0" && b[i] <= "9") {
                digit = uint8(b[i]) - 48;
            } else if (b[i] >= "a" && b[i] <= "f") {
                digit = uint8(b[i]) - 87;
            } else if (b[i] >= "A" && b[i] <= "F") {
                digit = uint8(b[i]) - 55;
            } else {
                break;
            }
            result = result * 16 + digit;
        }

        return address(result);
    }
}
