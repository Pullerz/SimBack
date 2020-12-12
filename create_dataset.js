const DataSource = require('./datasource.js').DataSource;
const DataSourceTimeframe = require('./datasource.js').DataSourceTimeframe;
const DEBUG = require('./debug.js');
const Utils = require('./utils.js');
const {BacktesterDataType, BacktesterTradeDirection, TechnicalIndicator} = require('./enums.js');
const ChartSegment = require('./chart_segment.js');
const fs = require('fs');

// DEBUG.showWarnings = false;

let options = {
    //Relative path to the data file
    dataFile: "./data/forex/gbp_usd_2019_ohlc.csv",
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
    //Ignores the first line of the data file, often because that line is used for headers for columns and not data
    ignoreFirstLine: true,
    //The resolution of the inputted data file as a DataSourceTimeframe object (1 minute, 5 minute, 10 minute etc...)
    resolution: DataSourceTimeframe.M_1, 
    //Optional - a lower resolution that the incoming data will be downsampled to (e.g. from M_1 to M_5 will DS from 1m bars to 5m bars)
    // downsampleResolution: DataSourceTimeframe.M_5,

    //Optionally request for some technical indicators to be calculated
    indicators: [
        TechnicalIndicator.EMA_12,
        TechnicalIndicator.EMA_30
    ]
}

//My variables
let pFast, pSlow, pCross, pUid;
let bufLength = 26;
let buf = [];
let values = {};
let results = [];
const MarketDirection = {
    Uptrend: 1,
    Ranging: 0,
    Downtrend: -1
}
const minimumMovement = 0.15;

//Create data source pointing to passed in file
const source = new DataSource(options.dataFile);
//Start streaming the data from the file
source.start(function(data) {
    //Get current indicator values
    let fast = data.indicators[options.indicators[0].name];
    let slow = data.indicators[options.indicators[1].name];

    //Setup buffer
    buf.push(data);
    if (buf.length >= bufLength) {
        buf = buf.slice(buf.length-bufLength, buf.length)
    }

    //Check if the previous values are present
    if (pFast != null && pSlow != null && buf.length == bufLength) {
        //Crossing to uptrend
        if (pSlow > pFast && slow < fast) {
            if (pCross != null) {
                let uid = Utils.guid();
                let segment = new ChartSegment(buf, options.indicators[0].name, options.indicators[1].name);
                let shapeHash = segment.calculateShapeHash(3);
                let percentChange = Utils.percentageChange(data.close, pCross);
                DEBUG.warning(`Ending a downtrend, pCross was ${pCross}, price is now ${data.close} pd of ${percentChange}`);

                values[uid] = {
                    shapeHash: shapeHash,
                    crossDirection: MarketDirection.Uptrend
                } 

                if (pUid != null) {
                    if (pUid in values) {
                        let marketDirection;
                        if (percentChange >= minimumMovement) {
                            marketDirection = MarketDirection.Uptrend;
                        } else if (percentChange < minimumMovement && percentChange > (-1 * minimumMovement)) {
                            marketDirection = MarketDirection.Ranging;
                        } else if (percentChange <= (-1 * minimumMovement)) {
                            marketDirection = MarketDirection.Downtrend;
                        }

                        values[pUid]["change"] = percentChange;
                        values[pUid]["direction"] = marketDirection

                        results.push(JSON.parse(JSON.stringify(values[pUid])));

                        delete values[pUid];

                        DEBUG.warning("Finished downtrend");
                    }
                }

                pUid = uid;
            }
            
            DEBUG.warning(`Setting pCross to ${data.close}, starting an uptrend`);
            pCross = data.close;
        }
        //Crossing to downtrend
        if (pSlow < pFast && slow > fast) {
            if (pCross != null) {
                let uid = Utils.guid();
                let segment = new ChartSegment(buf, options.indicators[0].name, options.indicators[1].name);
                let shapeHash = segment.calculateShapeHash(3);
                let percentChange = Utils.percentageChange(data.close, pCross);
                DEBUG.warning(`Ending an uptrend, pCross was ${pCross}, price is now ${data.close} pd of ${percentChange}`);

                values[uid] = {
                    shapeHash: shapeHash,
                    crossDirection: MarketDirection.Downtrend
                } 

                if (pUid != null) {
                    if (pUid in values) {
                        let marketDirection;
                        if (percentChange >= minimumMovement) {
                            marketDirection = MarketDirection.Uptrend;
                        } else if (percentChange < minimumMovement && percentChange > (-1 * minimumMovement)) {
                            marketDirection = MarketDirection.Ranging;
                        } else if (percentChange <= (-1 * minimumMovement)) {
                            marketDirection = MarketDirection.Downtrend;
                        }

                        values[pUid]["change"] = percentChange;
                        values[pUid]["direction"] = marketDirection

                        results.push(JSON.parse(JSON.stringify(values[pUid])));

                        DEBUG.warning("Finished uptrend");

                        delete values[pUid];

                    }
                }

                pUid = uid;
            }
            
            DEBUG.warning(`Setting pCross to ${data.close}, starting a downtrend`);
            pCross = data.close;
        }
    }

    pFast = fast;
    pSlow = slow;
}, function() {
    //Write results to a file as JSON
    fs.writeFileSync("./results.json", JSON.stringify(results, null, 2), 'utf8');
    DEBUG.log(`Written results to file`);
}, options)