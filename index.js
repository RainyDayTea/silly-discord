// Load environment variables
require('dotenv').config();



// ================= [[ Imports ]] =================

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Client, Collection, 
    Events, GatewayIntentBits } = require('discord.js');
const config = JSON.parse(fs.readFileSync('./config.json'));

// TODO: Move hardcoded values to config file.
var LOG_FORMAT = config.logging.format;

var client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
var db = undefined;



// ================= [[ Initialization ]] =================

console.log('Starting bot...');

// Load commands
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
const initFunctions = [];
//
console.log('Loading commands...');
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
            if ('init' in command) {
                initFunctions.push(command.init);
            }
            console.log(`\tCommand "${command.data.name}" loaded.`);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}
// Promise chain of init functions
initFunctions.reduce((promise, func) => {
    promise.then(() => func())
    .catch(err => console.error(`Error encountered while initializing: ${err}`));
}, Promise.resolve());


// Initialize/load database
console.log('Starting database...');
db = new sqlite3.Database(config.sqlite3.db_path);

// Attempt login
console.log('Logging in to Discord...');
(async () => {
    try {
        await client.login(process.env.BOT_TOKEN);
        console.log(`Success! Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error('Failed to login. Error:\n' + error);
    }
})();



// =============== [[ Event Handlers ]] ===============

client.on(Events.MessageDelete, async (msg) => {

    // Reject bot messages
    if (msg.author.bot) {
        return;
    }
    let content = msg.content;
    let channel = msg.channel;
    let author = msg.author.tag;

    // Check against logging configuration (from config.json)
    if (msg.guild.id in config.logging.guilds) {
        let logChannelId = config.logging.guilds[msg.guild.id];
        let logChannel = await client.channels.fetch(logChannelId);
        let msgBuffer = LOG_FORMAT.replace('%s', author).replace('%s', channel.name).replace('%s', content);
        let msgBufferOriginal = msgBuffer;

        // Truncate message if it's too long
        if (msgBuffer.length > 2000) {
            msgBuffer = msgBuffer.slice(0, 1997) + '...';
        }
        
        // Catch anyways for safety
        logChannel.send({
            "allowedMentions": {},
            "content": msgBuffer,
            "embeds": msg.embeds,
            "files": msg.attachments.map(a => a.url)
        }).catch(console.error);
        
        console.log(msgBufferOriginal);
    }
});


client.on(Events.MessageCreate, async (msg) => { 
    if (msg.author.bot) {
        return;
    }
    console.log(`Message received in '${msg.guild.name}' #${msg.channel.name} from ${msg.author.tag}: ${msg.content}`);
});


// TODO: Add comments to explain the code below
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.user.bot) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`Command '${interaction.commandName}' was attempted by user '${interaction.user.tag}', but no such command exists.`);
		return;
	}
    console.log(`Command '${interaction.commandName}' was invoked by user '${interaction.user.tag}'`);

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});
