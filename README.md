CS765 Homework 3 – DEX and Arbitrage Simulation

This project implements a simplified Decentralized Exchange (DEX) using Solidity and simulates user behavior including liquidity provision, token swaps, and arbitrage opportunities. All contracts and scripts are to be run on the Remix IDE (https://remix.ethereum.org).This project was completed as part of the Spring 2025 offering of Introduction to Blockchains, Cryptocurrencies, and Smart Contracts (CS765) at IITB.

---

File Structure and Instructions

You should place all `.sol` files under the `contracts/` directory in Remix. You can place the JavaScript files anywhere in thee directory structure, preferably in the contract  or can be executed from the Remix terminal.

contracts/
├── Token.sol          # Basic ERC20 Token used as TokenA and TokenB
├── LPToken.sol        # ERC20-compatible token representing LP shares
├── DEX.sol            # Core Automated Market Maker contract (x*y=k)
├── Arbitrage.sol      # Smart contract to detect and execute arbitrage

scripts/
├── simulate_DEX.js     # Script to simulate LP + Trader activity on one DEX
├── simulate_arbitrage.js       # Script to simulate arbitrage across two DEXs



Simulation 1: DEX Activity with Liquidity and Swaps

Script: deployAndSimulateDEX()

Purpose: Simulates a full trading environment on a single DEX.

What it does:
- Deploys TokenA, TokenB, LPToken, and DEX.
- Sends 10,000 TokenA and TokenB to 8 users (5 LPs and 3 traders).
- LPs add initial liquidity to the DEX.
- 50-100 random transactions are generated:
  - LPs can add/remove liquidity.
  - Traders can swap TokenA ↔ TokenB.
- At the end, the final reserves and TVL (Total Value Locked) are logged.

How to run:
1. Open DEX.sol, Token.sol, and LPToken.sol in Remix's contracts/ folder, compile them.
2. open the simulate_DEX.js in remix and press the run button.
3. Observe swap logs, LP behavior, and final pool status in the console.

---

Simulation 2: Arbitrage Detection and Execution

Script: simulate_arbitrage.js

Purpose: Tests the arbitrage smart contract between two DEX instances.

What it does:
- Deploys 2 DEXes, each with TokenA, TokenB, and LPToken.
- Different reserve ratios are set by LPs.
- 10 random swaps are executed on both DEXs to simulate volatility.
- The Arbitrage.sol contract:
  - Detects if a profitable arbitrage exists.
  - Chooses from 4 trade paths: A→B→A or B→A→B across DEX1 and DEX2.
  - Executes arbitrage if profit exceeds a threshold.
- Logs whether the arbitrage succeeded or failed and prints profit.

How to run:
1. Open Arbitrage.sol, DEX.sol, Token.sol, and LPToken.sol in Remix's contracts/ folder.
2. Run the simulate_arbitrage.js script.
3. Execute and check the console for arbitrage details and logs.
