# CS765 Homework 3 – DEX and Arbitrage Simulation

This project implements a simplified Decentralized Exchange (DEX) using Solidity and simulates user behavior including liquidity provision, token swaps, and arbitrage opportunities. All contracts and scripts are designed to be run on the **Remix IDE**.

This project was completed as part of the **Spring 2025 offering of _Introduction to Blockchains, Cryptocurrencies, and Smart Contracts (CS765)_ at IIT Bombay**.

---

## 📁 File Structure and Instructions

Place all `.sol` files inside the `contracts/` directory in Remix.  
The JavaScript simulation scripts can be placed anywhere (preferably under `scripts/`).  
Both can be executed directly using the Remix terminal.

```
contracts/
├── Token.sol            # Basic ERC20 token used as TokenA and TokenB
├── LPToken.sol          # ERC20-compatible token representing LP shares
├── DEX.sol              # Core Automated Market Maker (x * y = k)
├── Arbitrage.sol        # Smart contract for detecting & executing arbitrage

scripts/
├── simulate_DEX.js          # Simulation of LP + Trader activity on one DEX
├── simulate_arbitrage.js    # Simulation of arbitrage across two DEXs
```

---

## 🔁 Simulation 1: DEX Activity (Liquidity + Swaps)

**Script:** `simulate_DEX.js`  
**Function:** `deployAndSimulateDEX()`  
**Goal:** Simulate a full trading environment on a single DEX instance.

### **What the script does**
- Deploys **TokenA**, **TokenB**, **LPToken**, and **DEX**.
- Distributes **10,000 TokenA & TokenB** to 8 users:
  - **5 LPs**
  - **3 traders**
- LPs add initial liquidity to bootstrap the pool.
- Generates **50–100 random actions**, including:
  - Adding / removing liquidity  
  - Token swaps (TokenA ↔ TokenB)
- Logs:
  - Swap details  
  - Liquidity events  
  - Final DEX **reserves** and **TVL**

### **How to run**
1. Open `DEX.sol`, `Token.sol`, and `LPToken.sol` in Remix under **contracts/** and compile them.
2. Open `simulate_DEX.js` and click **Run**.
3. View swap logs, liquidity updates, and final pool state in the Remix console.

---

## 💱 Simulation 2: Arbitrage Detection & Execution

**Script:** `simulate_arbitrage.js`  
**Purpose:** Simulate arbitrage opportunities across two independent DEX pools.

### **What the script does**
- Deploys **two DEX instances** each with:
  - TokenA, TokenB  
  - LPToken  
- LPs set **different reserve ratios** to create price differences.
- Executes **10 random swaps** on each DEX to add volatility.
- Uses `Arbitrage.sol` to:
  - Detect profitable arbitrage opportunities  
  - Evaluate four possible trading paths:  
    - A → B → A (across DEX1 & DEX2)  
    - B → A → B (across DEX1 & DEX2)
  - Execute arbitrage if **profit > threshold**

### **How to run**
1. Open `Arbitrage.sol`, `DEX.sol`, `Token.sol`, and `LPToken.sol` in Remix.
2. Run `simulate_arbitrage.js`.
3. Check the console for:
   - Detected arbitrage paths  
   - Profit calculations  
   - Execution success/failure logs

---

## ✔️ Summary

This project demonstrates:
- AMM-based DEX implementation (Uniswap V2–style `x*y=k`)
- LP token issuance and liquidity mechanics
- Simulating swaps, liquidity dynamics, slippage, and pool state
- Arbitrage detection and execution across inconsistent pricing environments
