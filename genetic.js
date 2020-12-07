// Node.js program to demonstrate the  
// fs.createReadStream() method 
   
// Include fs module 
const DataSource = require('./datasource.js');
const Trade = require('./trade.js');
const DEBUG = require('./debug.js');
const Utils = require('./utils.js');
const Strategy = require('./strategy.js');
const fs = require('fs');

const Genetic = require('async-genetic').Genetic; 

const config = {
    mutationFunction: mutationFunction,
    crossoverFunction: crossoverFunction,
    fitnessFunction: fitnessFunction, // async
    populationSize: 300, 	// defaults to 100,
    randomFunction: randomFunction,
    mutateProbability: 0.2
}
const GENERATIONS = 50;

const population = [];
const RANDOM_MIN = 0.001;
const RANDOM_MAX = 0.15;
const STAKE_SIZE = 1000
const MULTIPLIER = 1;

for (let i = 0; i < config.populationSize; i++) {
    population.push(randomFunction());
}

let writeStream = fs.createWriteStream('./results.txt', {encoding: 'utf-8'});
var startingLoss = 0;
var losingResult = 0;
var totalPL = 0;
var iterations = 0;

const genetic = new Genetic(config, population);

async function solve() {
    genetic.seed();

    for (let i = 0; i <= GENERATIONS; i++) {
        console.count('Generation', i);
        await genetic.estimate();
        genetic.breed();
        let best = {
            fitness: await fitnessFunction(genetic.best(1)[0]),
            item: genetic.best(1)[0]
        }
        writeStream.write(JSON.stringify(best) + "\n");
    }
    let best = {
        fitness: await fitnessFunction(genetic.best(20)[0]),
        item: genetic.best(1)[0]
    }
    writeStream.write(JSON.stringify(best) + "\n");
}

// solve();

calculateFitness(new Strategy(0.07, 0.0125, 0.0125)).then(function(val) {
    console.log(val);
})

function randomFunction() {
    // create random strings that are equal in length to solution
    return new Strategy(Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX), Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX), Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX));
}

