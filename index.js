// Load environment variables
require('dotenv').config();



// ================= [[ Imports ]] =================

const fs = require('fs');
const path = require('path');
const { Client, Collection, 
    Events, GatewayIntentBits } = require('discord.js');

// TODO: Move hardcoded values to config file.
const GUILD_ID = '1087532733288415343';
const LOG_CHANNEL_ID = '1203852989614260274';
const LOG_FORMAT = 'Message deleted from `%s` in #`%s`: %s';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// ================= [[ Initialization ]] =================

console.log('Starting bot...');

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

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
            console.log(`\tCommand "${command.data.name}" registered.`);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}


console.log('Logging in to Discord...');

// Code below should finish before the bot logs in
setTimeout(() => {
    client.login(process.env.BOT_TOKEN);
}, 1000);

// =============== [[ Event Handlers ]] ===============

// .once for one-time events
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Success! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageDelete, async (msg) => {

    // Reject bot messages
    if (msg.author.bot) {
        return;
    }
    let content = msg.content;
    let channel = msg.channel;
    let author = msg.author.tag;
    if (msg.guild.id === GUILD_ID) {
        let logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        let msgBuffer = LOG_FORMAT.replace('%s', author).replace('%s', channel.name).replace('%s', content);
        let msgBufferOriginal = msgBuffer;

        // Truncate message if it's too long
        if (msgBuffer.length > 2000) {
            msgBuffer = msgBuffer.slice(0, 1997) + '...';
        }
        
        // Catch anyways for safety
        logChannel.send(msgBuffer)
            .catch(console.error);
        
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

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

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
