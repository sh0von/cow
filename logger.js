const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Define custom log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

// Create the logger
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            )
        }),
        new transports.File({ filename: 'app.log' })
    ]
});

module.exports = logger;
