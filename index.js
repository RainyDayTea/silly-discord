require('dotenv').config();

const {Client, Collection, Events, GatewayIntentBits} = require('discord.js');
const GUILD_ID = '1087532733288415343';
const LOG_CHANNEL_ID = '1203852989614260274';
const LOG_FORMAT = 'Message deleted from `%s` in #`%s`: %s';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageDelete, async (msg) => {
    if (msg.author.bot) {
        return;
    }
    let content = msg.content;
    let channel = msg.channel;
    let author = msg.author.tag;
    if (msg.guild.id === GUILD_ID) {
        let logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        let msgBuffer = LOG_FORMAT.replace('%s', author).replace('%s', channel.name).replace('%s', content);
        if (msgBuffer.length > 2000) {
            msgBuffer = msgBuffer.slice(0, 1997) + '...';
        }
        logChannel.send(msgBuffer)
            .catch(console.error);
    }
    console.log(`Message deleted: ${content}`);
});

client.on(Events.MessageCreate, async (msg) => { 
    if (msg.author.bot) {
        return;
    }
    console.log(`Message received in '${msg.guild.name}' #${msg.channel.name} from ${msg.author.tag}: ${msg.content}`);
});

client.login(process.env.BOT_TOKEN);