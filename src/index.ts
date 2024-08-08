require('dotenv').config({
    path: '../.env'
});

import { ChannelType, Client, Collection, Events, GatewayIntentBits, TextChannel} from 'discord.js';
import { Command } from './lib/Command';
import fs from 'fs';
import path from 'path';
import CommandLoader from './lib/CommandLoader';
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
const commandLoader = new CommandLoader(bot.client, path.join(__dirname, 'commands'));
(async () => {
    let commands = await commandLoader.initCommands();
    let token: string;
    if (process.env.NODE_ENV === 'development' && process.env.BOT_TOKEN_DEV) token = process.env.BOT_TOKEN_DEV;
    else if (process.env.NODE_ENV === 'production' && process.env.BOT_TOKEN) token = process.env.BOT_TOKEN;
    else if (process.env.BOT_TOKEN) token = process.env.BOT_TOKEN;
    else throw new Error('No token provided in environment variables.');
    for (let command of commands) {
        bot.commands.set(command.data.name, command);
    }
    console.log(`Loaded ${bot.commands.size} commands.`);
    try {
        console.log('Logging in to Discord...');
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
    console.log(`Command '${interaction.commandName}' was invoked by user '${interaction.user.tag}'.`);

	try {
		await command.exec(bot.client, interaction);
	} catch (error) {
		console.error(error);
	}
});
