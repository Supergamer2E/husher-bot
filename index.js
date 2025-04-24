// index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js';
import fs from 'fs';
import process from 'process';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const userTimeouts = {};
const activeTimers = new Map();
let currentDate = new Date().toDateString();
const whitelist = ['lol', 'tbh', 'idk', 'discord', 'minecraft', 'kai', 'keaton', 'dylan', 'mrmeatlug', 'supergamer2e', 'chillpixl'];

const loadCustomComebacks = () => JSON.parse(fs.readFileSync('./comebacks.json', 'utf8'));
const saveCustomComebacks = list => fs.writeFileSync('./comebacks.json', JSON.stringify(list, null, 2));

function getTimeoutDuration(userId) {
    const today = new Date().toDateString();
    if (today !== currentDate) {
        currentDate = today;
        for (const key in userTimeouts) delete userTimeouts[key];
    }
    if (!userTimeouts[userId]) userTimeouts[userId] = 0;
    userTimeouts[userId]++;
    const group = Math.ceil(userTimeouts[userId] / 3);
    return group * 5 * 60 * 1000;
}

const commands = [
    new SlashCommandBuilder()
        .setName('hush')
        .setDescription('Put a user in timeout')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(true))
        .addUserOption(opt => opt.setName('corrector').setDescription('Who corrected them (optional)')),
    new SlashCommandBuilder()
        .setName('reset-hushes')
        .setDescription('Reset all hush offense counts for the day'),
    new SlashCommandBuilder()
        .setName('hush-info')
        .setDescription('Check hush offense count')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true)),
    new SlashCommandBuilder()
        .setName('custom-comeback')
        .setDescription('Manage comeback messages')
        .addSubcommand(sub => sub.setName('add').setDescription('Add a message').addStringOption(opt => opt.setName('message').setDescription('Use {user} for name').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove by index').addIntegerOption(opt => opt.setName('index').setDescription('Message index').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all custom comeback messages')),
    new SlashCommandBuilder()
        .setName('unhush')
        .setDescription('Remove a user from timeout')
        .addUserOption(opt => opt.setName('target').setDescription('User to unhush').setRequired(true))
        .addBooleanOption(opt => opt.setName('reduce-offense').setDescription('Reduce offense count?')),
    new SlashCommandBuilder()
        .setName('remove-offense')
        .setDescription('Manually reduce a user offense count')
        .addUserOption(opt => opt.setName('target').setDescription('User').setRequired(true)),
    new SlashCommandBuilder()
        .setName('add-offense')
        .setDescription('Manually adds a hush offense without a timeout')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for offense').setRequired(true))
        .addUserOption(opt => opt.setName('corrector').setDescription('Who corrected them (optional)'))      
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('✅ Slash commands registered');
    } catch (err) {
        console.error(err);
    }
})();

client.once('ready', () => {
    console.log(`🤖 The Husher is online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
        const commandModule = await import(`./commands/${commandName}.js`);
        await commandModule.default(interaction, {
            userTimeouts,
            activeTimers,
            loadCustomComebacks,
            saveCustomComebacks,
            getTimeoutDuration,
            formatTime,
            whitelist
        });
    } catch (err) {
        console.error(`❌ Error handling command '${commandName}':`, err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ An error occurred.', ephemeral: true });
        }
    }
});

client.login(TOKEN);
