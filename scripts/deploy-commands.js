/**
 * Run this script to register slash (/) commands
 * with Discord. Once registered, they will show
 * up on a server's context menu.
 */
require('dotenv').config();

const { REST, Routes, Client } = require('discord.js');
const { clientId, guildId, token } = {
	clientId: process.env.CLIENT_ID,
	guildId: process.env.GUILD_ID,
	token: process.env.BOT_TOKEN,
};
const fs = require('node:fs');
const path = require('node:path');


// Parse arguments


// Collect command data
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
		let client = new Client();
		await client.login(token);
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();
