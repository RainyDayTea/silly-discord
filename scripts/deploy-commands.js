/**
 * Run this script to register slash (/) commands
 * with Discord. Once registered, they will show
 * up on a server's context menu.
 */
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes, Client, GatewayIntentBits } = require('discord.js');
const clientId = process.env.CLIENT_ID;
const token = process.env.BOT_TOKEN;
var guildId = '-1';
var remove = false;

const HELP_MESSAGE = `Usage: npm run deploy-commands -- [--remove] --guildid <guild_id> | --all \n
--all                : Deploy commands to all known guilds.
--guildid <guild_id> : Deploy to the guild with <guild_id>.
--remove             : Remove all commands from the target guild(s) instead of deploying them.
`;

// Parse arguments
if (process.argv.includes('-h') || process.argv.includes('--help')) {
	console.log(HELP_MESSAGE);
	process.exit(0);
}
if (process.argv.includes('--all')) {
	guildId = 'all';
	console.log('Deploying commands to all known guilds...');
} else if (process.argv.includes('--guildid')) {
	guildId = process.argv[process.argv.indexOf('--guildid') + 1];
}
if (process.argv.includes('--remove')) {
	remove = true;
}


// Collect command data as JSON objects
const commands = [];
const foldersPath = path.resolve(__dirname, '../commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct REST module and prepare the PUT request.
const rest = new REST().setToken(token);

(async () => {
	try {
		let client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages
			]
		});
		await client.login(token);
		if (remove) console.log('Executing in remove mode.');
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		if (guildId === 'all') {
			const guilds = await client.guilds.fetch();
			for (const guild of guilds.values()) {
				const data = await rest.put(
					Routes.applicationGuildCommands(clientId, guild.id),
					{ body: remove? {} : commands },
				);
				console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guild.id}.`);
			}
			process.exit(0);
		} else {
			// If a specific guild is targeted, only update the commands in that guild
			const data = await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: remove? {} : commands },
			);
			console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
			process.exit(0);
		}
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
