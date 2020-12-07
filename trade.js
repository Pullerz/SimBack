
const DataSourceTimeframe = require('./datasource.js').DataSourceTimeframe;
const {BacktesterDataType, BacktesterTradeDirection} = require('./enums.js');
const DEBUG = require('./debug.js');
const Utils = require('./utils.js');

class Trade {

    constructor(id, direction, amount, convertedAmount, openingPrice, iteration) {
        this.id = id;
        this.direction = direction;
        this.amount = amount;
        this.convertedAmount = convertedAmount;
        this.openingPrice = openingPrice;
        this.iteration = iteration;
    }

    /**
     * Gives a live result of the trade's value
     * @param {*} currentPrice the price object for the current period
     * @param {BacktesterDataType} dataType the datatype of the price object (OHLC or BA)
     */
    getResult(currentPrice, dataType, spreadAndFees) {
        if (this.direction === BacktesterTradeDirection.LONG) {
            //Get the correct price to use depending on the mode
            let usedPrice;
            if (dataType === BacktesterDataType.OHLC) {
                //If using OHLC data assume we close on the closing price of the bar
                usedPrice = currentPrice.close;
            } else if (dataType === BacktesterDataType.BA) {
                //If using Bid/Ask data close on the bidding price as usual
                usedPrice = currentPrice.bid;
            }

            let convertedBackAmount = (this.convertedAmount * usedPrice) * ((100 - spreadAndFees) / 100);
            
            return convertedBackAmount - this.amount;
        } else if (this.direction === BacktesterTradeDirection.SHORT) {
            //Get the correct price to use depending on the mode
            let usedPrice;
            if (dataType === BacktesterDataType.OHLC) {
                //If using OHLC data assume we close on the closing price of the bar
                usedPrice = currentPrice.close;
            } else if (dataType === BacktesterDataType.BA) { 
                //If using Bid/Ask data close on the asking price as usual
                usedPrice = currentPrice.ask;
            }

            //How much base currency do we need to buy back the convertedAmount of the quote currency?
            let convertedBackAmount = (this.convertedAmount * usedPrice) * ((100 - spreadAndFees) / 100);
            return this.amount - convertedBackAmount
        }
    }


}

module.exports = Trade;