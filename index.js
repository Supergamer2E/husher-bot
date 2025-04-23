// index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import dictionary from 'dictionary-en';
import nspell from 'nspell';
import path from 'path';
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

// Utilities
const userTimeouts = {};
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



// Slash commands registration
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
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a message')
                .addStringOption(opt => opt.setName('message').setDescription('Use {user} for name').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove by index')
                .addIntegerOption(opt => opt.setName('index').setDescription('Message index').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('List all custom comeback messages'))
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

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'hush') {
        const target = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(target.id);
        const reason = interaction.options.getString('reason');
        const corrector = interaction.options.getUser('corrector');
        const duration = getTimeoutDuration(target.id);
        const offenses = userTimeouts[target.id];

        let success = true;
        try {
            await member.timeout(duration, reason);
        } catch (err) {
            success = false;
        }

        const announcementChannel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

        const embed = new EmbedBuilder()
            .setTitle(success ? `🔇 ${target.tag} has been hushed!` : `⚠️ Tried to hush ${target.tag}`)
            .setDescription(
                `**Reason:** ${reason}\n` +
                (corrector ? `**Corrected by:** ${corrector}\n` : '') +
                (success ? `**Time Remaining:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n` : '*Could not apply timeout due to role hierarchy.*\n') +
                `**Offense Count Today:** ${offenses}`
            )
            .setColor(success ? 'Blue' : 'Orange')
            .setTimestamp();

        if (announcementChannel) await announcementChannel.send({ embeds: [embed] });

        interaction.reply({ content: `✅ Hushed ${target.tag} for ${duration / 60000} mins.`, ephemeral: true });

        // Live countdown
        if (success && announcementChannel) {
            let timeLeft = duration / 1000;
            const comebackMessages = [
                "🧙 {user} has returned from the Forbidden Section of chat.",
                "💬 {user} can speak again. The silence was nice.",
                "🛏️ {user} has left the timeout dimension.",
                "🎮 {user} has re-entered the game.",
                "🔔 {user} has been released. Try to behave... maybe."
            ].concat(loadCustomComebacks());

            const timerMessage = await announcementChannel.send(`⏳ <@${member.id}> is in timeout for ${formatTime(timeLeft)}`);
            const interval = setInterval(async () => {
                timeLeft--;
                if (timeLeft > 0) {
                    try {
                        await timerMessage.edit(`⏳ <@${member.id}> has ${formatTime(timeLeft)} remaining...`);
                    } catch (e) {
                        console.error("Failed to edit timer message:", e.message);
                        clearInterval(interval);
                    }
                } else {
                    clearInterval(interval);
                    try {
                        await timerMessage.delete();
                    } catch (e) {
                        console.warn("Couldn't delete timer message:", e.message);
                    }
                    const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)]
                        .replace('{user}', `<@${member.id}>`);
                    await announcementChannel.send(msg);
                }
            }, 1000);
        }
    }

    if (commandName === 'reset-hushes') {
        for (const key in userTimeouts) delete userTimeouts[key];
        currentDate = new Date().toDateString();
        interaction.reply({ content: '✅ All offenses reset for today.', ephemeral: true });
    }

    if (commandName === 'hush-info') {
        const target = interaction.options.getUser('target');
        const offenses = userTimeouts[target.id] || 0;
        interaction.reply({ content: `📊 ${target.tag} has been hushed ${offenses} time(s) today.`, ephemeral: true });
    }

    if (commandName === 'custom-comeback') {
        const sub = interaction.options.getSubcommand();
        let list = loadCustomComebacks();

        if (sub === 'add') {
            const msg = interaction.options.getString('message');
            list.push(msg);
            saveCustomComebacks(list);
            interaction.reply({ content: `✅ Added: \`${msg}\``, ephemeral: true });
        }

        if (sub === 'remove') {
            const i = interaction.options.getInteger('index');
            if (i < 0 || i >= list.length) return interaction.reply({ content: '❌ Invalid index.', ephemeral: true });
            const removed = list.splice(i, 1);
            saveCustomComebacks(list);
            interaction.reply({ content: `🗑️ Removed: \`${removed[0]}\``, ephemeral: true });
        }

        if (sub === 'list') {
            const result = list.map((msg, i) => `**${i}:** ${msg}`).join('\n') || 'No custom comebacks.';
            interaction.reply({ content: result, ephemeral: true });
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

            let success = true;
            try {
                await member.timeout(duration, 'Spelling/grammar mistake');
            } catch (err) {
                success = false;
            }

            const announcementChannel = message.guild.channels.cache.find(c => c.name === 'husher-announcements');

            const embed = new EmbedBuilder()
                .setTitle(success ? `🔇 ${message.author.tag} auto-hushed!` : `⚠️ Tried to hush ${message.author.tag}`)
                .setDescription(`**Mistake:** \`${word}\`\n**Suggestion:** ${correction}\n**Message:** ${message.content}\n**Offense Count:** ${offenses}`)
                .setColor(success ? 'Red' : 'Orange')
                .setTimestamp();

            if (announcementChannel) await announcementChannel.send({ embeds: [embed] });

            message.reply({ content: `🚨 Spelling mistake: \`${word}\` → \`${correction}\``, ephemeral: true });

            // Live countdown message
            if (success && announcementChannel) {
                let timeLeft = duration / 1000;
                const comebackMessages = [
                    "🧙 {user} has returned from the Forbidden Section of chat.",
                    "💬 {user} can speak again. The silence was nice.",
                    "🛏️ {user} has left the timeout dimension.",
                    "🎮 {user} has re-entered the game.",
                    "🔔 {user} has been released. Try to behave... maybe."
                ].concat(loadCustomComebacks());

                const timerMessage = await announcementChannel.send(`⏳ <@${member.id}> is in timeout for ${formatTime(timeLeft)}`);
                const interval = setInterval(async () => {
                    timeLeft--;
                    if (timeLeft > 0) {
                        try {
                            await timerMessage.edit(`⏳ <@${member.id}> has ${formatTime(timeLeft)} remaining...`);
                        } catch (e) {
                            console.error("Failed to edit timer message:", e.message);
                            clearInterval(interval);
                        }
                    } else {
                        clearInterval(interval);
                        try {
                            await timerMessage.delete();
                        } catch (e) {
                            console.warn("Couldn't delete timer message:", e.message);
                        }
                        const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)]
                            .replace('{user}', `<@${message.author.id}>`);
                        await announcementChannel.send(msg);
                    }
                }, 1000);
            }

            break; // stop after first issue
        }
    }
});



client.login(TOKEN);
