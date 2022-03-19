require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const oxLensAbi = require("./abi/oxLens.json");
const readData = require("./utils/readData.js");
const sanitize = require("./utils/sanitize.js");

const secondsPerYear = 31622400;

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";

const oxdAddress = "0xc5A9848b9d145965d821AaeC8fA32aaEE026492d";
const oxLensAddress = "0xDA00137c79B30bfE06d04733349d98Cf06320e69";
const solidAddress = "0x888EF71766ca594DED1F0FA3AE64eD2941740A20";
const partnerRewardsPoolAddress = "0xDA006E87DB89e1C5213D4bfBa771e53c91D920aC";
const oxdV1RewardsPoolAddress = "0xDA000779663501df3C9Bc308E7cEc70cE6F04211";
const oxSolidRewardPoolAddress = "0xDA0067ec0925eBD6D583553139587522310Bec60";
const oxSolidAddress = "0xDA0053F0bEfCbcaC208A3f867BB243716734D809";
const vlOxdAddress = "0xDA00527EDAabCe6F97D89aDb10395f719E5559b9";

let web3;

const getPrice = (tokenAddress) => {
  if (tokenAddress === oxdAddress) {
    return protocol.oxdPrice;
  } else if (tokenAddress === solidAddress) {
    return protocol.solidPrice;
  } else if (tokenAddress === oxSolidAddress) {
    return protocol.oxSolidPrice;
  }
  return 0;
};

const getAprByStakingPools = async (stakingPools) => {
  protocol = readData("protocol");
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  const resp = await Promise.all(
    stakingPools.map(async (stakingPool) => {
      const rewardTokens = sanitize(
        await oxLens.methods.rewardTokensData(stakingPool).call().catch()
      );

      const pool = {
        rewardTokens,
        totalTvlUsd: 0,
      };
      if (stakingPool === oxSolidRewardPoolAddress) {
        pool.totalTvlUsd = protocol.oxSolidRewardsPoolTvl;
        pool.name = "oxSolidRewards";
      } else if (stakingPool === oxdV1RewardsPoolAddress) {
        pool.totalTvlUsd = protocol.oxdV1RewardsPoolTvl;
        pool.name = "oxdV1Rewards";
      } else if (stakingPool === partnerRewardsPoolAddress) {
        pool.totalTvlUsd = protocol.partnerRewardsPoolTvl;
        pool.name = "partnerRewards";
      } else if (stakingPool === vlOxdAddress) {
        pool.totalTvlUsd = protocol.vlOxdTvl;
        pool.name = "vlOxdRewards";
      }

      pool.stakingPoolAddress = stakingPool;

      const apr = getApr(pool);
      return apr;
    })
  );
  return resp;
};

const getApr = (pool) => {
  //   console.log(pool.poolData.symbol, `(${pool.id})`);
  let totalApr = new BigNumber(0);

  if (pool.totalTvlUsd === "0") {
    pool.totalApr = "N/A";
    pool.oxdApr = "N/A";
    pool.solidApr = "N/A";
    return pool;
  }
  pool.rewardTokens.forEach((token) => {
    let rewardRate = token.rewardRate;
    if (pool.stakingPoolAddress === vlOxdAddress) {
      rewardRate = token.periodFinish; // ABI is backwards
    }

    const tokenPrice = getPrice(token.id);
    const valuePerYear = new BigNumber(secondsPerYear)
      .times(rewardRate)
      .times(tokenPrice)
      .div(10 ** 18);

    const apr = new BigNumber(valuePerYear)
      .div(pool.totalTvlUsd)
      .times(100)
      .toFixed(4);
    if (token.id === solidAddress) {
      pool.aprSolid = apr;
    } else if (token.id === oxdAddress) {
      pool.aprOxd = apr;
    } else if (token.id === oxSolidAddress) {
      pool.aprOxSolid = apr;
    }

    if (pool.stakingPoolAddress === vlOxdAddress) {
      console.log("reward rate", rewardRate);
      console.log("token price", tokenPrice);
      console.log("value per year", valuePerYear.toFixed());
      console.log("tvl", pool.totalTvlUsd);
      console.log("apr", apr);
    }
    totalApr = totalApr.plus(apr);
  });
  totalApr = totalApr.toFixed(4);
  pool.totalApr = totalApr;
  if (
    pool.id === "0x12EE63e73d6BC0327439cdF700ab40849e8e4284" ||
    pool.id === "0xAf059909235c8F8168bE38cB86717134B9050384" ||
    pool.id === "0xA3668B13D1064E79B6fFA438f28a3665Bb41D8eF" ||
    pool.id === "0x8F42e0cd7176Ef472E402Bab0e4bca234a3693C3"
  ) {
    pool.aprSolid = "N/A";
    pool.aprOxd = "N/A";
    pool.totalApr = "N/A";
  }
  //   console.log("price0", prices[pool.poolData.token0Address.toLowerCase()]);
  //   console.log("price1", prices[pool.poolData.token1Address.toLowerCase()]);
  return pool;
};

const injectApr = async (pools) => {
  protocol = readData("protocol");
  prices = readData("prices");
  const newPools = pools.map((pool) => getApr(pool));
  return newPools;
};

const calculateApr = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  prices = readData("prices");
  protocol = readData("protocol");
  const pools = readData("pools");
  const poolsWithApr = await injectApr(pools, protocol);
  console.log(poolsWithApr);
  return poolsWithApr;
};

const getPartnerApr = async () => {
  const apr = await getAprByStakingPools([
    oxSolidRewardPoolAddress,
    partnerRewardsPoolAddress,
    vlOxdAddress,
  ]);
  console.log(apr);
  return apr;
};

// getPartnerApr();

module.exports = {
  injectApr,
  getPartnerApr,
};
