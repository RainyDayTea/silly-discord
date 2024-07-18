import { Command } from "../../lib/Command.js";
import fs from "fs";
import katex from "katex";
import { Mutex } from "async-mutex";
import { SlashCommandBuilder } from "discord.js";
import * as Puppeteer from "puppeteer";

const data = new SlashCommandBuilder()
data.setName('latex');
data.setDescription('Render a LaTeX expression as an image');
data.addStringOption(option =>
    option.setName('tex')
        .setDescription('The expression in math mode')
        .setRequired(true)
);

const pageMutex = new Mutex();
let browser: Puppeteer.Browser | null = null;
let page: Puppeteer.Page | null = null;
let template: string | null = null;
let katexOptions: Object | null = null;

module.exports = new Command("latex", data,

    async (client) => {
        browser = await Puppeteer.launch();
        page = await browser.newPage();
        let config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        katexOptions = config.katexOptions;
        template = fs.readFileSync("./templates/latex.html", "utf-8");
    },
    
    async (client, interaction) => {
        try { 
            if (!browser || !page || !template) {
                await interaction.reply({
                    content: "The LaTeX renderer is not ready yet. Please try again later.",
                    ephemeral: true
                });
                return;
            }
            // Defer the interaction as early as possible so the renderer can take its time
            await interaction.deferReply();
    
            const tex: string | null = interaction.options.getString("tex");

            if (!tex) {
                await interaction.reply({
                    content: "The LaTeX expression is missing.",
                    ephemeral: true
                });
                return;
            }
            const html = template!.replace("{{tex}}", katex.renderToString(tex));
            const buffer = await pageMutex.runExclusive(async () => {
                await page!.setContent(html);
                const element = await page!.waitForSelector("img");
                return await element!.screenshot();
            });
            await interaction.reply({ files: [ { attachment: buffer, name: "latex.png" } ] });
        } catch (err) {
            await interaction.editReply(`An error occurred while rendering the expression.`);
            console.error(`Error while rendering LaTeX: ${err}`);
        }
    }
);