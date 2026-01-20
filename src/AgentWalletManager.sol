// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentWallet.sol";

interface IAgentWallet {
    function updateDailyLimit(uint256 newLimit) external;
    function withdraw(address to, uint256 amount) external;
}


contract AgentWalletManager {
    event AgentCreated(address indexed user, address agentWallet);
    event LimitUpdated(address indexed agentWallet, uint256 newLimit);

    mapping(address => address) public userToAgent;
    mapping(address => address) public agentToUser;

    function createAgentWallet(uint256 dailyLimit) external returns (address) {
    require(userToAgent[msg.sender] == address(0), "Agent already exists");

    AgentWallet wallet = new AgentWallet(
        msg.sender,
        address(this),
        dailyLimit
    );

    address agentAddress = address(wallet);

    userToAgent[msg.sender] = agentAddress;
    agentToUser[agentAddress] = msg.sender;

    emit AgentCreated(msg.sender, agentAddress);

    return agentAddress;
}


    function setDailyLimit(uint256 newLimit) external {
    address payable agent = payable(userToAgent[msg.sender]);
    require(agent != address(0), "No agent");

    IAgentWallet(agent).updateDailyLimit(newLimit);
}

function withdraw(uint256 amount) external {
    address payable agent = payable(userToAgent[msg.sender]);
    require(agent != address(0), "No agent");

    IAgentWallet(agent).withdraw(msg.sender, amount);
}


    function getMyAgent() external view returns (address) {
        return userToAgent[msg.sender];
    }
}
