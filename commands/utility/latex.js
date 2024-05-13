const fs = require('fs');
const katex = require('katex');
const puppeteer = require('puppeteer');
const { Mutex } = require('async-mutex');
const { SlashCommandBuilder } = require('discord.js');

var katexOptions = {};
var browser, page;
var htmlTemplate = '';
var pageMutex = new Mutex();


// ========================[[ Slash Command ]]========================

module.exports = {

    data: new SlashCommandBuilder()
        .setName('latex')
        .setDescription('Render a LaTeX expression as an image')
        .addStringOption(option =>
            option.setName('tex')
                .setDescription('The expression in math mode')
                .setRequired(true)),
    
    // Called when command is first loaded.
    async init() {
        let config = JSON.parse(fs.readFileSync('./config.json'));
        katexOptions = config.katexOptions;
        htmlTemplate = fs.readFileSync('./commands/utility/latex-template.html', 'utf8');
        browser = await puppeteer.launch();
        page = await browser.newPage();
        console.log('Puppeteer preloaded.');
    },

    async execute(interaction) {
        try {
            // Defer the interaction as early as possible so that the renderer can take its time
            await interaction.deferReply({
                ephemeral: false //NOTE: Set to true to hide the response
            });
            let tex = interaction.options.getString('tex');
            let htmlString = katex.renderToString(tex, katexOptions);
            let image = await pageMutex.runExclusive(async () => {
                await page.setContent(htmlTemplate.replace('PLACEHOLDER', htmlString));
                let elem = await page.$('.katex');
                return await elem.screenshot({type: 'png'});
            });

            await interaction.editReply({ 
                files: [{
                    attachment: image
                }] 
            });
        } catch (err) {
            await interaction.editReply(`An error occurred while rendering the expression.`);
            console.error(`Error while rendering LaTeX: ${err}`);
        }
    }
};