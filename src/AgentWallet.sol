// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
}

contract AgentWallet {
    address public owner;
    address public manager;

    uint256 public dailyLimit;
    uint256 public spentToday;
    uint256 public lastDay;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Not manager");
        _;
    }

    constructor(address _owner, address _manager, uint256 _dailyLimit) {
        owner = _owner;
        manager = _manager;
        dailyLimit = _dailyLimit;
        lastDay = block.timestamp / 1 days;
    }

    /* ========== CONFIG ========== */

    function updateDailyLimit(uint256 newLimit) external onlyOwner {
        dailyLimit = newLimit;
    }

    /* ========== WITHDRAWALS ========== */

    function withdrawETH(address to, uint256 amount) external onlyOwner {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    /* ========== AI EXECUTION ========== */

    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 amountUSDC
    ) external onlyManager {
        _checkLimit(amountUSDC);

        (bool ok, ) = target.call{value: value}(data);
        require(ok, "Call failed");
    }

    /* ========== LIMIT LOGIC ========== */

    function _checkLimit(uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;

        if (today != lastDay) {
            spentToday = 0;
            lastDay = today;
        }

        require(spentToday + amount <= dailyLimit, "Daily limit exceeded");

        spentToday += amount;
    }

    receive() external payable {}
}
