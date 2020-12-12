const BacktesterDataType = {
    OHLC: "OHLC",
    BA: "BA"
}

const BacktesterTradeDirection = {
    LONG: "LONG",
    SHORT: "SHORT"
}


const TechnicalIndicatorType = {
    MovingAverage: "MovingAverage"
}

const TechnicalIndicator = {
    EMA_5: {
        name: "EMA_5",
        periods: 5,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_10: {
        name: "EMA_10",
        periods: 10,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_12: {
        name: "EMA_12",
        periods: 12,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_25: {
        name: "EMA_25",
        periods: 25,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_30: {
        name: "EMA_30",
        periods: 30,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_50: {
        name: "EMA_50",
        periods: 50,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_100: {
        name: "EMA_100",
        periods: 100,
        type: TechnicalIndicatorType.MovingAverage
    },
    EMA_200: {
        name: "EMA_200",
        periods: 200,
        type: TechnicalIndicatorType.MovingAverage
    }
}


module.exports = {
    BacktesterDataType: BacktesterDataType,
    BacktesterTradeDirection: BacktesterTradeDirection,
    TechnicalIndicator: TechnicalIndicator,
    TechnicalIndicatorType: TechnicalIndicatorType
}