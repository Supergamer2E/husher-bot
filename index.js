// index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import dictionary from 'dictionary-en';
import nspell from 'nspell';
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
const whitelist = ['lol', 'tbh', 'idk', 'discord', 'minecraft'];

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
        .addUserOption(opt => opt.setName('target').setDescription('User').setRequired(true))
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
        if (commandName === 'unhush') {
            const target = interaction.options.getUser('target');
            const reduce = interaction.options.getBoolean('reduce-offense');
            const member = await interaction.guild.members.fetch(target.id);
            const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

            if (activeTimers.has(target.id)) {
                clearInterval(activeTimers.get(target.id));
                activeTimers.delete(target.id);
            }

            try {
                await member.timeout(null);
            } catch {}

            if (reduce && userTimeouts[target.id]) {
                userTimeouts[target.id] = Math.max(0, userTimeouts[target.id] - 1);
            }

            const msg = loadCustomComebacks().concat([
                '🧙 {user} has returned from the Forbidden Section of chat.',
                '💬 {user} can speak again. The silence was nice.',
                '🛏️ {user} has left the timeout dimension.',
                '🎮 {user} has re-entered the game.',
                '🔔 {user} has been released. Try to behave... maybe.'
            ]);
            const comeback = msg[Math.floor(Math.random() * msg.length)].replace('{user}', `<@${target.id}>`);

            await channel?.send(comeback);
            await interaction.reply({ content: `✅ ${target.tag} has been unhushed.`, flags: 1 << 6 });
        }

        else if (commandName === 'remove-offense') {
            const target = interaction.options.getUser('target');
            if (userTimeouts[target.id]) {
                userTimeouts[target.id] = Math.max(0, userTimeouts[target.id] - 1);
            }
            await interaction.reply({ content: `✅ ${target.tag}'s offense count reduced.`, flags: 1 << 6 });
        }

        else if (commandName === 'reset-hushes') {
            for (const key in userTimeouts) delete userTimeouts[key];
            currentDate = new Date().toDateString();
            await interaction.reply({ content: '✅ All offenses reset for today.', flags: 1 << 6 });
        }

        else if (commandName === 'hush-info') {
            const target = interaction.options.getUser('target');
            const offenses = userTimeouts[target.id] || 0;
            await interaction.reply({ content: `📊 ${target.tag} has been hushed ${offenses} time(s) today.`, flags: 1 << 6 });
        }

        else if (commandName === 'custom-comeback') {
            const sub = interaction.options.getSubcommand();
            let list = loadCustomComebacks();

            if (sub === 'add') {
                const msg = interaction.options.getString('message');
                list.push(msg);
                saveCustomComebacks(list);
                await interaction.reply({ content: `✅ Added: \`${msg}\``, flags: 1 << 6 });
            }

            if (sub === 'remove') {
                const i = interaction.options.getInteger('index');
                if (i < 0 || i >= list.length) return await interaction.reply({ content: '❌ Invalid index.', flags: 1 << 6 });
                const removed = list.splice(i, 1);
                saveCustomComebacks(list);
                await interaction.reply({ content: `🗑️ Removed: \`${removed[0]}\``, flags: 1 << 6 });
            }

            if (sub === 'list') {
                const result = list.map((msg, i) => `**${i}:** ${msg}`).join('\n') || 'No custom comebacks.';
                await interaction.reply({ content: result, flags: 1 << 6 });
            }
        }
    } catch (error) {
        console.error("❌ Command handler error:", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '⚠️ An error occurred while processing the command.' });
        } else {
            await interaction.reply({ content: '⚠️ An error occurred while processing the command.', flags: 1 << 6 });
        }
    }
});

client.on('messageCreate', async message => {
    if (!spell || message.author.bot || !message.guild || message.channel.name !== 'general') return;
    if (message.content.startsWith('/') || message.content.startsWith('t!') || message.content.startsWith('t@')) return;

    const content = message.content.toLowerCase();
    const words = content.replace(/[^\w\s]/gi, '').split(/\s+/).filter(Boolean);

    for (const word of words) {
        if (!spell.correct(word) && !whitelist.includes(word)) {
            const suggestions = spell.suggest(word);
            const correction = suggestions[0] || 'no suggestions';

            const member = await message.guild.members.fetch(message.author.id);
            const duration = getTimeoutDuration(member.id);
            const offenses = userTimeouts[member.id];
            const announcementChannel = message.guild.channels.cache.find(c => c.name === 'husher-announcements');

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

            await announcementChannel?.send({ embeds: [embed] });
            await message.reply({ content: `🚨 Spelling mistake: \`${word}\` → \`${correction}\``, flags: 1 << 6 });

            if (announcementChannel) {
                let timeLeft = duration / 1000;
                const comebackMessages = loadCustomComebacks().concat([
                    '🧙 {user} has returned from the Forbidden Section of chat.',
                    '💬 {user} can speak again. The silence was nice.',
                    '🛏️ {user} has left the timeout dimension.',
                    '🎮 {user} has re-entered the game.',
                    '🔔 {user} has been released. Try to behave... maybe.'
                ]);

                const timerMessage = await announcementChannel.send(`⏳ <@${member.id}> is in timeout for ${formatTime(timeLeft)}`);
                const interval = setInterval(async () => {
                    timeLeft--;
                    if (timeLeft > 0) {
                        await timerMessage.edit(`⏳ <@${member.id}> has ${formatTime(timeLeft)} remaining...`);
                    } else {
                        clearInterval(interval);
                        activeTimers.delete(member.id);
                        try { await timerMessage.delete(); } catch {}
                        const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)].replace('{user}', `<@${member.id}>`);
                        await announcementChannel.send(msg);
                    }
                }, 1000);
                activeTimers.set(member.id, interval);
            }

            break;
        }
    }
});

client.login(TOKEN);