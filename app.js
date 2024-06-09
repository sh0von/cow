require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Load the token from the .env file
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Load or initialize user data
const dataFile = 'userData.json';
let userData = {};

if (fs.existsSync(dataFile)) {
    userData = JSON.parse(fs.readFileSync(dataFile));
} else {
    fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2));
}

// Save user data to JSON file
const saveUserData = () => {
    fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2));
};

// Command to start the bot
bot.onText(/\/start/, (msg) => {
    const userId = msg.from.id;
    if (!userData[userId]) {
        userData[userId] = { tuitions: [] };
        saveUserData();
    }
    bot.sendMessage(msg.chat.id, `Welcome to the Tuition Tracker Bot! Use the buttons below to interact with the bot.`);
    sendMainMenu(msg.chat.id, userId);
});

// Send main menu with tuition classes
const sendMainMenu = (chatId, userId) => {
    let menuText = 'Your Tuitions:';
    if (userData[userId].tuitions.length === 0) {
        menuText += '\n\nNo tuitions added yet. Use "Add Tuition" to start.';
    } else {
        userData[userId].tuitions.forEach(tuition => {
            menuText += `\n\n${tuition.name} - ${tuition.days} days attended.`;
        });
    }
    
    const tuitionButtons = userData[userId].tuitions.map(tuition => [
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
bot.on('message', (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userData[userId]) {
        userData[userId] = { tuitions: [] };
        saveUserData();
    }

    if (text === '➕ Add Tuition') {
        bot.sendMessage(chatId, 'Please enter the name of the tuition class to add:');
        bot.once('message', (response) => {
            if (response.from.id === userId) { // Ensure the response is from the same user
                const tuitionName = response.text.trim();
                if (tuitionName.length > 0) {
                    const tuitionId = Math.floor(Math.random() * 1000); // Generate a random ID
                    userData[userId].tuitions.push({ id: tuitionId, name: tuitionName, days: 0 });
                    saveUserData();
                    sendMainMenu(chatId, userId);
                } else {
                    bot.sendMessage(chatId, 'Tuition name cannot be empty. Please try again.');
                }
            }
        });
    } else if (text === '🏠 Main Menu') {
        sendMainMenu(chatId, userId);
    } else if (text.startsWith('❌ Delete')) {
        const tuitionName = text.replace('❌ Delete ', '');
        const tuitionIndex = userData[userId].tuitions.findIndex(t => t.name === tuitionName);
        if (tuitionIndex !== -1) {
            userData[userId].tuitions.splice(tuitionIndex, 1);
            saveUserData();
            bot.sendMessage(chatId, `Tuition '${tuitionName}' has been deleted.`);
            sendMainMenu(chatId, userId);
        } else {
            bot.sendMessage(chatId, `Tuition '${tuitionName}' not found.`);
        }
    }else if (text === 'ℹ️ About') {
        // Display developer information and total users
        const totalUsers = Object.keys(userData).length;
        const developerInfo = `
        Developer: Shovon
        GitHub Repository: https://github.com/sh0von/cow
        Total Users: ${totalUsers}
        `;
        bot.sendMessage(chatId, developerInfo);
    }
     else {
        const tuitionName = text.match(/^📅 (.*?) \(\d+ days\)$/);
        if (tuitionName) {
            const tuition = userData[userId].tuitions.find(t => t.name === tuitionName[1]);
            if (tuition) {
                tuition.days++;
                saveUserData();
                bot.sendMessage(chatId, `You have attended one more day of '${tuition.name}'. It is now ${tuition.days} days.`);
                sendMainMenu(chatId, userId);
            } else {
                bot.sendMessage(chatId, `Tuition '${tuitionName[1]}' not found.`);
            }
        }
    }
});

// Save user data periodically to avoid data loss
setInterval(saveUserData, 60000);
