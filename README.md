
## Simple Backtester
The basic idea of this project was to build a general-purpose strategy backtester which would work on near-enough all types of data with little to no modification. All complex operations should be done behind the scenes making the focus of the system the strategy and not what's executing it.

To that end to run a backtest simply specify some required options, enter some trading logic for both trade entry and trade exit and the system does the rest for you.

**Capabilities**

 - Support for different data styles, both OHLC bars and continuous Bid/Ask data are supported and handled automatically.
 - Long and Short trades are supported, though both aren't required to be executed, you can just run long trades or just short trades if you like, it's all written in the trading logic.
 - Automatic timeframe downsampling is supported if using OHLC data: you can downsample a higher frequency timeframe to a lower frequency timeframe very easily simply by specifying the desired timeframe in the options object.
 - Trading leverage supported: leveraged positions can be easily run and specified in the options object, the default is to have no leverage.
 - Spread and fees taken into account: a constant can specify the extent of bid/ask spread and any broker fees to make the system more realistic.
 - Easily modifyable: you can effectively include any trading logic in this system, all it needs to do is return a trading signal if it want's to open or close a trade on any given time period
 - Streams data from file as it goes along, meaning that all of the file's data isn't loaded into memory at once, meaning that very large files of millions of lines of data can be processed without running out of RAM or slowing down the system.

## Usage & Examples
Simply download the entire Github repo including Node modules and run `node example.js` - feel free to play around and modify this file to your needs - it provides a good base point to start from.

You'll see that the first and most important thing written in the file is the options object - this specifies how the backtester should run and read data:

	//Setup the backtester options before it runs

	const  backtesterOptions  = {

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
				open: 1,
				high: 2,
				low: 3,
				close: 4
			},

			//The resolution of the inputted data file as a DataSourceTimeframe object (1 minute, 5 minute, 10 minute etc...)
			resolution: DataSourceTimeframe.M_1,

			//Optional - a lower resolution that the incoming data will be downsampled to (e.g. from M_1 to M_5 will DS from 1m bars to 5m bars)
			// downsampleResolution: DataSourceTimeframe.M_5

		},

		//Amount of leverage, defaults to 1 (no leverage)
		leverage: 1,

		spreadAndFees: 0.2//% (0.1 for spread, 0.1 for fees)
	}

As can be seen in here the data file for the backtest is specified along with how it should be parsed, other options such as leverage, spread, fees and optional downsampling are also present.

Once set up the only other things to implement are the `tradeShouldOpen()` and `tradeShouldClose()` functions, these two functions are called with every iteration of a new price, they recieve the price, list of any open trades and a reference to the backtester object itself as parameters.

The main idea is that you put your trading code inside of these two functions and that's all that is required to test a strategy, a crude example could be:

	
	//Some custom variables for the stragegy, you can make your own :)
	var recentHigh = -Infinity;
	var recentLow  = Infinity;
	var setAtIteration = 0;
	var lastClose = null;

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
	            return new TradeOpenSignal(BacktesterTradeDirection.LONG, 100);
	        } else if (priceData.close < averagePrice && lastClose > averagePrice && backtesterReference.numberOfOpenTrades() == 0) {
	            //If the price has crossed below the average line in the past two periods then open a short trade
	            return new TradeOpenSignal(BacktesterTradeDirection.SHORT, 100);
	        }

	        //If a trade is open, then print its current performance to the console
	        if (backtesterReference.mostRecentlyOpenedTrade) {
	            DEBUG.log("Live result for ", backtesterReference.mostRecentlyOpenedTrade.getResult(priceData,                backtesterReference.options.sourceOptions.dataType, backtesterReference.options.spreadAndFees));
	        }
	    }
	    
	    //Set the last close price to the current close price
	    lastClose = priceData.close;

	    //If no trades have been opened then default to return null
	    return null;
	}
	

The same principle applies for the `tradeShouldClose()` function:

	//Required - Called once per iteration over all price data, you put your custom trading logic in here
	backtester.tradeShouldClose = function(priceData, currentlyOpenTrades, backtesterReference) {
	    //Get all open trades, and other required metadata from the backtester object
	    let allOpenTrades = backtesterReference.getOpenTrades();
	    let currentDataType = backtesterReference.options.sourceOptions.dataType;
	    let spreadAndFees = backtesterReference.options.spreadAndFees;
	    //Loop over all trades, if any of them are losing more than 700 then close that trade
	    let tradesToClose = [];
	    for (let openTrade of allOpenTrades) {
	        if (openTrade.getResult(priceData, currentDataType, spreadAndFees) <= -700) {
	            tradesToClose.push(openTrade.id);
	        }
	    }
	    if (tradesToClose.length > 0) {
	        return new TradeCloseSignal(tradesToClose);
	    }

	    //Defaults to 
	    return null;
	}

Things like stop losses etc. can be implemented manually in the `tradeShouldClose()` function for the moment.

When complete the `onCompletion()` method is called which gives you the state of the balances for the system at the end of the data as well as other useful metrics of the strategy's performance such as totalWinningTrades, totalLosingTrades, tradeRatio, maximumDrawdown, averageTradeLength etc.

**Future To-Do's**

 - Built in technical indicator calculation such as moving averages, oscillators etc.
 - Built in stop losses, take profits and trailing stops that can be specified in the trade signal object on creation rather than doing that manually in the `tradeShouldClose` method.
 - Potential graphical output of strategy's performance for equity curve over time etc.
