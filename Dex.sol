// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LPToken.sol";

contract DEX {
    IERC20 public tokenA;
    IERC20 public tokenB;
    LPToken public lpToken;

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 public constant FEE_PERCENT = 3; // 0.3% fee (3/1000)

    mapping(address => uint256) public feeA;
    mapping(address => uint256) public feeB;

    address[] public lpHolders;
    mapping(address => bool) public isLP;

    constructor(address _tokenA, address _tokenB, address _lpToken) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        lpToken = LPToken(_lpToken);
    }
    /// @notice Returns amount of TokenB required to maintain pool ratio for given amountA
    function getRequiredBforA(uint256 amountA) external view returns (uint256) {
        require(reserveA > 0 && reserveB > 0, "Pool not initialized");
        return (amountA * reserveB) / reserveA;
    }

    /// @notice Returns amount of TokenA required to maintain pool ratio for given amountB
    function getRequiredAforB(uint256 amountB) external view returns (uint256) {
        require(reserveA > 0 && reserveB > 0, "Pool not initialized");
        return (amountB * reserveA) / reserveB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Amounts must be non-zero");
        require(tokenA.allowance(msg.sender, address(this)) >= amountA, "TokenA not approved");
        require(tokenB.allowance(msg.sender, address(this)) >= amountB, "TokenB not approved");

        if (reserveA > 0 && reserveB > 0) {
            uint256 expectedB = (reserveB * amountA) / reserveA;
            require(amountB >= expectedB && amountB <= expectedB + 1, "Ratio not preserved");
        }

        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        uint256 lpAmount;
        if (lpToken.totalSupply() == 0) {
            lpAmount = sqrt(amountA * amountB);
        } else {
            lpAmount = min(
                (amountA * lpToken.totalSupply()) / reserveA,
                (amountB * lpToken.totalSupply()) / reserveB
            );
        }

        lpToken.mint(msg.sender, lpAmount);

        reserveA += amountA;
        reserveB += amountB;

        _trackLP(msg.sender);
    }

    function removeLiquidity(uint256 lpAmount) external {
        require(lpAmount > 0, "LP amount must be greater than zero");

        uint256 totalSupply = lpToken.totalSupply();
        require(totalSupply > 0, "No liquidity");

        uint256 amountA = (lpAmount * reserveA) / totalSupply;
        uint256 amountB = (lpAmount * reserveB) / totalSupply;

        uint256 earnedFeeA = feeA[msg.sender];
        uint256 earnedFeeB = feeB[msg.sender];

        lpToken.burn(msg.sender, lpAmount);

        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.transfer(msg.sender, amountA + earnedFeeA);
        tokenB.transfer(msg.sender, amountB + earnedFeeB);

        feeA[msg.sender] = 0;
        feeB[msg.sender] = 0;
    }

    function spotPrice() public view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }


    function swapAforB(uint256 amountAIn) external {
        require(amountAIn > 0, "Amount must be greater than zero");

        uint256 amountAInWithFee = (amountAIn * (1000 - FEE_PERCENT)) / 1000;
        uint256 fee = amountAIn - amountAInWithFee;

        uint256 amountBOut = (reserveB * amountAInWithFee) / (reserveA + amountAInWithFee);

        tokenA.transferFrom(msg.sender, address(this), amountAIn);
        tokenB.transfer(msg.sender, amountBOut);

        reserveA += amountAInWithFee;
        reserveB -= amountBOut;

        _distributeFeeA(fee);
    }

    function swapBforA(uint256 amountBIn) external {
        require(amountBIn > 0, "Amount must be greater than zero");

        uint256 amountBInWithFee = (amountBIn * (1000 - FEE_PERCENT)) / 1000;
        uint256 fee = amountBIn - amountBInWithFee;

        uint256 amountAOut = (reserveA * amountBInWithFee) / (reserveB + amountBInWithFee);

        tokenB.transferFrom(msg.sender, address(this), amountBIn);
        tokenA.transfer(msg.sender, amountAOut);

        reserveB += amountBInWithFee;
        reserveA -= amountAOut;

        _distributeFeeB(fee);
    }

    function getTVL() external view returns (uint256) {
        return reserveA+reserveA;
    }

    function getK() external view returns (uint256) {
        return reserveA * reserveB;
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _trackLP(address user) internal {
        if (!isLP[user]) {
            lpHolders.push(user);
            isLP[user] = true;
        }
    }

    function _distributeFeeA(uint256 fee) internal {
        uint256 supply = lpToken.totalSupply();
        if (supply == 0 || fee == 0) return;

        for (uint i = 0; i < lpHolders.length; i++) {
            address lp = lpHolders[i];
            uint256 share = lpToken.balanceOf(lp);
            if (share > 0) {
                feeA[lp] += (fee * share) / supply;
            }
        }
    }

    function _distributeFeeB(uint256 fee) internal {
        uint256 supply = lpToken.totalSupply();
        if (supply == 0 || fee == 0) return;

        for (uint i = 0; i < lpHolders.length; i++) {
            address lp = lpHolders[i];
            uint256 share = lpToken.balanceOf(lp);
            if (share > 0) {
                feeB[lp] += (fee * share) / supply;
            }
        }
    }
}