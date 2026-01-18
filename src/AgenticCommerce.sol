// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AgenticCommerce {

    // ---- Core ----
    address public merchant;
    address public usdcToken;
    bool public paused;

    mapping(uint256 => uint256) public productPrices;

    // ---- Replay protection ----
    mapping(bytes32 => bool) public usedReceipts;

    // ---- AI Agent System ----
    mapping(address => bool) public approvedAgents;
    mapping(address => uint256) public dailyLimit;
    mapping(address => uint256) public spentToday;
    mapping(address => uint256) public lastSpendDay;
    


    // ---- Subscriptions ----
    mapping(address => uint256) public subscriptionExpiry;

    // ---- Events ----
    event ProductPaid(address indexed buyer, uint256 indexed productId, uint256 amount);
    event AgentRegistered(address agent);
    event AgentRevoked(address agent);
    event AIPurchaseIntent(address agent, uint256 productId, string task);
    event Refunded(address buyer, uint256 amount);

    constructor(address _usdcToken) {
        merchant = msg.sender;
        usdcToken = _usdcToken;
    }

    modifier onlyMerchant() {
        require(msg.sender == merchant, "Not merchant");
        _;
    }

    modifier notPaused() {
        require(!paused, "Payments paused");
        _;
    }

    function setDailyLimit(address agent, uint256 amount) external onlyMerchant {
    dailyLimit[agent] = amount;
}

function _currentDay() internal view returns (uint256) {
    return block.timestamp / 1 days;
}

    // --------------------
    // Admin
    // --------------------

    function setProductPrice(uint256 productId, uint256 price) external onlyMerchant {
        productPrices[productId] = price;
    }

    function pausePayments() external onlyMerchant {
        paused = true;
    }

    function resumePayments() external onlyMerchant {
        paused = false;
    }

    // --------------------
    // AI Agent Management
    // --------------------

    function registerAgent(address agent, uint256 limitPerDay) external onlyMerchant {
        approvedAgents[agent] = true;
        dailyLimit[agent] = limitPerDay;
        emit AgentRegistered(agent);
    }

    function revokeAgent(address agent) external onlyMerchant {
        approvedAgents[agent] = false;
        emit AgentRevoked(agent);
    }

    function _checkAgentLimit(address agent, uint256 amount) internal {
        uint256 today = _currentDay();

        if (lastSpendDay[agent] < today) {
            spentToday[agent] = 0;
            lastSpendDay[agent] = today;
        }

        require(spentToday[agent] + amount <= dailyLimit[agent], "AI daily limit exceeded");

        spentToday[agent] += amount;
    }

    // --------------------
    // Payments
    // --------------------

    function payForProduct(
        uint256 productId,
        string calldata task,
        bytes32 receiptId
    ) external notPaused {

        require(!usedReceipts[receiptId], "Receipt already used");
        usedReceipts[receiptId] = true;

        uint256 price = productPrices[productId];
        require(price > 0, "Product not priced");

        if (approvedAgents[msg.sender]) {
            _checkAgentLimit(msg.sender, price);
            emit AIPurchaseIntent(msg.sender, productId, task);
        }

        IERC20(usdcToken).transferFrom(msg.sender, address(this), price);

        emit ProductPaid(msg.sender, productId, price);
    }

    // --------------------
    // Subscriptions
    // --------------------

    function subscribe(uint256 durationDays, uint256 amount) external notPaused {
        IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
        subscriptionExpiry[msg.sender] = block.timestamp + (durationDays * 1 days);
    }

    function hasActiveSubscription(address user) external view returns (bool) {
        return subscriptionExpiry[user] > block.timestamp;
    }

    // --------------------
    // Refunds
    // --------------------

    function refund(address buyer, uint256 amount) external onlyMerchant {
        IERC20(usdcToken).transfer(buyer, amount);
        emit Refunded(buyer, amount);
    }

    // --------------------
    // Withdraw
    // --------------------

    function withdraw() external onlyMerchant {
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        IERC20(usdcToken).transfer(merchant, balance);
    }
}
