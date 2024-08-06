import { 
    APIEmbed,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChatInputCommandInteraction, 
    Component, 
    ComponentType, 
    MessagePayload 
} from 'discord.js';

export default class PageableInteraction {
    private currentPage: number;
    private maxPage: number;
    private row: ActionRowBuilder<ButtonBuilder>;
    private prev: ButtonBuilder;
    private page: ButtonBuilder;
    private next: ButtonBuilder;
    private embeds: APIEmbed[];

    constructor(maxPage: number, payloads: APIEmbed[]) {
        this.currentPage = 1;
        this.maxPage = maxPage;
        this.row = new ActionRowBuilder<ButtonBuilder>();
        this.prev = new ButtonBuilder()
            .setLabel("🠜")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("previous")
            .setDisabled(true);
        this.page = new ButtonBuilder()
            .setLabel(`Page ${this.currentPage}/${this.maxPage}`)
            .setStyle(ButtonStyle.Secondary)
            .setCustomId("page")
            .setDisabled(true);
        this.next = new ButtonBuilder()
            .setLabel("🠞")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("next");
        this.row.addComponents(this.prev, this.page, this.next);
        this.embeds = payloads;
    }

    public getCurrentPage(): number {
        return this.currentPage;
    }

    public async attach(interaction: ChatInputCommandInteraction, timeout?: number) {
        let response;
        if (interaction.deferred) {
            response = await interaction.followUp({ components: [this.row], embeds: [this.embeds[0]] });
        } else if (interaction.replied) {
            response = await interaction.editReply({ components: [this.row], embeds: [this.embeds[0]] });
        } else {
            response = await interaction.reply({ components: [this.row], embeds: [this.embeds[0]] });
        }
        let collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: timeout || 60_000
        });
        collector.on("collect", async (i) => {
            if (i.customId === "next") {
                if (this.currentPage < this.maxPage) {
                    this.currentPage++;
                    this.prev.setDisabled(false);
                    this.page.setLabel(`Page ${this.currentPage}/${this.maxPage}`);
                    if (this.currentPage === this.maxPage) {
                        this.next.setDisabled(true);
                    }
                }
            } else if (i.customId === "previous") {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.next.setDisabled(false);
                    this.page.setLabel(`Page ${this.currentPage}/${this.maxPage}`);
                    if (this.currentPage === 1) {
                        this.prev.setDisabled(true);
                    }
                }
            }
            await i.update({ components: [this.row], embeds: [this.embeds[this.currentPage - 1]]});
        });

        collector.on("end", async () => {
            const ended = new ButtonBuilder()
                .setLabel("Interaction Expired")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setCustomId("end");
            this.row.setComponents([ended]);
            await response.edit({ components: [this.row] });
        });
    }
}