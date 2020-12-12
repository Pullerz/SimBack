const DEBUG = require('./debug.js');
const Utils = require('./utils.js');

class ChartSegment {

    constructor(buffer, fastName, slowName) {
        this.buffer = buffer;
        this.fast = this.buffer.map(function(el) {
            return el.indicators[fastName];
        });
        this.slow = this.buffer.map(function(el) {
            return el.indicators[slowName];
        });
        this.shapeHash = null;
    }

    /**
     * Calculates the shapehash of a given segment of chart
     * @param {*} numberOfDivisions specifies the number of divisions/strips we want for the hash, number of segments equates to half the hash length
     * @throws Throws an error if there is an issue with the inputted buffer
     */
    calculateShapeHash(numberOfDivisions) {
        //Perform checks before calculating shape hash
        if (this.shapeHash != null) {
            return this.shapeHash;
        }
        if (!(this.buffer.length % (numberOfDivisions - 1) == 0)) {
            throw new Error(`The buffer length of ${this.buffer.length} is not divisible by the numberOfDivisions (${numberOfDivisions}).`)
        }
        if (this.fast.length != this.slow.length) {
            throw new Error(`The fast and slow arrays are of different lengths: ${this.fast.length} and ${this.slow.length}.`);
        }

        let lowestPoint = Infinity;
        for (let i = 0; i < this.fast.length; i ++) {
            let currentFast = this.fast[i];
            let currentSlow = this.slow[i];

            // DEBUG.log("EMAS", currentFast, currentSlow);

            if (currentFast < lowestPoint) {
                lowestPoint = currentFast;
            }
            if (currentSlow < lowestPoint) {
                lowestPoint = currentSlow;
            }
        }


        let hash = "";
        let divisionSpacing = this.buffer.length / (numberOfDivisions - 1);
        for (let i = 0; i <= this.buffer.length; i += divisionSpacing) {
            if (i == this.buffer.length) {
                i -= 1;
            }
            let fast = this.fast[i];
            let slow = this.slow[i];

            let slowPd = Utils.percentageChange(slow, lowestPoint);
            let fastPd = Utils.percentageChange(fast, lowestPoint);

            let slowChar = this.getLetterFromPercentage(slowPd);
            let fastChar = this.getLetterFromPercentage(fastPd);

            hash += `${slowChar}${fastChar}`;
        }
        return hash;
    }

    getLetterFromPercentage(percentage) {
        let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        let trimmed = Number(percentage.toFixed(2));
        let total = 0;
        
        for (let i = 0; i < letters.length; i++) {
            let currentLetter = letters[i];
            total += 0.01;
            total = Number(total.toFixed(2))
            if (i == 0 && trimmed < total) {
                return 'A';
            } else if (i == letters.length - 1 && trimmed > total) {
                return 'Z';
            }
            if (trimmed == total) {
                return currentLetter;
            }
        }
    }

}



module.exports = ChartSegment;