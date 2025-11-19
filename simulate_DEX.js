async function deployAndSimulateDEX() {
  console.log("🚀 Deploying DEX system...");

  const plotData = {
    time: [],
    tvl: [],
    reserveRatio: [],
    lpDistribution: {},
    cumulativeLP: [],
    swapVolumeA: [],
    swapVolumeB: [],
    cumulativeSwapVolumeA: 0,
    cumulativeSwapVolumeB: 0,
    feeAccumulation: [],
    cumulativeFees: 0,
    spotPrice: [],
    slippage: [],
    tradeLotFraction: [], 
    swapType: [] 
  };

  const tokenACompiled = JSON.parse(await remix.call('fileManager', 'getFile', 'contracts/artifacts/TokenA.json'));
  const tokenBCompiled = JSON.parse(await remix.call('fileManager', 'getFile', 'contracts/artifacts/TokenB.json'));
  const lpTokenCompiled = JSON.parse(await remix.call('fileManager', 'getFile', 'contracts/artifacts/LPToken.json'));
  const dexCompiled = JSON.parse(await remix.call('fileManager', 'getFile', 'contracts/artifacts/DEX.json'));

  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];

  // Deploy TokenA and TokenB
  const TokenA = new web3.eth.Contract(tokenACompiled.abi);
  const tokenAInstance = await TokenA.deploy({
    data: '0x' + tokenACompiled.data.bytecode.object
  }).send({ from: deployer, gas: 3000000 });

  const TokenB = new web3.eth.Contract(tokenBCompiled.abi);
  const tokenBInstance = await TokenB.deploy({
    data: '0x' + tokenBCompiled.data.bytecode.object
  }).send({ from: deployer, gas: 3000000 });

  // Deploy LPToken
  const LPToken = new web3.eth.Contract(lpTokenCompiled.abi);
  const lpTokenInstance = await LPToken.deploy({
    data: '0x' + lpTokenCompiled.data.bytecode.object,
    arguments: [deployer]
  }).send({ from: deployer, gas: 3000000 });

  // Deploy DEX
  const DEX = new web3.eth.Contract(dexCompiled.abi);
  const dexInstance = await DEX.deploy({
    data: '0x' + dexCompiled.data.bytecode.object,
    arguments: [tokenAInstance.options.address, tokenBInstance.options.address, lpTokenInstance.options.address]
  }).send({ from: deployer, gas: 5000000 });

  // Transfer LPToken ownership to DEX
  await lpTokenInstance.methods.transferOwnership(dexInstance.options.address).send({ from: deployer });

  console.log("✅ All contracts deployed.");

  // ---------- EMULATION ----------
  console.log("🎮 Running full simulation...");

  const tokenA = tokenAInstance;
  const tokenB = tokenBInstance;
  const lpToken = lpTokenInstance;
  const dex = dexInstance;

  const N = 100; // Number of transactions
  const LPs = accounts.slice(0, 5);
  const Traders = accounts.slice(5, 13);
  const Users = LPs.concat(Traders);

  LPs.forEach(lp => {
    plotData.lpDistribution[lp] = [];
  });

  const mintAmount = web3.utils.toWei("10000");
  for (const user of Users) {
    await tokenA.methods.transfer(user, mintAmount).send({ from: deployer });
    await tokenB.methods.transfer(user, mintAmount).send({ from: deployer });
  }
  console.log("10000 tokens of A and B sent to every user from the deployer");

  // Initialize the pool
  console.log("Need to initialize the pool");
  const seedA = web3.utils.toWei("1000");
  const seedB = web3.utils.toWei("1000");

  // Initialize arrays for tracking volume and fees for each transaction
  for (let i = 0; i <= N; i++) {
    plotData.swapVolumeA.push(0);
    plotData.swapVolumeB.push(0);
    plotData.feeAccumulation.push(0);
  }

  // Each LP deposits liquidity initially
  for (const user of LPs) {
    await tokenA.methods.approve(dex.options.address, seedA).send({ from: user });
    await tokenB.methods.approve(dex.options.address, seedB).send({ from: user });
    await dex.methods.addLiquidity(seedA, seedB).send({ from: user });
    console.log(`Liquidity of 1000 TokenA + 1000 TokenB have been added by: ${user}`);

    const lp = await lpToken.methods.balanceOf(user).call();
    console.log(`${user} has tokens: ${web3.utils.fromWei(lp)}`);

    // Record the initial LP distribution snapshot for each LP
    plotData.lpDistribution[user].push(web3.utils.fromWei(lp));
  }

  // Record initial metrics
  const initialSpot = await dex.methods.spotPrice().call();
  const initialReserveA = initialSpot._reserveA;
  const initialReserveB = initialSpot._reserveB;
  const initialSpotPrice = BigInt(initialReserveB) !== BigInt(0) ? 
    Number(BigInt(initialReserveB) * BigInt(10 ** 18) / BigInt(initialReserveA)) / 10 ** 18 : 0;
  const initialTVL = await dex.methods.getTVL().call();

  plotData.time.push(0);
  plotData.tvl.push(web3.utils.fromWei(initialTVL));
  plotData.reserveRatio.push(
    BigInt(initialReserveA) !== BigInt(0)
      ? Number(BigInt(initialReserveB) * BigInt(10 ** 18) / BigInt(initialReserveA)) / 10 ** 18
      : 0
  );
  plotData.spotPrice.push(initialSpotPrice.toString());

  // Also record initial global cumulative LP balance across all LPs
  let initialTotalLP = 0;
  for (const lp of LPs) {
    const bal = await lpToken.methods.balanceOf(lp).call();
    initialTotalLP += Number(web3.utils.fromWei(bal));
  }
  plotData.cumulativeLP.push(initialTotalLP);

  console.log(`Initial Reserves:
TokenA: ${web3.utils.fromWei(initialReserveA)} TokenB: ${web3.utils.fromWei(initialReserveB)} and TVL: ${web3.utils.fromWei(initialTVL)}`);
  console.log(`Initial Spot Price (B/A): ${initialSpotPrice}`);

  // Run N transactions
  for (let i = 0; i < N; i++) {
    const user_id = Math.floor(Math.random() * Users.length);
    const user = Users[user_id];
    let actionIndex;
    if (user_id < 5) actionIndex = 2 + Math.floor(Math.random() * 2); // LPs
    else actionIndex = Math.floor(Math.random() * 2); // Traders
    const action = ["swapAforB", "swapBforA", "addLiquidity", "removeLiquidity"][actionIndex];

    const balanceA = await tokenA.methods.balanceOf(user).call();
    const balanceB = await tokenB.methods.balanceOf(user).call();
    const lpBalance = await lpToken.methods.balanceOf(user).call();

    // Get reserves from spotPrice()
    const spot = await dex.methods.spotPrice().call();
    const reserveA = spot._reserveA;
    const reserveB = spot._reserveB;
    const spotPriceBefore = BigInt(reserveB) !== BigInt(0) ?
      Number(BigInt(reserveB) * BigInt(10 ** 18) / BigInt(reserveA)) / 10 ** 18 : 0;

    console.log(`Transaction ${i + 1}: user_id:${user_id} and action:${action}`);

    try {
      if (action === "swapAforB") {
        let maximum;
        const maxReserveAmount = BigInt(reserveA) / BigInt(10); // 10% of reserve
        if (BigInt(maxReserveAmount) > BigInt(balanceA)) {
          maximum = balanceA;
        } else {
          maximum = maxReserveAmount.toString();
        }
        const randomFraction = Math.floor(Math.random() * 1001); // 0 to 1000
        const amount = (BigInt(maximum) * BigInt(randomFraction)) / BigInt(1000); // Random amount up to maximum
        if (BigInt(amount) > BigInt(0)) {
          // Calculate trade lot fraction - as percentage of reserve
          const tradeLotFractionValue = Number(BigInt(amount) * BigInt(10000) / BigInt(reserveA)) / 100;
          
          // Get expected output based on constant product formula before fees
          const expectedOutput = (BigInt(reserveB) * BigInt(amount)) / (BigInt(reserveA) + BigInt(amount));
          // Execute swap
          await tokenA.methods.approve(dex.options.address, amount.toString()).send({ from: user });
          await dex.methods.swapAforB(amount.toString()).send({ from: user });
          // Calculate actual output and slippage
          const newSpot = await dex.methods.spotPrice().call();
          const newReserveB = newSpot._reserveB;
          const actualOutput = BigInt(reserveB) - BigInt(newReserveB);
          // Calculate slippage percentage
          const expectedPrice = Number(BigInt(reserveB) * BigInt(10 ** 18) / BigInt(reserveA)) / 10 ** 18;
          const actualPrice = Number(actualOutput * BigInt(10 ** 18) / BigInt(amount)) / 10 ** 18;
          const slippagePercent = ((actualPrice - expectedPrice) / expectedPrice) * 100;
          // Update metrics
          const amountInEth = Number(web3.utils.fromWei(amount.toString()));
          plotData.cumulativeSwapVolumeA += amountInEth;
          // Use exact 0.3% fee as specified in the PDF
          const fee = amountInEth * 0.003; // 0.3% fee
          plotData.cumulativeFees += fee;
          plotData.slippage.push(slippagePercent);
          plotData.tradeLotFraction.push(tradeLotFractionValue);
          plotData.swapType.push("AforB");
          console.log(`🔄 ${user} swapped ${web3.utils.fromWei(amount.toString())} A for ${web3.utils.fromWei(actualOutput.toString())} B (Slippage: ${slippagePercent.toFixed(4)}%, Trade Fraction: ${tradeLotFractionValue.toFixed(2)}%)`);
        } else {
          console.log(`⚠️ ${user} 0 amount was generated randomly to swap`);
        }
      } else if (action === "swapBforA" && BigInt(reserveA) > BigInt(0)) {
        let maximum;
        const maxReserveAmount = BigInt(reserveB) / BigInt(10); // 10% of reserve
        if (BigInt(maxReserveAmount) > BigInt(balanceB)) {
          maximum = balanceB;
        } else {
          maximum = maxReserveAmount.toString();
        }
        const randomFraction = Math.floor(Math.random() * 1001); // 0 to 1000
        const amount = (BigInt(maximum) * BigInt(randomFraction)) / BigInt(1000); // Random amount up to maximum
        if (BigInt(amount) > BigInt(0)) {
          // Calculate trade lot fraction - as percentage of reserve
          const tradeLotFractionValue = Number(BigInt(amount) * BigInt(10000) / BigInt(reserveB)) / 100;
          
          // Get expected output based on constant product formula before fees
          const expectedOutput = (BigInt(reserveA) * BigInt(amount)) / (BigInt(reserveB) + BigInt(amount));
          // Execute swap
          await tokenB.methods.approve(dex.options.address, amount.toString()).send({ from: user });
          await dex.methods.swapBforA(amount.toString()).send({ from: user });
          // Calculate actual output and slippage
          const newSpot = await dex.methods.spotPrice().call();
          const newReserveA = newSpot._reserveA;
          const actualOutput = BigInt(reserveA) - BigInt(newReserveA);
          // Calculate slippage percentage
          const expectedPrice = Number(BigInt(reserveA) * BigInt(10 ** 18) / BigInt(reserveB)) / 10 ** 18;
          const actualPrice = Number(actualOutput * BigInt(10 ** 18) / BigInt(amount)) / 10 ** 18;
          const slippagePercent = ((actualPrice - expectedPrice) / expectedPrice) * 100;
          // Update metrics
          const amountInEth = Number(web3.utils.fromWei(amount.toString()));
          plotData.cumulativeSwapVolumeB += amountInEth;
          // Use exact 0.3% fee as specified in the PDF
          const fee = amountInEth * 0.003; // 0.3% fee
          plotData.cumulativeFees += fee;
          plotData.slippage.push(slippagePercent);
          plotData.tradeLotFraction.push(tradeLotFractionValue);
          plotData.swapType.push("BforA");
          console.log(`🔄 ${user} swapped ${web3.utils.fromWei(amount.toString())} B for ${web3.utils.fromWei(actualOutput.toString())} A (Slippage: ${slippagePercent.toFixed(4)}%, Trade Fraction: ${tradeLotFractionValue.toFixed(2)}%)`);
        } else {
          console.log(`⚠️ ${user} didn't have enough B to swap`);
        }
      } else if (action === "addLiquidity") {
        let maximum;
        const rsx = await dex.methods.getRequiredAforB(balanceB).call();
        if (BigInt(rsx) > BigInt(balanceA)) {
          maximum = balanceA;
        } else {
          maximum = rsx;
        }
        const randomFraction = Math.floor(Math.random() * 1001); // 0 to 1000
        // console.log(maximum);
        const amountA = (BigInt(maximum) * BigInt(randomFraction)) / BigInt(1000);
        const requiredB = await dex.methods.getRequiredBforA(amountA).call();
        if (BigInt(amountA) > BigInt(0)) {
          await tokenA.methods.approve(dex.options.address, amountA.toString()).send({ from: user });
          await tokenB.methods.approve(dex.options.address, requiredB.toString()).send({ from: user });
          await dex.methods.addLiquidity(amountA.toString(), requiredB.toString()).send({ from: user });
          console.log(`💧 ${user} added liquidity ${web3.utils.fromWei(amountA.toString())} TokenA and ${web3.utils.fromWei(requiredB.toString())} TokenB`);
        } else {
          console.log("Can't add 0 liquidity");
        }
      } else if (action === "removeLiquidity") {
        const randomFraction = Math.floor(Math.random() * 1001); // 0 to 1000
        const amount = (BigInt(lpBalance) * BigInt(randomFraction)) / BigInt(1000);
        if (BigInt(lpBalance) >= BigInt(amount) && BigInt(amount) > BigInt(0)) {
          await lpToken.methods.approve(dex.options.address, amount.toString()).send({ from: user });
          await dex.methods.removeLiquidity(amount.toString()).send({ from: user });
          console.log(`🧼 ${user} removed ${web3.utils.fromWei(amount.toString())} LP`);
        } else {
          console.log("Don't have any LP tokens to withdraw or amount is 0");
        }
      }

      // Record metrics after each transaction
      const currentSpot = await dex.methods.spotPrice().call();
      const currentReserveA = currentSpot._reserveA;
      const currentReserveB = currentSpot._reserveB;
      const currentSpotPrice = BigInt(currentReserveA) !== BigInt(0) ?
        Number(BigInt(currentReserveB) * BigInt(10 ** 18) / BigInt(currentReserveA)) / 10 ** 18 : 0;
      const currentTVL = await dex.methods.getTVL().call();

      plotData.time.push(i + 1);
      plotData.tvl.push(web3.utils.fromWei(currentTVL));
      plotData.reserveRatio.push(
        BigInt(currentReserveA) !== BigInt(0)
          ? Number(BigInt(currentReserveB) * BigInt(10 ** 18) / BigInt(currentReserveA)) / 10 ** 18
          : 0
      );
      plotData.spotPrice.push(currentSpotPrice.toString());

      // Update LP distribution for all LP addresses (only once per iteration)
      for (const lp of LPs) {
        const balance = await lpToken.methods.balanceOf(lp).call();
        plotData.lpDistribution[lp].push(web3.utils.fromWei(balance));
      }

      // Calculate and record the total LP balance across all LPs (optional)
      let totalLPBalance = 0;
      for (const lp of LPs) {
        const balance = await lpToken.methods.balanceOf(lp).call();
        totalLPBalance += Number(web3.utils.fromWei(balance));
      }
      plotData.cumulativeLP.push(totalLPBalance);
      plotData.swapVolumeB[i + 1] = plotData.cumulativeSwapVolumeB;
      plotData.swapVolumeA[i + 1] = plotData.cumulativeSwapVolumeA;
      plotData.feeAccumulation[i + 1] = plotData.cumulativeFees;


    } catch (e) {
      console.log(`❌ Action ${action} failed for ${user.slice(0, 6)},`, e);
    }
  }

  const finalSpot = await dex.methods.spotPrice().call();
  const finalA = finalSpot._reserveA;
  const finalB = finalSpot._reserveB;
  const totalLockedValue = await dex.methods.getTVL().call();

  console.log(`📊 Final Reserves:
${web3.utils.fromWei(finalA)} TokenA ${web3.utils.fromWei(finalB)} TokenB and TVL: ${web3.utils.fromWei(totalLockedValue)}`);
  console.log("✅ Full simulation complete.");

  // Save plot data to the Remix file system
  // Format data for easier plotting
  let formattedData = "time,tvl,reserveRatio,spotPrice,slippage\n";
  for (let i = 0; i < plotData.time.length; i++) {
    formattedData += `${plotData.time[i]},${plotData.tvl[i]},${plotData.reserveRatio[i]},${plotData.spotPrice[i]},${plotData.slippage[i] || ""}\n`;
  }

  // Save LP distribution data
  let lpDistributionData = "time";
  for (const lp of LPs) {
    lpDistributionData += `,${lp.slice(0, 6)}`;
  }
  lpDistributionData += "\n";
  for (let i = 0; i < plotData.time.length; i++) {
    lpDistributionData += `${plotData.time[i]}`;
    for (const lp of LPs) {
      lpDistributionData += `,${plotData.lpDistribution[lp][i] || ""}`;
    }
    lpDistributionData += "\n";
  }

  // Save swap volume and fees data
  let swapVolumeData = "time,swapVolumeA,swapVolumeB,fees\n";
  for (let i = 0; i < plotData.time.length; i++) {
    swapVolumeData += `${plotData.time[i]},${plotData.swapVolumeA[i] || 0},${plotData.swapVolumeB[i] || 0},${plotData.feeAccumulation[i] || 0}\n`;
  }

  // New: Generate slippage vs trade lot fraction data
  let slippageData = "tradeLotFraction,slippage,swapType\n";
  for (let i = 0; i < plotData.slippage.length; i++) {
    if (plotData.tradeLotFraction[i] !== undefined && plotData.slippage[i] !== undefined) {
      slippageData += `${plotData.tradeLotFraction[i]},${plotData.slippage[i]},${plotData.swapType[i]}\n`;
    }
  }

  // Swap volume and fee summary
  let swapSummary = `Total Swap Volume A: ${plotData.cumulativeSwapVolumeA}\n`;
  swapSummary += `Total Swap Volume B: ${plotData.cumulativeSwapVolumeB}\n`;
  swapSummary += `Total Fee Accumulation: ${plotData.cumulativeFees} (0.3% fee rate)\n`;

  // Create and save the CSV files
  try {
    await remix.call('fileManager', 'writeFile', 'contracts/dex_metrics.csv', formattedData);
    await remix.call('fileManager', 'writeFile', 'contracts/lp_distribution.csv', lpDistributionData);
    await remix.call('fileManager', 'writeFile', 'contracts/swap_volume_data.csv', swapVolumeData);
    await remix.call('fileManager', 'writeFile', 'contracts/slippage_vs_trade_size.csv', slippageData);
    await remix.call('fileManager', 'writeFile', 'contracts/swap_summary.txt', swapSummary);
    console.log("📊 Data saved to contracts/dex_metrics.csv, contracts/lp_distribution.csv, contracts/swap_volume_data.csv, contracts/slippage_vs_trade_size.csv, and contracts/swap_summary.txt");
  } catch (error) {
    console.error("Error saving data files:", error);
  }

  // Return the plot data object for further analysis if needed
  return plotData;
}

deployAndSimulateDEX();