function calculateFitness(strategy) {
    return new Promise(function(resolve) {
        let funds = {
            "USD": 2100,
            "BTC": 0
        }
        let metrics = {
            profitableTrades: 0,
            lossTrades: 0,
            largestProfit: 0,
            largestLoss: 0
        }
        let longTrade = null;
        let shortTrade = null;
        const FEE = 0.0025;
        let currentBid, currentAsk;
    
        let randomSources = ['./data/binance_btc_usd_full.txt', './data/binance_eos_usd_full.txt', './data/binance_eth_usd_full.txt', './data/binance_ltc_usd_full.txt', './data/binance_xrp_usd_full.txt'] 
        const random = Math.floor(Math.random() * randomSources.length);

        const source = new DataSource('./data/binance_btc_usd_full.txt');
        source.start(function(data) {
            currentBid = data.bid;
            currentAsk = data.ask;
            if (data.count == 1) {
                openDualTrades(data, strategy);
            } else if (data.count > 1) {
                if (longTrade == null && shortTrade == null) {
                    if (funds.USD >= 400) {
                        losingResult = 0;
                        openDualTrades(data, strategy);
                    } else {
                        resolve({
                            funds: funds, 
                            metrics: metrics, 
                            strategy: strategy
                        });
                        return;
                    }
                }
        
                if (longTrade) {
                    let longLiveResult = longTrade.getResult(data.bid);
                    // DEBUG.log("Long result", longLiveResult, Math.abs(data.ask - data.bid), data.bid, data.ask, longTrade.value);
                    if (longTrade && shortTrade) {
                        if (longLiveResult <= -(longTrade.stake * strategy.stopLoss)) {
                            // DEBUG.log("Long hit stop loss", longLiveResult, data.bid);
                            losingResult = longLiveResult;
                            closeTrade(longTrade, data.bid);
                        } else if (longTrade.trailingStopLevel != null) {
                            if (longLiveResult <= longTrade.trailingStopLevel) {
                                // DEBUG.log("Long hit trailing stop");
                                losingResult = longLiveResult;
                                closeTrade(longTrade, data.bid);
                            }
                        }
                    } else if (longTrade) {
                        if (longTrade.getResult(data.bid) >= Math.abs(losingResult) * MULTIPLIER) {
                            // DEBUG.log("Long hit close at profit", longLiveResult + losingResult, data.bid);
                            closeTrade(longTrade, data.bid);
                        }
                    }
                }

                if (shortTrade) {
                    let shortLiveResult = shortTrade.getResult(data.ask);
                    // DEBUG.log("Short result", shortLiveResult, Math.abs(data.ask - data.bid), data.bid, data.ask, shortTrade.value);
                    if (longTrade && shortTrade) {
                        if (shortLiveResult <= -(shortTrade.stake * strategy.stopLoss)) {
                            // DEBUG.log("Short hit stop loss", shortLiveResult, data.bid);
                            losingResult = shortLiveResult;
                            closeTrade(shortTrade, data.ask);
                        } else if (shortTrade.trailingStopLevel != null) {
                            if (shortLiveResult <= shortTrade.trailingStopLevel) {
                                // DEBUG.log("Short hit trailing stop", shortLiveResult);
                                losingResult = shortLiveResult;
                                closeTrade(shortTrade, data.ask);
                            }
                        }
                    } else if (shortTrade) {
                        if (shortTrade.getResult(data.ask) >= Math.abs(losingResult) * MULTIPLIER) {
                            // DEBUG.log("Short hit close at profit", shortLiveResult + losingResult, data.bid);
                            closeTrade(shortTrade, data.ask);
                        }
                    }
                    
                }
        
            }
            iterations += 1;
        }, function() {
            if (shortTrade) {
                DEBUG.log("Closing short trade");
                closeTrade(shortTrade, currentAsk);
            }
            if (longTrade) {
                DEBUG.log("Closing long trade")
                closeTrade(longTrade, currentBid);
            }
            resolve({
                funds: funds, 
                metrics: metrics, 
                strategy: strategy
            });
        })
        
        function openDualTrades(data, strategy) {
            let tradeID = Utils.guid();
            let half = funds.USD / 2.2;
            longTrade = placeTrade(tradeID, 'BTC/USD', 'long', half, Number(data.ask), strategy);
            shortTrade = placeTrade(tradeID, 'BTC/USD', 'short', half, Number(data.bid), strategy);
            startingLoss = longTrade.getResult(Number(data.bid)) + shortTrade.getResult(Number(data.ask));
        }
        
        function placeTrade(id, pair, side, stake, price, strategy) {
            if (side == 'long') {         
                let boughtCurrency = ((1 / price) * stake) * (1 - FEE);
                let currencyA = pair.split('/')[0];
                let currencyB = pair.split('/')[1];
        
                funds[currencyA] += boughtCurrency;
                funds[currencyB] -= stake;
                let trade = new Trade(id, pair, stake, boughtCurrency, side, strategy, price);
                trade.openIteration = iterations;
                return trade;
            } else if (side == 'short') {
                //The amount of currency 'borrowed' using the USD
                let shortedCurrency = ((1 / price) * stake) * (1 - FEE);
                let currencyB = pair.split('/')[1];
        
                // funds[currencyA] += boughtCurrency;
                funds[currencyB] -= stake;
                let trade = new Trade(id, pair, stake, shortedCurrency, side, strategy, price);
                trade.openIteration = iterations;
                return trade;
            }
        }
        
        function closeTrade(trade, price) {
            if (trade.direction == 'long') {
                let closedAmount = (price * trade.value) * (1 - FEE);
                let currencyA = trade.pair.split('/')[0];
                let currencyB = trade.pair.split('/')[1];
        
                funds[currencyA] -= trade.value;
                funds[currencyB] += closedAmount;
                longTrade = null;
                
                let pl = closedAmount - trade.stake;
                if (pl > 0) {
                    metrics.profitableTrades += 1
                } else {
                    metrics.lossTrades += 1;
                }
                if (pl > metrics.largestProfit) {
                    metrics.largestProfit = pl;
                }
                if (pl < metrics.largestLoss) {
                    metrics.largestLoss = pl;
                }
                totalPL += pl;
                DEBUG.log(`Closed a long trade for $${pl} ${closedAmount} ${trade.value} ${trade.openPrice} ${price} ${totalPL} ${iterations - trade.openIteration}`);
            } else if (trade.direction == 'short') {
                let costToBuyBack = ((price) * trade.value) * (1 - FEE);
                let currencyB = trade.pair.split('/')[1];
        
                let netResult = trade.stake - costToBuyBack;
                
                funds[currencyB] += trade.stake + netResult;
                shortTrade = null;
        
                let pl = netResult;
                if (pl > 0) {
                    metrics.profitableTrades += 1
                } else {
                    metrics.lossTrades += 1;
                }
                if (pl > metrics.largestProfit) {
                    metrics.largestProfit = pl;
                }
                if (pl < metrics.largestLoss) {
                    metrics.largestLoss = pl;
                }
                totalPL += pl
                DEBUG.log(`Closed a short trade for $${pl} ${trade.stake + netResult} ${trade.value} ${trade.openPrice} ${price} ${totalPL} ${iterations - trade.openIteration}`);
            }
        }
    })
}

async function fitnessFunction(entity) {
    let fitness = await calculateFitness(entity);
    return fitness.funds.USD;
}

async function doesABeatB(phenotypeA, phenotypeB) {
    return fitnessFunction(phenotypeA) >= fitnessFunction(phenotypeB)
}

function crossoverFunction(phenotypeA, phenotypeB) {
    if (Utils.getRandomInRange(0, 1) > 0.5) {
        phenotypeA.takeProfit = phenotypeB.takeProfit;
    } else {
        phenotypeB.takeProfit = phenotypeA.takeProfit;
    }

    if (Utils.getRandomInRange(0, 1) > 0.5) {
        phenotypeA.stopLoss = phenotypeB.stopLoss;
    } else {
        phenotypeB.stopLoss = phenotypeA.stopLoss;
    }

    if (Utils.getRandomInRange(0, 1) > 0.5) {
        phenotypeA.trailingStop = phenotypeB.trailingStop;
    } else {
        phenotypeB.trailingStop = phenotypeA.trailingStop;
    }
    return [phenotypeA, phenotypeB];
}

function mutationFunction(entity) {
    let newStrategy = new Strategy(null, null, null);
    if (Utils.getRandomInRange(0, 1) > 0.5) {
        newStrategy.takeProfit = Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX);
    } else {
        newStrategy.takeProfit = entity.takeProfit;
    }

    if (Utils.getRandomInRange(0, 1) > 0.5) {
        newStrategy.stopLoss = Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX);
    } else {
        newStrategy.stopLoss = entity.stopLoss;
    }

    if (Utils.getRandomInRange(0, 1) > 0.5) {
        newStrategy.trailingStop = Utils.getRandomInRange(RANDOM_MIN, RANDOM_MAX);
    } else {
        newStrategy.trailingStop = entity.trailingStop;
    }
    return newStrategy;
}

