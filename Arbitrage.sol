// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDex {
    function spotPrice() external view returns (uint256, uint256);
    function swapAforB(uint256 amountAIn) external;
    function swapBforA(uint256 amountBIn) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract Arbitrage {
    address public dex1;
    address public dex2;
    IERC20 public tokenA;
    IERC20 public tokenB;

    constructor(address _dex1, address _dex2, address _tokenA, address _tokenB) {
        dex1 = _dex1;
        dex2 = _dex2;
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function executeArbitrage(uint256 input,uint256 threshold) external returns (bool){
        // uint256 input = 100000000000000000000; // Fixed input of 10 tokens
        uint256 profit;
        uint8 bestPath;

        // Get reserves from both DEXes
        // (uint256 rA1, uint256 rB1) = (IDex(dex1).reserveA(), IDex(dex1).reserveB());
        // (uint256 rA2, uint256 rB2) = (IDex(dex2).reserveA(), IDex(dex2).reserveB());
        (uint256 rA1, uint256 rB1) = IDex(dex1).spotPrice();
        (uint256 rA2, uint256 rB2) = IDex(dex2).spotPrice();

        // Simulate all 4 arbitrage paths using AMM math with fee
        uint256 results;
        bool ret;
        // Path 1: A -> B (DEX1), then B -> A (DEX2)
        uint256 b1 = getAmountOut(input, rA1, rB1);
        results = getAmountOut(b1, rB2, rA2);
        if (results > input && results - input > profit) {
            profit = results - input;
            bestPath = 1;
        }
        // Path 2: A -> B (DEX2), then B -> A (DEX1)
        b1 = getAmountOut(input, rA2, rB2);
        results = getAmountOut(b1, rB1, rA1);
        if (results > input && results - input > profit) {
            profit = results - input;
            bestPath = 2;
        }

        // Path 3: B -> A (DEX1), then A -> B (DEX2)
        b1 = getAmountOut(input, rB1, rA1);
        results = getAmountOut(b1, rA2, rB2);
        if (results > input && results - input > profit) {
            profit = results - input;
            bestPath = 3;
        }

        // Path 4: B -> A (DEX2), then A -> B (DEX1)
        b1 = getAmountOut(input, rB2, rA2);
        results = getAmountOut(b1, rA1, rB1);
        if (results > input && results - input > profit) {
            profit = results - input;
            bestPath = 4;
        }

        // Calculate profit over input
        // for (uint8 i = 0; i < 4; i++) {
        //     if (results[i] > input && results[i] - input > profit) {
        //         profit = results[i] - input;
        //         bestPath = i + 1;
        //     }
        // }

        if (profit <= threshold) {
            bestPath = 0; // ❌ No profitable path
        }
        
        

        // ✅ Execute the best path
        if (bestPath == 1) {
            uint256 initial_B = tokenB.balanceOf(address(this));
            tokenA.approve(dex1, input);
            IDex(dex1).swapAforB(input);
            uint256 bOut = tokenB.balanceOf(address(this)) - initial_B;
            tokenB.approve(dex2, bOut);
            IDex(dex2).swapBforA(bOut);
            ret=true;
        } else if (bestPath == 2) {
            uint256 initial_B = tokenB.balanceOf(address(this));
            tokenA.approve(dex2, input);
            IDex(dex2).swapAforB(input);
            uint256 bOut = tokenB.balanceOf(address(this)) - initial_B;
            tokenB.approve(dex1, bOut);
            IDex(dex1).swapBforA(bOut);
            ret=false;
        } else if (bestPath == 3) {
            uint256 initial_A = tokenA.balanceOf(address(this));
            tokenB.approve(dex1, input);
            IDex(dex1).swapBforA(input);
            uint256 aOut = tokenA.balanceOf(address(this)) - initial_A;
            tokenA.approve(dex2, aOut);
            IDex(dex2).swapAforB(aOut);
            ret=true;
        } else if (bestPath == 4) {
            uint256 initial_A = tokenA.balanceOf(address(this));
            tokenB.approve(dex2, input);
            IDex(dex2).swapBforA(input);
            uint256 aOut = tokenA.balanceOf(address(this)) - initial_A;
            tokenA.approve(dex1, aOut);
            IDex(dex1).swapAforB(aOut);
            ret=false;
        }
        uint256 finalA = tokenA.balanceOf(address(this));
        uint256 finalB = tokenB.balanceOf(address(this));

        if (finalA > 0) {
            require(tokenA.transfer(msg.sender, finalA), "TokenA transfer failed");
        }
        if (finalB > 0) {
            require(tokenB.transfer(msg.sender, finalB), "TokenB transfer failed");
        }
        return ret;
    }

    /// @dev AMM constant product formula with 0.3% fee
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = (amountIn * 997) / 1000;
        return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    }
}
