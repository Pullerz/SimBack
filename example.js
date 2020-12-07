//Boring import statements here
const {BacktesterDataType, BacktesterTradeDirection} = require('./enums.js');
const Backtester = require('./backtester.js');
const DataSourceTimeframe = require('./datasource.js').DataSourceTimeframe;
const {TradeOpenSignal, TradeCloseSignal} = require('./signal.js');
const DEBUG = require('./debug.js');
const Utils = require('./utils.js');
const Trade = require('./trade.js');

// DEBUG.showWarnings = false;

//Setup the backtester options before it runs
const backtesterOptions = {
    //Instrument name you're trading, needs to be quoted in 'NAME/CURRENCY' form, i.e. if
    //it's Tesla stock being traded in dollars you'd do 'TSLA/USD', if it's the pound against
    //the dollar, you'd do the ISO currency code, i.e. 'GBP/USD'
    instrument: "TSLA/USD",
    //The starting balances for the system to run, these obviously must match the instruments in the data
    //the keys should match the base and quote currency codes above (i.e. TSLA and USD or GBP and USD for example)
    balances: {
        TSLA: 0,
        USD: 1000
    },
    //The options relevant to the loading and parsing of the datafile
    sourceOptions: {
        //Relative path to the data file
        dataFile: "./data/stocks/TSLA.csv",
        //The type of the data either OHLC, or Bid/Ask (BA)
        dataType: BacktesterDataType.OHLC, 
        // The delimeter the data will be split on line by line 
        // (e.g. given an example line of data: 20190101 171100,1.272270,1.272270,1.272270,1.272270,0)
        // we split on the comma
        delimeter: ",",
        //The expected number of columns in a data line (used to ignore empty lines)
        expectedLineLength: 8,
        //The index in the split data line of each part of data
        indexes: { 
            open:  1,
            high:  2,
            low:   3,
            close: 4
        },
        //The resolution of the inputted data file as a DataSourceTimeframe object (1 minute, 5 minute, 10 minute etc...)
        resolution: DataSourceTimeframe.M_1, 
        //Optional - a lower resolution that the incoming data will be downsampled to (e.g. from M_1 to M_5 will DS from 1m bars to 5m bars)
        // downsampleResolution: DataSourceTimeframe.M_5
    },
    leverage: 1,
    spreadAndFees: 0.2//% (0.1 for spread, 0.1 for fees)
}

//Create an instance of a backtester object
let backtester = new Backtester(backtesterOptions);

//Some custom variables for the stragegy, you can make your own :)
var recentHigh = -Infinity;
var recentLow  = Infinity;
var setAtIteration = 0;
var lastClose = null;

//Setup all required functions before starting
/**
 * A function called every price period in which the trading logic for opening trades should be written
 * @param {*} priceData The latest price data for this period
 * @param {[Trade]} currentlyOpenTrades A list of all of the currently open trades
 * @param {*} backtesterReference A reference to the backtester object where all properties can be accessed
 * @returns {TradeSignal?} Returns a TradeSignal object indicating whether a trade should be opened or not, if no trade, return null
 */
//Required - Called once per iteration over all price data, you put your custom trading logic in here
backtester.tradeShouldOpen = function(priceData, currentlyOpenTrades, backtesterReference) {
    //Keep track of the most recent highs and lows
    if (priceData.high > recentHigh) {
        recentHigh = priceData.high;
    }
    if (priceData.low < recentLow) {
        recentLow = priceData.low;
    }
    //If the current recent high and recent low are older than 40 periods reset them
    if (backtesterReference.iteration - setAtIteration > 40) {
        recentHigh = -Infinity;
        recentLow = Infinity;
        setAtIteration = backtesterReference.iteration;
    }

    //If there is a recent high and low then calculate the average price between them
    if (recentHigh != -Infinity && recentLow != Infinity && recentHigh != recentLow && lastClose != null) {
        var averagePrice = ((recentHigh + recentLow) / 2);
        
        if (priceData.close > averagePrice && lastClose < averagePrice && backtesterReference.numberOfOpenTrades() == 0) {
            //If the price has crossed above the average line in the past two periods then open a long trade
            DEBUG.log(`Opened a long trade at ${priceData.close}`);
            return new TradeOpenSignal(BacktesterTradeDirection.LONG, 100);
        } else if (priceData.close < averagePrice && lastClose > averagePrice && backtesterReference.numberOfOpenTrades() == 0) {
            //If the price has crossed below the average line in the past two periods then open a short trade
            DEBUG.log(`Opened a short trade at ${priceData.close}`);
            return new TradeOpenSignal(BacktesterTradeDirection.SHORT, 100);
        }

        //If a trade is open, then print its current performance to the console
        if (backtesterReference.mostRecentlyOpenedTrade) {
            let currentDataType = backtesterReference.options.sourceOptions.dataType;
            let spreadAndFees = backtesterReference.options.spreadAndFees;
            // DEBUG.log("Live result for ", backtesterReference.mostRecentlyOpenedTrade.getResult(priceData, currentDataType, spreadAndFees));
        }
    }
    
    //Set the last close price to the current close price
    lastClose = priceData.close;

    //If no trades have been opened then default to return null
    return null;
}

/**
 * A function called every price period in which the trading logic for closing trades should be written
 * @param {*} priceData The latest price data for this period
 * @param {[Trade]} currentlyOpenTrades A list of all of the currently open trades
 * @param {*} backtesterReference A reference to the backtester object where all properties can be accessed
 * @returns {TradeSignal?} Returns a TradeSignal indicating whether a trade should be opened or not, if no trade, return null
 */
backtester.tradeShouldClose = function(priceData, currentlyOpenTrades, backtesterReference) {
    //Get all open trades, and other required metadata from the backtester object
    let allOpenTrades = backtesterReference.getOpenTrades();
    let currentDataType = backtesterReference.options.sourceOptions.dataType;
    let spreadAndFees = backtesterReference.options.spreadAndFees;
    //Loop over all trades, if any of them are losing more than 700 then close that trade
    let tradesToClose = [];
    for (let openTrade of allOpenTrades) {
        let tradeResult = openTrade.getResult(priceData, currentDataType, spreadAndFees);

        if (tradeResult >= 200) {
            DEBUG.log(`Closing trade with profit of ${openTrade.getResult(priceData, currentDataType, spreadAndFees)}`);
            tradesToClose.push(openTrade.id);
        } else if (tradeResult <= -100) {
            DEBUG.log(`Closing trade with loss of ${openTrade.getResult(priceData, currentDataType, spreadAndFees)}`);
            tradesToClose.push(openTrade.id);
        }
    }
    if (tradesToClose.length > 0) {
        return new TradeCloseSignal(tradesToClose);
    }

    //Defaults to 
    return null;
}

/**
 * A function which is called when all of the data has been iterated over showing the balances after trading
 * @param {*} balances An object containing the balances for each currency at the end of trading
 */
backtester.onCompletion = function(balances) {
    DEBUG.log("Final results", balances);
}

//Start the backtester running
backtester.start();