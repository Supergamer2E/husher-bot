// index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js';
import fs from 'fs';
import dictionary from 'dictionary-en';
import nspell from 'nspell';
import process from 'process';

global.autocorrectEnabled = true;

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
        .setName('whitelist-add')
        .setDescription('Add a word to the autocorrect whitelist')
        .addStringOption(opt => opt.setName('word').setDescription('Word to whitelist').setRequired(true)),
    new SlashCommandBuilder()
        .setName('whitelist-remove')
        .setDescription('Remove a word from the autocorrect whitelist')
        .addStringOption(opt => opt.setName('word').setDescription('Word to remove').setRequired(true)),
    new SlashCommandBuilder()
        .setName('toggle-autocorrect')
        .setDescription('Enable or disable autocorrect globally')
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

let spell;
dictionary((err, dict) => {
    if (err) throw err;
    spell = nspell(dict);
});

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
            whitelist,
            spell,
            autocorrectEnabled: global.autocorrectEnabled ?? true,
            toggleAutocorrect: (state) => global.autocorrectEnabled = state
        });
    } catch (err) {
        console.error(`❌ Error handling command '${commandName}':`, err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ An error occurred.', ephemeral: true });
        }
    }
});


client.on('messageCreate', async message => {
    if (!global.autocorrectEnabled) return;
    if (!spell || message.author.bot || !message.guild || message.channel.name !== 'general') return;
    if (message.content.startsWith('/') || message.content.startsWith('t!') || message.content.startsWith('t@')) return;

    const content = message.content;
    const words = content.match(/\b[\w']+\b/g)?.filter(w =>
    isNaN(w) &&                      // Exclude numbers
    !/^<@!?(\d+)>$/.test(w) &&       // Exclude mentions
    !whitelist.includes(w.toLowerCase()) // Still allow whitelist filter
) || [];

    for (const word of words) {
        const lowerWord = word.toLowerCase();

        // Skip whitelisted words
        if (whitelist.includes(lowerWord)) continue;

        // Skip if spellchecker thinks it's valid
        if (spell.correct(lowerWord)) continue;

        const suggestions = spell.suggest(lowerWord);
        const correction = suggestions[0] || 'no suggestions';

        // Skip if the suggestion is just a casing variant
        if (correction.toLowerCase() === lowerWord) continue;

        // Fetch offender and calculate timeout
        const member = await message.guild.members.fetch(message.author.id);
        const duration = getTimeoutDuration(member.id);
        const offenses = userTimeouts[member.id];
        const channel = message.guild.channels.cache.find(c => c.name === 'husher-announcements');

        let success = true;
        try {
            await member.timeout(duration, 'Spelling/grammar mistake');
        } catch {
            success = false;
        }

        const embed = new EmbedBuilder()
            .setTitle(success ? `🔇 ${message.author.tag} auto-hushed!` : `⚠️ Tried to hush ${message.author.tag}`)
            .setDescription(`**Mistake:** \`${word}\`\n**Suggestion:** ${correction}\n**Message:** ${message.content}\n**Offense Count:** ${offenses}`)
            .setColor(success ? 'Red' : 'Orange')
            .setTimestamp();

        if (channel) await channel.send({ embeds: [embed] });
        await message.reply({ content: `🚨 Spelling mistake: \`${word}\` → \`${correction}\``, ephemeral: true });

        // Timer announcement
        if (channel) {
            let timeLeft = duration / 1000;
            const comebackMessages = loadCustomComebacks().concat([
                '🧙 {user} has returned from the Forbidden Section of chat.',
                '💬 {user} can speak again. The silence was nice.',
                '🛏️ {user} has left the timeout dimension.',
                '🎮 {user} has re-entered the game.',
                '🔔 {user} has been released. Try to behave... maybe.'
            ]);

            const timerMessage = await channel.send(`⏳ <@${member.id}> is in timeout for ${formatTime(timeLeft)}`);
            const interval = setInterval(async () => {
                timeLeft--;
                if (timeLeft > 0) {
                    await timerMessage.edit(`⏳ <@${member.id}> has ${formatTime(timeLeft)} remaining...`);
                } else {
                    clearInterval(interval);
                    activeTimers.delete(member.id);
                    try { await timerMessage.delete(); } catch {}
                    const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)].replace('{user}', `<@${member.id}>`);
                    await channel.send(msg);
                }
            }, 1000);
            activeTimers.set(member.id, interval);
        }

        break; // Stop checking after first mistake
    }
});

client.login(TOKEN);
