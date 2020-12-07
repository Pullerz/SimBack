/**
 * Summary: An object containing various helper functions with uses across
 *          the system
 */
module.exports = {
    /**
     * Summary: generates a random ID string
     */
    guid: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    /**
     * Summary: formats a timestamp in human readable form
     */
    getFormattedTimestamp: function() {
        function formatInteger(int, millis=false) {
            if (millis) {
                if (int < 10) {
                        return '00' + int;
                    } else if (int < 100) {
                        return '0' + int;
                    } else {
                        return int;
                    }
            } else {
                if (int < 10) {
                    return '0' + int;
                } else {
                    return int;
                }
            }
        }
        let date = new Date();
        return `${formatInteger(date.getDate())}/${formatInteger(date.getMonth() + 1)}/${date.getFullYear()} @ ${formatInteger(date.getUTCHours())}:${formatInteger(date.getUTCMinutes())}:${formatInteger(date.getUTCSeconds())}:${formatInteger(date.getUTCMilliseconds(), true)} UTC`;
    },
    /**
     * Summary: calculates the percentage change between two numbers (numbers range between 0 and 100)
     * @param {*} y2 new number
     * @param {*} y1 old number
     */
    percentageChange: function(y2, y1) {
        return ((y2 - y1) / y1) * 100;
    },
    /**
     * Summary: will send an email from the email address
     * @param {*} subject subject text
     * @param {*} text body text
     */
    sendEmail: function(subject, text) {
        const nodemailer = require('nodemailer');
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'herri98@gmail.com',
              pass: 'dnoihujuxembppod'
            }
        });
    
        var mailOptions = {
            from: 'herri98@gmail.com',
            to: 'alistairpullen@icloud.com',
            subject: subject,
            text: text
        };
    
        transporter.sendMail(mailOptions, function(error, info){
            
        });
    },
    /**
     * Summary: generates random number in specified range
     * @param {*} min min range
     * @param {*} max max range
     * @returns random number
     */
    getRandomInRange(min, max) {
        return Math.random() * (max - min) + min;
    },
    /**
     * Summary: checks all elements in an array are the same
     * @param {*} arr array to be checked
     * @returns true or false depending if all elements are the same or not
     */
    allEqual(arr) {
        return arr.every(function(v) {
            return v === arr[0]
        })
    },
    /**
     * Summary: checks for array equivalency both in content and order
     * @param {*} arr1 First array for comparison
     * @param {*} arr2 Second array for comparison
     * @returns if array are equal or not
     */
    arraysMatch(arr1, arr2) {
        // Check if the arrays are the same length
        if (arr1.length !== arr2.length) return false;
    
        // Check if all items exist and are in the same order
        for (var i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
    
        // Otherwise, return true
        return true;
    },
    /**
     * Summary: easy way to duplicate an object by stringifying it and then parsing it
     * @param {*} value object to be cloned
     */
    copyValue(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch(e) {
            throw new Error(e.message + "\n" + value);
        }
    },
    /**
     * Summary: performs a deep recursive copy on an object by creating a new object
     *          and copying all attributes over
     * @param {*} src object to be copied
     * @returns copied object
     */
    cloneObject(src) {
        let target = {};
        for (let prop in src) {
          if (src.hasOwnProperty(prop)) {
            // if the value is a nested object, recursively copy all it's properties
            if (this.isObject(src[prop])) {
              target[prop] = this.cloneObject(src[prop]);
            } else {
              target[prop] = src[prop];
            }
          }
        }
        return target;
      },
      /**
       * Summary: checks if incoming param is of type object
       * @param {*} obj input to be type checked
       * @returns true or false depending if input is an object
       */
      isObject(obj) {
        var type = typeof obj;
        return type === 'function' || type === 'object' && !!obj;
      },
      /**
       * Summary: calculates the standard deviation of an array of numbers
       * @param {*} values numbers for which std. dev. should be calculated
       * @returns standard deviation of the numbers
       */
      standardDeviation(values){
        function average(data){
            var sum = data.reduce(function(sum, value){
                return sum + value;
            }, 0);
    
            var avg = sum / data.length;
            return avg;
        }
        
        var avg = average(values);
        
        var squareDiffs = values.map(function(value){
            var diff = value - avg;
            var sqrDiff = diff * diff;
            return sqrDiff;
        });
        
        var avgSquareDiff = average(squareDiffs);
    
        var stdDev = Math.sqrt(avgSquareDiff);
        return stdDev;
    },
    /**
     * Summary: gets the number of seconds elapsed of the current minute
     * @returns number of seconds elapsed this minute
     */
    secondsThisMinute() {
        return Math.round((Date.now() / 1000) % 60)
    },
    /**
     * Summary: checks if incoming json can be parsed or not
     * @param {*} json The json to be checked
     * @param {*} source the name of the calling function to make debugging easier
     * @returns true or false if JSON can be parsed or not
     */
    isValidJson(json, source="") {
        try {
            JSON.parse(JSON.stringify(json));
            return true;
        } catch (e) {
            console.log('JSON parse error', e, source)
            return false;
        }
    },
    /**
     * Summmary: calculates the mean average of an array of numbers
     * @param {*} data array of numbers whose mean should be calculated
     * @returns the mean average of the numbers
     */
    meanAverage(data){
        var sum = data.reduce(function(sum, value){
            return sum + value;
        }, 0);

        var avg = sum / data.length;
        return avg;
    },
    /**
     * Summary: will execute a function at a specified time
     * @param {*} time Time in format hh:mm
     * @param {*} triggerThis Function to be called
     */
    scheduleExecution(time, triggerThis) {
        // get hour and minute from hour:minute param received, ex.: '16:00'
        const hour = Number(time.split(':')[0]);
        const minute = Number(time.split(':')[1]);
    
        // create a Date object at the desired timepoint
        const startTime = new Date(); startTime.setHours(hour, minute);
        const now = new Date();
    
        // increase timepoint by 24 hours if in the past
        if (startTime.getTime() < now.getTime()) {
          startTime.setHours(startTime.getHours() + 24);
        }
    
        // get the interval in ms from now to the timepoint when to trigger the alarm
        const firstTriggerAfterMs = startTime.getTime() - now.getTime();
    
        // trigger the function triggerThis() at the timepoint
        // create setInterval when the timepoint is reached to trigger it every day at this timepoint
        setTimeout(function(){
          triggerThis();
          setInterval(triggerThis, 24 * 60 * 60 * 1000);
        }, firstTriggerAfterMs);
      },
            range(start, end, step) {
            var ans = [];
            for (let i = start; i <= end; i += step) {
                ans.push(i);
            }
            return ans;
        },
        getColumn(nestedArray, column) {
            let col = [];
            for (let i = 0; i < nestedArray.length; i++) {
                col.push(nestedArray[i][column])
            }
            return col
        },
        getDimensionality(arr) {
            return [ arr.length, arr[0].length ];
        }
    
}