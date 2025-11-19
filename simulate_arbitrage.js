async function simulateArbitrageSetup() {
  console.log("Simulation has started");
  const accounts = await web3.eth.getAccounts();
  const deployer = accounts[0];
  const arbitrageur = accounts[11];
  const allUsers = accounts.slice(1, 12);
  let TokenA, TokenB, tokenA, tokenB;;

  try {
    TokenA = await loadContract("TokenA");
    console.log("TokenA JSON loaded");
  } catch (err) {
    console.error("Failed to load TokenA contract:", err);
  }

  try {
    TokenB = await loadContract("TokenB");
    console.log("TokenB JSON loaded");
  } catch (err) {
    console.error("Failed to load TokenB contract:", err);
  }

  try {
    tokenA = await TokenA.deploy({ data: TokenA.bytecode }).send({ from: deployer, gas: 3_000_000 });
    console.log("TokenA deployed");
  } 
  catch (err) {
    console.error("TokenA deployment failed:", err);
  }

  try {
    tokenB = await TokenB.deploy({ data: TokenB.bytecode }).send({ from: deployer, gas: 3_000_000 });
    console.log("TokenB deployed");
  } 
  catch (err) {
    console.error("TokenB deployment failed:", err);
  }

  let LPToken, lp1, lp2;

  try {
    LPToken = await loadContract("LPToken");
    console.log("LPToken JSON loaded");
  } catch (err) {
    console.error("Failed to load LPToken contract:", err);
  }

  try {
    lp1 = await LPToken.deploy({ data: LPToken.bytecode, arguments: [deployer] }).send({ from: deployer });
    console.log("LPToken for DEX1 deployed");
  } catch (err) {
    console.error("LPToken deployment for DEX1 failed:", err);
  }

  try {
    lp2 = await LPToken.deploy({ data: LPToken.bytecode, arguments: [deployer] }).send({ from: deployer });
    console.log("LPToken for DEX2 deployed");
  } catch (err) {
    console.error("LPToken deployment for DEX2 failed:", err);
  }


  let DEX, dex1, dex2;

  try {
    DEX = await loadContract("DEX");
    console.log("DEX JSON loaded");
  } catch (err) {
    console.error("Failed to load DEX contract:", err);
  }

  try {
    dex1 = await DEX.deploy({
      data: DEX.bytecode,
      arguments: [tokenA.options.address, tokenB.options.address, lp1.options.address]
    }).send({ from: deployer, gas: 5_000_000 });
    console.log("DEX1 deployed");
  } catch (err) {
    console.error("DEX1 deployment failed:", err);
  }

  try {
    dex2 = await DEX.deploy({
      data: DEX.bytecode,
      arguments: [tokenA.options.address, tokenB.options.address, lp2.options.address]
    }).send({ from: deployer, gas: 5_000_000 });
    console.log("DEX2 deployed");
  } catch (err) {
    console.error("DEX2 deployment failed:", err);
  }

  

  try {
    await lp1.methods.transferOwnership(dex1.options.address).send({ from: deployer });
    console.log("Control transfer of LPTokens of DEX1 to DEX1 successful");
  } catch (err) {
    console.error("Failed to transfer ownership of LPToken for DEX1:", err);
  }

  try {
    await lp2.methods.transferOwnership(dex2.options.address).send({ from: deployer });
    console.log("Control transfer of LPTokens of DEX2 to DEX2 successful");
  } catch (err) {
    console.error("Failed to transfer ownership of LPToken for DEX2:", err);
  }



  console.log("everything has been deployed");
  const amt = web3.utils.toWei("1000");
  for (const user of allUsers) {
    await tokenA.methods.transfer(user, amt).send({ from: deployer });
    await tokenB.methods.transfer(user, amt).send({ from: deployer });
  }
  const seed = web3.utils.toWei("1000");
  const seed1 = web3.utils.toWei("1000");
  const lpDEX1 = [accounts[1], accounts[2]];
  const lpDEX2 = [accounts[3], accounts[4]];

  for (const lp of lpDEX1) {
    await tokenA.methods.approve(dex1.options.address, seed).send({ from: lp });
    await tokenB.methods.approve(dex1.options.address, seed).send({ from: lp });
    await dex1.methods.addLiquidity(seed, seed).send({ from: lp });
  }
  // console.log("wiubf");
  for (const lp of lpDEX2) {
    await tokenA.methods.approve(dex2.options.address, seed).send({ from: lp });
    await tokenB.methods.approve(dex2.options.address, seed1).send({ from: lp });
    await dex2.methods.addLiquidity(seed, seed1).send({ from: lp });
  }
  console.log("DEX have been seeded");
  const tradersDEX1 = [accounts[5], accounts[6], accounts[7]];
  const tradersDEX2 = [accounts[8], accounts[9], accounts[10]];

  // Run 10 trades on each DEX
  const randomSwap = async (dex, tokenIn, tokenOut, trader) => {
    const amount = web3.utils.toWei("20");
    await tokenIn.methods.approve(dex.options.address, amount).send({ from: trader });
    if (tokenIn === tokenA) {
      await dex.methods.swapAforB(amount).send({ from: trader });
    } else {
      await dex.methods.swapBforA(amount).send({ from: trader });
    }
  };

  for (let i = 0; i < 10; i++) {
    const t1 = tradersDEX1[Math.floor(Math.random() * tradersDEX1.length)];
    const t2 = tradersDEX2[Math.floor(Math.random() * tradersDEX2.length)];
    const direction1 = Math.random() < 0.5;
    const direction2 = Math.random() < 0.5;

    await randomSwap(dex1, direction1 ? tokenA : tokenB, direction1 ? tokenB : tokenA, t1);
    await randomSwap(dex2, direction2 ? tokenA : tokenB, direction2 ? tokenB : tokenA, t2);
  }

  console.log("Trades complete. Checking arbitrage...");
  const Arb = await loadContract("Arbitrage");
  const arb = await Arb.deploy({
    data: Arb.bytecode,
    arguments: [dex1.options.address, dex2.options.address, tokenA.options.address, tokenB.options.address]
  }).send({ from: arbitrageur });
  // console.log("abf");
  const resdex1 = await dex1.methods.spotPrice().call();
  const resdex2 = await dex2.methods.spotPrice().call();
  const ra1 = resdex1[0], rb1 = resdex1[1];
  const ra2 = resdex2[0], rb2 = resdex2[1];
  const balA_initial = await tokenA.methods.balanceOf(arbitrageur).call();
  const balB_initial = await tokenB.methods.balanceOf(arbitrageur).call();
  console.log(`ra1:${web3.utils.fromWei(ra1)} rb1:${web3.utils.fromWei(rb1)} ra2:${web3.utils.fromWei(ra2)} rb2:${web3.utils.fromWei(rb2)}`);
  const ratio1 = parseFloat(web3.utils.fromWei(ra1)) / parseFloat(web3.utils.fromWei(rb1));
  const ratio2 = parseFloat(web3.utils.fromWei(ra2)) / parseFloat(web3.utils.fromWei(rb2));
  console.log(`reserve_ratio for DEX1 (A/B): ${ratio1}`);
  console.log(`reserve_ratio for DEX1 (A/B): ${ratio2}`);
  await tokenA.methods.transfer(arb.options.address, balA_initial).send({ from: arbitrageur });
  await tokenB.methods.transfer(arb.options.address, balB_initial).send({ from: arbitrageur });
 
  const x = await arb.methods.executeArbitrage(web3.utils.toWei("10"),web3.utils.toWei("0.1")).send({ from: arbitrageur });
  const balA = await tokenA.methods.balanceOf(arbitrageur).call();
  const balB = await tokenB.methods.balanceOf(arbitrageur).call();
  const delta_A = await web3.utils.fromWei(balA)-web3.utils.fromWei(balA_initial);
  const delta_B = await web3.utils.fromWei(balB)-web3.utils.fromWei(balB_initial);
  console.log(`delta_A=${delta_A} and delta_B=${delta_B}`);
  if(delta_A + delta_B == 0){
      console.log("Arbitrage not found");
  }
  else{
    if(delta_A>0){
      if(x){
        console.log(`Arbitrage Found 10 tokenA of A->B->A gives finally:${10+delta_A} TokenA  DEX1,DEX2`);
      }
      else{
      console.log(`Arbitrage Found 10 tokenA of A->B->A gives finally:${10+delta_A} TokenA  DEX2,DEX1`);

      }
    }
    else{
      if(x){
        console.log(`Arbitrage Found 10 tokenB of B->A->B gives finally:${10+delta_B} TokenB DEX1,DEX2`);
      }
      else{
        console.log(`Arbitrage Found 10 tokenB of B->A->B gives finally:${10+delta_B} TokenB DEX2,DEX1`);

      }
  }
  }
  console.log(`Change in Arbitrageur balanc: ${delta_A} A, ${delta_B} B`);

}

async function loadContract(name) {
  const compiled = JSON.parse(await remix.call('fileManager', 'getFile', `browser/contracts/artifacts/${name}.json`));
  const contract = new web3.eth.Contract(compiled.abi);
  contract.bytecode = compiled.data.bytecode.object;
  contract.options.jsonInterface = compiled.abi;
  return contract;
}

simulateArbitrageSetup();
