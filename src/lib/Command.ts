import { SlashCommandBuilder, Client, ChatInputCommandInteraction } from "discord.js";

class Command {
    
    public name: string;
    public data: SlashCommandBuilder;
    public init: (client: Client, args?: any) => Promise<void>;
    public exec: (client: Client, interaction: ChatInputCommandInteraction, args?: any) => Promise<void>;
    

    constructor(
        name: string, 
        data: SlashCommandBuilder, 
        init: (client: Client) => Promise<void>,
        exec: (client: Client, interaction: ChatInputCommandInteraction) => Promise<void>
    ) {
        this.name = name;
        this.data = data;
        this.init = init;
        this.exec = exec;
    }

}

class CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommandError';
    }
}

export { Command, CommandError };