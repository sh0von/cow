require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');
const logger = require('./logger'); // Import the logger

// Load the token from the .env file
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// MongoDB URI and client setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    ssl: true,
    tlsAllowInvalidCertificates: true,  // For testing, not recommended for production
});

// Connect to MongoDB
client.connect().then(() => {
    logger.info('Connected to MongoDB');
}).catch(err => {
    logger.error('Error connecting to MongoDB', err);
});

// Function to get user data from MongoDB
const getUserData = async (userId) => {
    const collection = client.db().collection('users');
    let user = await collection.findOne({ userId: userId });
    if (!user) {
        user = { userId: userId, tuitions: [] };
        await collection.insertOne(user);
    }
    return user;
};

// Function to save user data to MongoDB
const saveUserData = async (userId, userData) => {
    const collection = client.db().collection('users');
    await collection.updateOne({ userId: userId }, { $set: userData }, { upsert: true });
};

// Command to start the bot
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const user = await getUserData(userId);
    bot.sendMessage(msg.chat.id, `Welcome to the Tuition Tracker Bot! Use the buttons below to interact with the bot.`);
    sendMainMenu(msg.chat.id, user);
    logger.info(`User ${userId} started the bot`);
});

// Send main menu with tuition classes
const sendMainMenu = (chatId, user) => {
    let menuText = 'Your Tuitions:';
    if (user.tuitions.length === 0) {
        menuText += '\n\nNo tuitions added yet. Use "Add Tuition" to start.';
    } else {
        user.tuitions.forEach(tuition => {
            menuText += `\n\n${tuition.name} - ${tuition.days} days attended.`;
        });
    }
    
    const tuitionButtons = user.tuitions.map(tuition => [
        { text: `📅 ${tuition.name} (${tuition.days} days)` },
        { text: `❌ Delete ${tuition.name}` }
    ]);
    const buttons = [
        ...tuitionButtons,
        [{ text: '➕ Add Tuition' }],
        [{ text: '🏠 Main Menu' }],
        [{ text: 'ℹ️ About' }]
    ];
    bot.sendMessage(chatId, menuText, {
        reply_markup: {
            keyboard: buttons,
            one_time_keyboard: false,
            resize_keyboard: true
        }
    });
};

// Handle messages from the custom keyboard
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text;

    let user = await getUserData(userId);

    if (text === '➕ Add Tuition') {
        bot.sendMessage(chatId, 'Please enter the name of the tuition class to add:');
        bot.once('message', async (response) => {
            if (response.from.id === userId) { // Ensure the response is from the same user
                const tuitionName = response.text.trim();
                if (tuitionName.length > 0) {
                    const tuitionId = Math.floor(Math.random() * 1000); // Generate a random ID
                    user.tuitions.push({ id: tuitionId, name: tuitionName, days: 0 });
                    await saveUserData(userId, user);
                    sendMainMenu(chatId, user);
                    logger.info(`User ${userId} added a new tuition: ${tuitionName}`);
                } else {
                    bot.sendMessage(chatId, 'Tuition name cannot be empty. Please try again.');
                    logger.warn(`User ${userId} attempted to add an empty tuition name`);
                }
            }
        });
    } else if (text === '🏠 Main Menu') {
        sendMainMenu(chatId, user);
        logger.info(`User ${userId} requested the main menu`);
    } else if (text.startsWith('❌ Delete')) {
        const tuitionName = text.replace('❌ Delete ', '');
        const tuitionIndex = user.tuitions.findIndex(t => t.name === tuitionName);
        if (tuitionIndex !== -1) {
            user.tuitions.splice(tuitionIndex, 1);
            await saveUserData(userId, user);
            bot.sendMessage(chatId, `Tuition '${tuitionName}' has been deleted.`);
            sendMainMenu(chatId, user);
            logger.info(`User ${userId} deleted the tuition: ${tuitionName}`);
        } else {
            bot.sendMessage(chatId, `Tuition '${tuitionName}' not found.`);
            logger.warn(`User ${userId} attempted to delete a non-existing tuition: ${tuitionName}`);
        }
    } else if (text === 'ℹ️ About') {
        // Display developer information and total users
        const totalUsers = await client.db().collection('users').countDocuments();
        const developerInfo = `
        Developer: Shovon
        GitHub Repository: https://github.com/sh0von/cow
        Total Users: ${totalUsers}
        `;
        bot.sendMessage(chatId, developerInfo);
        logger.info(`User ${userId} requested about information`);
    } else {
        const tuitionName = text.match(/^📅 (.*?) \(\d+ days\)$/);
        if (tuitionName) {
            const tuition = user.tuitions.find(t => t.name === tuitionName[1]);
            if (tuition) {
                tuition.days++;
                await saveUserData(userId, user);
                bot.sendMessage(chatId, `You have attended one more day of '${tuition.name}'. It is now ${tuition.days} days.`);
                sendMainMenu(chatId, user);
                logger.info(`User ${userId} marked one more day attended for tuition: ${tuition.name}`);
            } else {
                bot.sendMessage(chatId, `Tuition '${tuitionName[1]}' not found.`);
                logger.warn(`User ${userId} attempted to mark attendance for a non-existing tuition: ${tuitionName[1]}`);
            }
        }
    }
});
