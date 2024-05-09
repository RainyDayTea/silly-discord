const fs = require('fs');
const katex = require('katex');
const puppeteer = require('puppeteer');
const { SlashCommandBuilder } = require('discord.js');

// Global options for KaTeX rendering, contains some user safeguards
const katexOptions = {
    displayMode: true,
    output: 'html',
    maxSize: 50,
    maxExpand: 200,
    macros: {
        // Number sets
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
    }
}

var browser, page;
var htmlTemplate = fs.readFileSync('./commands/utility/latex-template.html', 'utf8');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('latex')
        .setDescription('Render LaTeX code into an image')
        .addStringOption(option =>
            option.setName('tex')
                .setDescription('The LaTeX code to render')
                .setRequired(true)),
    async execute(interaction) {
        const tex = interaction.options.getString('tex');

        // TODO: Clarify code and optimize
        // TODO: Move hardcoded values to config file.
        try {
            let htmlString = katex.renderToString(tex, katexOptions);
            await interaction.deferReply({
                ephemeral: false //NOTE: Set to true to hide the response
            });
            if (browser === undefined) {
                browser = await puppeteer.launch();
                page = await browser.newPage();
            }
            await page.setContent(htmlTemplate.replace('PLACEHOLDER', htmlString));
            // console.log(htmlString);
            
            let elem = await page.$('.katex');
            let image = await elem.screenshot({type: 'png'});
            await interaction.editReply({ 
                files: [{
                    attachment: image
                }] 
            });
        } catch (err) {
            await interaction.editReply(`An error occurred while rendering the expression.`);
            console.log(`Error while rendering LaTeX: ${err}`);
        }
    }
};