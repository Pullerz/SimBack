class TradeOpenSignal {
    constructor(direction, amount) {
        this.direction = direction;
        this.amount = amount;
    }
}

class TradeCloseSignal {
    constructor(toClose=[]) {
        this.toClose = toClose;
    }
}

module.exports = {
    TradeOpenSignal: TradeOpenSignal,
    TradeCloseSignal: TradeCloseSignal
}