
import { Command, CommandError } from "../lib/Command.js";
import { APIEmbed, APIEmbedField, SlashCommandBuilder } from "discord.js";
import { CourseRequester, CourseMap, CourseRequestBody } from "../lib/CourseRequester.js";
import { Course, CourseSection, TimestampedCourse } from "../lib/Course.js";
import PageableInteraction from "../lib/PageableInteraction.js";

const ERR_COLOR = 0xff0000;
const SUCCESS_COLOR = 0x00ff00;
const REQUEST_INTERVAL = 2_000;
const PAGE_TIMEOUT = 60_000;
const GENERIC_ERROR_MSG = 'An unknown internal error occurred. Please try again later.';
const requester = new CourseRequester();

const data = new SlashCommandBuilder()
data.setName('course-info');
data.setDescription('Get info on an ongoing or upcoming UofT course (for Artsci, Engineering, UTM & UTSC).');
data.addStringOption(option =>
    option.setName('course')
        .setDescription('The course to get info on. (e.g. CSC108H1, csc108, csc108 winter, csc108 s)')
        .setRequired(true)
);

export default new Command("course", data,

    async (client) => {
        let csc = new CourseRequestBody();
        csc.sessions = CourseRequester.generateCurrentSessions();
        csc.divisions = ['ARTSC'];
        csc.departmentProps = [{
            department: 'Department of Computer Science',
            division: 'ARTSC',
            type: 'DEPARTMENT'
        }];
        let cscNext = new CourseRequestBody(csc);
        cscNext.sessions = CourseRequester.generateUpcomingSessions();
        requester.fetchLoop(REQUEST_INTERVAL, csc);
        requester.fetchLoop(REQUEST_INTERVAL, cscNext);
    },

    async (client, interaction) => {
        try {
            if (!interaction.options.getString('course')) throw new CommandError('Please provide a course code.');
            let query = interaction.options.getString('course')!.trim();
            if (query.length > 50) throw new CommandError('Your query is too long.');

            await interaction.deferReply();

            let courses = requester.getCache();
            let results = courses.fuzzyFind(query);
            if (!results) throw new CommandError(`Query \`${query}\` could not be parsed. Please be more clear.`);
            if (results.length === 0) throw new CommandError(`No courses were found matching \`${query}\`. Try using a different term.`);
            let courseEmbeds: APIEmbed[] = [];
            results.forEach((c: Course) => {
                let fields: APIEmbedField[] = [];
                if (!c.sections) fields.push({ name: 'No sections available.', value: '' });
                else {
                    c.sections.forEach((s: CourseSection, name: string) => {
                        fields.push({
                            name: `\`${name} - ${s.curr}/${s.max} ${s.waitlist > 0 ? `(+${s.waitlist})` : ''}\``,
                            value: `\`${s.instructor}\``
                        });
                    });
                }
                courseEmbeds.push({
                    title: `${c.code} (${c.session})`,
                    description: `${c.title}`,
                    fields: fields,
                    color: SUCCESS_COLOR
                });
            });

            if (courseEmbeds.length === 1) await interaction.followUp({ embeds: courseEmbeds });
            else {
                let pageable = new PageableInteraction(courseEmbeds.length, courseEmbeds);
                await pageable.attach(interaction, PAGE_TIMEOUT);
            }
        } catch (e) {
            const isCommandError = e instanceof CommandError;
            const errorEmbed: APIEmbed = {
                title: 'Error',
                description: isCommandError ? e.message : GENERIC_ERROR_MSG,
                color: ERR_COLOR
            };
            if (interaction.replied) {
                interaction.editReply({ embeds: [errorEmbed] });
            } else {
                interaction.reply({ embeds: [errorEmbed] });
            }
            if (isCommandError) console.log(`A CommandError occurred: ${e.message}`);
            else console.error(e);
        }
    }
);