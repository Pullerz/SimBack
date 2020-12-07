const { throws } = require('assert');
const fs = require('fs');
const {BacktesterDataType, BacktesterTradeDirection} = require('./enums.js');
const DEBUG = require('./debug.js');


class DataSource {
    constructor(sourcefile, strategy) {
        this.sourcefile = sourcefile;
    }

    start(onNewData, end, options, downsampleTimeframe=null) {
        this.count = 0;
        this.reader = fs.createReadStream(this.sourcefile);
        let self = this;

        let ratio = 1;

        if ('downsampleResolution' in options) {
            if (options.downsampleResolution > options.resolution) {
                ratio = options.downsampleResolution / options.resolution
            } else {
                DEBUG.error(`Fatal error: Please enter a downsample resolution longer than the actual resolution of the data`);
            }
            
        }

        //Downsampled variables
        let dsO = Infinity;
        let dsH = -Infinity;
        let dsL = Infinity;
        let dsC = Infinity;

        this.reader.on('data', function (chunk) {
            self.reader.pause();
            let split = chunk.toString().split(options.newLineDelimeter || "\n");
            let startingIndex = (options.ignoreFirstLine == true) ? 1 : 0;

            for (let i = startingIndex; i < split.length; i++) {
                if (options.dataType === BacktesterDataType.BA) {
                    let data = split[i].split(options.delimeter);
                    if (options.expectedLineLength === 13) {
                        let bid = Number(data[options.indexes.bid]);
                        let ask = Number(data[options.indexes.ask]);
        
                        if (!isNaN(bid) && !isNaN(ask) && self.count % ratio == 0) {
                            onNewData({
                                bid: bid,
                                ask: ask,
                                count: self.count
                            });   
                            self.count += 1;    
                        }
                    }     
                } else if (options.dataType === BacktesterDataType.OHLC) {
                    if (!split[i].includes(options.delimeter)) {
                        DEBUG.warning(`Line ${i} of file doesn't include the delimeter '${options.delimeter}'`);
                    }

                    let data = split[i].split(options.delimeter);
                    let o = Number(data[options.indexes.open]);
                    let h = Number(data[options.indexes.high]);
                    let l = Number(data[options.indexes.low]);
                    let c = Number(data[options.indexes.close]);

                    if ('downsampleResolution' in options) {
                        if (self.count % ratio == 0) {
                            dsO = o;
                        } else {
                            if (h > dsH) {
                                dsH = h;
                            }
                            if (l < dsL) {
                                dsL = l;
                            }
                            if (self.count % ratio == ratio - 1) {
                                dsC = c;
                            }
                        }

                        if (dsO != Infinity && dsH != -Infinity && dsL != Infinity && dsC != Infinity) {
                            if (!isNaN(dsO) && !isNaN(dsH) && !isNaN(dsL) && !isNaN(dsC) && self.count % ratio == ratio - 1) {
                                onNewData({
                                    open: dsO,
                                    high: dsH,
                                    low: dsL,
                                    close: dsC,
                                    count: (self.count + 1) / ratio
                                });    
                            }

                            dsO = Infinity;
                            dsH = -Infinity;
                            dsL = Infinity;
                            dsC = Infinity;

                        }

                        self.count += 1;   

                    } else {
                        if (!isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c) && self.count % ratio == 0) {
                            onNewData({
                                open: o,
                                high: h,
                                low: l,
                                close: c,
                                count: self.count
                            });   
                            self.count += 1;    
                        }
                    }

                    
                }
                            
            };
            self.reader.resume();
        });
        this.reader.on('end', function() {
            end();
        })
    }

}

const DataSourceTimeframe = {
    M_1: 1,
    M_5: 5,
    M_10: 10,
    M_30: 30,
    H_1: 60,
    H_2: 120,
    H_5: 300,
    H_12: 720,
    H_24: 1440
}

module.exports = {
    DataSource: DataSource,
    DataSourceTimeframe: DataSourceTimeframe
}