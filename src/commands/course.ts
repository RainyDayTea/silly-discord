import { Command } from "../lib/Command.js";
import { APIEmbed, APIEmbedField, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { CourseRequester } from "../lib/CourseRequester.js";
import { Course, CourseSection } from "../lib/Course.js";
import PageableInteraction from "../lib/PageableInteraction.js";

const ERR_COLOR = 0xff0000;
const SUCCESS_COLOR = 0x00ff00;
const requester = new CourseRequester();

const data = new SlashCommandBuilder()
data.setName('course');
data.setDescription('Commands related to UofT courses. Use `/course help` for more information.');
data.addStringOption(option =>
    option.setName('option')
        .setDescription('Valid options: help, info, search.')
        .setRequired(true)
);
data.addStringOption(option =>
    option.setName('args')
        .setDescription('The rest of the arguments go here.')
        .setRequired(false)
);


export default new Command("course", data,

    async (client) => {
        return;
    },
    
    async (client, interaction) => {
        try { 
            if (interaction.options.getString("option") === "help") {
                await interaction.reply({
                    embeds: [{
                        title: "Course Commands",
                        description: "Commands related to UofT courses.",
                        fields: [
                            {
                                name: "/course help",
                                value: "Display this help message."
                            },
                            {
                                name: "/course info <course code>",
                                value: "Get enrollment information on a specific course."
                            },
                            {
                                name: "/course search <search term>",
                                value: "Search for a course by its title."
                            }
                        ]
                    }],
                    ephemeral: true
                });
                return;
            } else if (interaction.options.getString("option") === "search") {
                await onOptionSearch(interaction, interaction.options.getString("args"));
            } else if (interaction.options.getString("option") === "info") {
                await onOptionInfo(interaction, interaction.options.getString("args"));
            } else {
                await interaction.reply({
                    embeds: [{
                        title: "Error",
                        description: "Invalid option. Use `/course help` for more information.",
                        color: ERR_COLOR
                    }],
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error(error);

            // Each helper function should handle its own errors, but
            // this catch block is here just in case.
            if (interaction.replied || interaction.deferred) {
                interaction.editReply({
                    content: 'An unknown error occurred.'
                });
            } else {
                interaction.reply({
                    content: 'An unknown error occurred.'
                });
            }
        }
    }
);

/**
 * Helper function that processes the "search" subcommand.
 * @param interaction The interaction object, assumed to be unreplied/undeferred.
 * @param searchTerm The user's search term.
 */
async function onOptionSearch(interaction: ChatInputCommandInteraction, searchTerm: string | null) {
    if (!searchTerm) {
        await interaction.reply({
            embeds: [{
                title: "Error",
                description: "You must provide a search term.",
                color: ERR_COLOR
            }],
            ephemeral: true
        });
        return;
    }
    await interaction.deferReply();

    let searchResults = await requester.searchCourses(searchTerm);
    let fields: APIEmbedField[] = [];

    if (searchResults === null) {
        await interaction.followUp({
            embeds: [{
                title: "Error",
                description: "An error occurred while searching for courses.",
                color: ERR_COLOR
            }],
            ephemeral: true
        });
        return;
    }

    searchResults.forEach((course) => {
        if (fields.length >= 25) return;
        fields.push({
            name: `${course.code} (${course.session})`,
            value: course.title
        });
    });

    await interaction.followUp({
        embeds: [{
            title: "Search Results",
            fields: fields.length > 0 ? fields : [{ name: "No results found.", value: "Try a different search term." }],
            color: fields.length > 0 ? SUCCESS_COLOR : ERR_COLOR
        }]
    });
    
}

/**
 * Helper function that processes the "info" subcommand.
 * @param interaction The interaction object, assumed to be unreplied/undeferred.
 * @param searchTerm The user's search term.
 */
async function onOptionInfo(interaction: ChatInputCommandInteraction, searchTerm: string | null) {
    if (!searchTerm) {
        await interaction.reply({
            embeds: [{
                title: "Error",
                description: "You must provide a search term.",
                color: ERR_COLOR
            }],
            ephemeral: true
        });
        return;
    }
    await interaction.deferReply();

    let courses: Course[] | null = await requester.getCourseInfo(searchTerm);
    let embeds: APIEmbed[] = [];
    let pages: PageableInteraction;

    if (courses === null) {
        await interaction.followUp({
            embeds: [{
                title: "Error",
                description: "Course not found. Please ensure you are entering the exact course code (e.g. CSC108H1).",
                color: ERR_COLOR
            }],
            ephemeral: true
        });
        return;
    }

    for (let course of courses) {
        let fields: APIEmbedField[] = [];
        for (let [sectionName, section] of course.sections!.entries()) {
            if (fields.length >= 25) break;
            if (!sectionName.startsWith("LEC")) continue;
            fields.push({
                name: `${sectionName} \`(${section.curr} / ${section.max})${section.waitlist > 0 ? ` + ${section.waitlist}` : ""}\``,
                value: `${section.instructor}`
            });
        }
        fields.sort((a, b) => a.name.localeCompare(b.name));
        embeds.push({
            title: `${course.code} (${course.session})`,
            description: course.title,
            fields: fields,
            color: SUCCESS_COLOR
        });
    }

    pages = new PageableInteraction(embeds.length, embeds);
    await pages.attach(interaction);
    
}