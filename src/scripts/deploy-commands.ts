/**
 * Run this script to register slash (/) commands
 * with Discord. Once registered, they will show
 * up on a server's context menu.
 */
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { REST, Routes, Client, GatewayIntentBits } from 'discord.js';
import { Command } from '../lib/Command.js';

const clientId = process.env.CLIENT_ID;
const token = process.env.BOT_TOKEN;
assert.ok(clientId && token);
let guildId = '-1';
let remove = false;

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
if (guildId === '-1') {
	console.log(HELP_MESSAGE);
	process.exit(0);
}


// Collect command data as JSON objects
const commands = [];
const foldersPath = path.resolve(__dirname, '../commands');
const commandFiles = fs.readdirSync(foldersPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const filePath = path.join(foldersPath, file);
	let command = require(filePath);
	// Check if imported file exports a Command instance by default
	if ('default' in command && command.default instanceof Command) {
		command = command.default;
		commands.push(command.data.toJSON());
	} else {
		console.log(`[WARNING] The command at ${filePath} does not export a Command. Skipping...`);
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
				assert.ok(data);
				console.log(`Successfully reloaded ${commands.length} application (/) commands for guild ${guild.name} (${guild.id}).`);
			}
			process.exit(0);
		} else {
			// If a specific guild is targeted, only update the commands in that guild
			const data = await rest.put(
				Routes.applicationGuildCommands(clientId, guildId),
				{ body: remove? {} : commands },
			);
			assert.ok(data);
			console.log(`Successfully reloaded ${commands.length} application (/) commands for guild ${guildId}.`);
			process.exit(0);
		}
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
		process.exit(-1);
	}
})();
