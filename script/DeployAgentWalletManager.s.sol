// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWalletManager.sol";

contract DeployAgentWalletManager is Script {
    function run() external {
        vm.startBroadcast();

        AgentWalletManager manager = new AgentWalletManager();

        vm.stopBroadcast();

        console.log("AgentWalletManager deployed at:", address(manager));
    }
}
