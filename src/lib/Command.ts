import { SlashCommandBuilder, Client, ChatInputCommandInteraction } from "discord.js";

class Command {
    
    public name: string;
    public data: SlashCommandBuilder;
    public init: (client: Client) => Promise<void>;
    public exec: (client: Client, interaction: ChatInputCommandInteraction) => Promise<void>;
    

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

export { Command };