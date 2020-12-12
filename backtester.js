const DataSource = require('./datasource.js').DataSource;
const DataSourceTimeframe = require('./datasource.js').DataSourceTimeframe;
const DEBUG = require('./debug.js');
const Utils = require('./utils.js');
const Trade = require('./trade.js');
const {BacktesterDataType, BacktesterTradeDirection} = require('./enums.js');


class Backtester {
    constructor(options) {
        this.balances = options.balances;
        this.tradeShouldOpen = null;
        this.tradeShouldClose = null;
        this.onCompletion = null;
        this.iteration = 0;
        this.options = options;
        this.openTrades = {};
        this.mostRecentlyOpenedTrade;
        this.lastData;
    }

    /**
     * Starts the backtesting process with inputted dataset, will stream
     * the inputted file and call the tradeShouldOpen() and tradeShouldClose()
     * methods on every price iteration 
     */
    start() {
        //Create local reference to this that can be captured inside scope of internal functions
        let self = this;

        //Create data source pointing to passed in file
        const source = new DataSource(this.options.sourceOptions.dataFile);
        
        //Start streaming the data from the file
        source.start(function(data) {
            let openSignal = self.tradeShouldOpen(data, self.openTrades, self);
            if (openSignal != null) {
                let trade = self.openTrade(openSignal.direction, data, openSignal.amount);
                if (trade != null) {
                    self.openTrades[trade.id] = trade;
                    self.mostRecentlyOpenedTrade = trade;
                }
            }
            let closeSignal = self.tradeShouldClose(data, self.openTrades, self);
            if (closeSignal != null) {
                for (let tradeId of closeSignal.toClose) {
                    self.closeTrade(tradeId, data);
                }
            }
            self.lastData = data;
            self.iteration += 1;
        }, function() {
            let allOpen = self.getOpenTrades();
            for (let openTrade of allOpen) {
                self.closeTrade(openTrade.id, self.lastData);
            }

            if (self.onCompletion) {
                self.onCompletion(self.balances);
            }
        }, this.options.sourceOptions);

    }

    /**
     * 
     * @param {BacktesterTradeDirection} direction The direction of the trade, either LONG or SHORT
     * @param {Object} price The current price object as provided by the data source
     * @param {Number} amount The amount of the base currency we want to convert into quote currency, (e.g. how much GBP do we want to spend/convert into USD)
     */
    openTrade(direction, price, amount) {
        //Extract the base and quote currencies from the pair specified in options
        let baseCurrency = this.options.instrument.split("/")[0];
        let quoteCurrency = this.options.instrument.split("/")[1];
        
        //In this instance we're buying quote currency with base currency (e.g. buying USD with GBP if pair is GBP/USD)
        if (direction === BacktesterTradeDirection.LONG) {
            let usedPrice;
            if (this.options.sourceOptions.dataType === BacktesterDataType.OHLC) {
                //If using OHLC data assume we buy on the closing price of the bar
                usedPrice = 1 / price.close;
            } else if (this.options.sourceOptions.dataType === BacktesterDataType.BA) {
                //If using Bid/Ask data buy on the asking price as usual
                usedPrice = 1 / price.ask;
            }

            let convertedAmount = (amount * usedPrice) * ((100 - this.options.spreadAndFees) / 100);

            //Ensure that there are enough funds in the balance to be able to open the trade
            if (this.balances[quoteCurrency] >= amount) {
                
                //Debit the balance of bace currency and credit the balance of quote currnecy
                this.balances[quoteCurrency] -= amount;
                this.balances[baseCurrency] += convertedAmount;

                let trade = new Trade(Utils.guid(), direction, amount, convertedAmount, usedPrice, price.count);

                DEBUG.log(trade);

                return trade;
            } else {
                DEBUG.warning(`Unable to purchase ${quoteCurrency} ${amount} becasue balance was only ${this.balances[quoteCurrency]}`);
                return null;
            }
        } else if (direction === BacktesterTradeDirection.SHORT) {
            let usedPrice;
            if (this.options.sourceOptions.dataType === BacktesterDataType.OHLC) {
                //If using OHLC data assume we buy on the closing price of the bar
                usedPrice = 1 / price.close;
            } else if (this.options.sourceOptions.dataType === BacktesterDataType.BA) {
                //If using Bid/Ask data sell on the bidding price as usual
                usedPrice = 1 / price.bid;
            }

            if (this.balances[quoteCurrency] >= amount) {
                //Amount of quote currency borrowed and sold - i.e. how many quote currency we need to buy back later
                let convertedAmount = (amount * usedPrice) * ((100 - this.options.spreadAndFees) / 100);

                //The result from the sale of the quote currency added to the base currency
                //when we buy back the quote currency later, we hope to use less base currency
                //thus keeping the difference and pocketing the profit
                this.balances[quoteCurrency] += amount;
            
                return new Trade(Utils.guid(), direction, amount, convertedAmount, usedPrice, price.count);
            } else {
                DEBUG.warning(`Unable to short ${quoteCurrency} ${amount} becasue balance was only ${this.balances[quoteCurrency]}`);
                return null;
            }
            
        }
    }

