import fs from 'fs';
import { Command } from './Command';
import { Client } from 'discord.js';

export default class CommandLoader {
    private commands: Command[] | null = null;
    private client: Client
    private folderPath: string;

    constructor(client: Client, folderPath: string) {
        this.client = client;
        this.folderPath = folderPath;
        this.commands = null;
    }

    public getCommandsSync(): Command[] {
        const commandFiles: string[] = fs.readdirSync(this.folderPath).filter(file => file.endsWith('.js'));

        if (this.commands !== null) return this.commands;

        this.commands = [];
        for (const file of commandFiles) {
            let command: Command = require(`${this.folderPath}/${file}`).default;
            this.commands.push(command);
        }
        return this.commands;
    }

    public async initCommands(): Promise<Command[]> {
        if (this.commands === null) {
            this.commands = this.getCommandsSync();
        }
        for (const command of this.commands) {
            if (command.init) {
                await command.init(this.client);
                console.log(`Command "${command.data.name}" initialized.`);
            }
        }
        return this.commands;
    }
}