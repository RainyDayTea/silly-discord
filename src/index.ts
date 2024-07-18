require('dotenv').config({
    path: '../.env'
});

import { ChannelType, Client, Collection, Events, GatewayIntentBits, TextChannel} from 'discord.js';
import { Command } from './lib/Command';
import * as fs from 'fs';
import * as path from 'path';
// import * as sql from 'sqlite3';

type Bot = {
    client: Client,
    commands: Collection<string, Command>,
    db: any
};

type Config = {
    logging: {
        guilds: {
            [key: string]: string
        },
        format: string,
        enabled: boolean
    },
    katexOptions: Object
};

const config: Config = JSON.parse(fs.readFileSync("../config.json", "utf-8"));
const bot: Bot = {
    client: new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    }), 
    commands: new Collection(), 
    db: null
};


// ================= [[ Initialization ]] =================

console.log('Starting bot...');

// Load commands
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
const initFunctions: Array<Function> = [];
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
			bot.commands.set(command.data.name, command);
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
console.log('Initializing commands...');
(async () => {
    for (const init of initFunctions) {
        await init(bot.client);
    }
    console.log('Commands initialized.');
})();

// Attempt login
console.log('Logging in to Discord...');
(async () => {
    try {
        await bot.client.login(process.env.BOT_TOKEN);
        console.log(`Success! Logged in as ${bot.client.user?.tag}`);
    } catch (error) {
        console.error('Failed to login. Error:\n' + error);
    }
})();



// =============== [[ Event Handlers ]] ===============

bot.client.on(Events.MessageDelete, async (msg) => {

    // Reject authorless or bot messages
    if (!msg.author || msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;
    if (!msg.guild) return;

    let content: string = msg.content? msg.content : 'No content';
    let channel: TextChannel = msg.channel;
    let author: string = msg.author.tag;
    let logFormat: string = config.logging.format;
    let logChannelId: string = config.logging.guilds[msg.guild.id];
    let logChannel = await bot.client.channels.fetch(logChannelId);

    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    let msgBuffer = logFormat.replace('%s', author).replace('%s', channel.name).replace('%s', content);
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
});


bot.client.on(Events.MessageCreate, async (msg) => { 
    if (msg.author.bot) return;
    if (msg.channel.type !== ChannelType.GuildText) return;
    if (!msg.guild) return;
    console.log(`Message received in '${msg.guild.name}' #${msg.channel.name} from ${msg.author.tag}: ${msg.content}`);
});


// TODO: Add comments to explain the code below
bot.client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
    if (interaction.user.bot) return;

	const command: Command | undefined = bot.commands.get(interaction.commandName);

	if (!command) {
		console.error(`Command '${interaction.commandName}' was attempted by user '${interaction.user.tag}', but no such command exists.`);
		return;
	}
    console.log(`Command '${interaction.commandName}' was invoked by user '${interaction.user.tag}'`);

	try {
		await command.exec(bot.client, interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});