    closeTrade(tradeId, price) {
        //Extract the base and quote currencies from the pair specified in options
        let baseCurrency = this.options.instrument.split("/")[0];
        let quoteCurrency = this.options.instrument.split("/")[1];

        //Find the trade in the array of open trades
        let trade;
        if (tradeId in this.openTrades) {
            trade = this.openTrades[tradeId];
        }

        //If the trade has been found then close it
        if (trade != null) {
            if (trade.direction === BacktesterTradeDirection.LONG) {
                //Get the correct price to use depending on the mode
                let usedPrice;
                if (this.options.sourceOptions.dataType === BacktesterDataType.OHLC) {
                    //If using OHLC data assume we close on the closing price of the bar
                    usedPrice = price.close;
                } else if (this.options.sourceOptions.dataType === BacktesterDataType.BA) {
                    //If using Bid/Ask data close on the bidding price as usual
                    usedPrice = price.bid;
                }

                let convertedBackAmount = (trade.convertedAmount * usedPrice) * ((100 - this.options.spreadAndFees) / 100);

                this.balances[quoteCurrency] += convertedBackAmount;
                this.balances[baseCurrency] -= trade.convertedAmount;
                delete this.openTrades[tradeId];
                if (this.mostRecentlyOpenedTrade.id === tradeId) {
                    this.mostRecentlyOpenedTrade = null;
                }
                this.inspectBalances();
            } else if (trade.direction === BacktesterTradeDirection.SHORT) {
                //Get the correct price to use depending on the mode
                let usedPrice;
                if (this.options.sourceOptions.dataType === BacktesterDataType.OHLC) {
                    //If using OHLC data assume we close on the closing price of the bar
                    usedPrice = price.close;
                } else if (this.options.sourceOptions.dataType === BacktesterDataType.BA) {
                    //If using Bid/Ask data close on the asking price as usual
                    usedPrice = price.ask;
                }

                //How much base currency do we need to buy back the convertedAmount of the quote currency?
                let convertedBackAmount = (trade.convertedAmount * usedPrice) * ((100 - this.options.spreadAndFees) / 100);
                this.balances[quoteCurrency] -= convertedBackAmount;

                delete this.openTrades[tradeId];
                if (this.mostRecentlyOpenedTrade.id === tradeId) {
                    this.mostRecentlyOpenedTrade = null;
                }
                this.inspectBalances();
            }
        } else {
            DEBUG.error(`Unable to find an open trade with the id '${tradeId}'`);
        }
    }

    numberOfOpenTrades() {
        return Object.keys(this.openTrades).length;
    }

    getOpenTrades() {
        let trades = [];
        let tradeIds = Object.keys(this.openTrades);
        for (let tradeId of tradeIds) {
            let trade = this.openTrades[tradeId];
            trades.push(trade);
        }
        return trades;
    }

    inspectBalances() {
        DEBUG.log("Balances are now", this.balances);
    }
}


module.exports = Backtester;