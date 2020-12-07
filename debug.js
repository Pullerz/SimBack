const Utils = require('./utils.js');
/**
 * Summary: effectively a wrapper for 'console' but allows us to customise the stdout output of the system.
 *          One of the most useful features is that of each log output having the filename creating the output,
 *          which is a simple feature but not available in the normal console.log feature. There is also the potential
 *          for all logs to be routed elsewhere, for example to the API which would not be possible in the normal
 *          console.log function.
 */
module.exports = {
    showErrors: true,
    showWarnings: true,
    showLogs: true,
    savesHistoricData: true,
    showTimestamp: true,
    processes: [],
    error: function() {
        if (this.showErrors) {
            let filename = this.getCallerFile().split("/");
            filename = filename[filename.length - 1];
            let message;

            if (this.showTimestamp) {
                message = [`[ERROR - ${filename} - ${Utils.getFormattedTimestamp()}]: `].concat(Object.values(arguments));
            } else {
                message = [`[ERROR - ${filename}]: `].concat(Object.values(arguments));
            }

            console.log.apply(null, message);
            /*process.send({
                message: Constants.Enums.INTER_PROCESS_MESSAGES.NEW_LOG,
                data: message.join(" ")
            })*/
        }
    },
    warning: function() {
        if (this.showWarnings) {
            let filename = this.getCallerFile().split("/");
            filename = filename[filename.length - 1];

            let message;

            if (this.showTimestamp) {
                message = [`[WARNING - ${filename} - ${Utils.getFormattedTimestamp()}]: `].concat(Object.values(arguments));
            } else {
                message = [`[WARNING - ${filename}]: `].concat(Object.values(arguments));
            }

            console.log.apply(null, message);
        }
    },
    log: function() {
        if (this.showLogs) {
            let filename = this.getCallerFile().split("/");
            filename = filename[filename.length - 1];
            
            let message;

            if (this.showTimestamp) {
                message = [`[LOG - ${filename} - ${Utils.getFormattedTimestamp()}]: `].concat(Object.values(arguments));
            } else {
                message = [`[LOG - ${filename}]: `].concat(Object.values(arguments));
            }

            console.log.apply(null, message);
            /*process.send({
                message: Constants.Enums.INTER_PROCESS_MESSAGES.NEW_LOG,
                data: message.join(" ")
            })*/
        }
    },
    getCallerFile: function(){
        var originalFunc = Error.prepareStackTrace;
    
        var callerfile;
        try {
            var err = new Error();
            var currentfile;
    
            Error.prepareStackTrace = function (err, stack) { return stack; };
    
            currentfile = err.stack.shift().getFileName();
    
            while (err.stack.length) {
                callerfile = err.stack.shift().getFileName();
    
                if(currentfile !== callerfile) break;
            }
        } catch (e) {}
    
        Error.prepareStackTrace = originalFunc; 
    
        return callerfile;
    }
}