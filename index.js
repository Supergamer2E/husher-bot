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

async function generateJailAvatar(user) {
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarURL);
        const jailOverlay = await loadImage('./assets/jail_overlay.png');

        const canvas = createCanvas(256, 256);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(avatar, 0, 0, 256, 256);
        ctx.drawImage(jailOverlay, 0, 0, 256, 256);

        const buffer = canvas.toBuffer('image/png');
        const filePath = `./tmp/jail_${user.id}.png`;
        fs.writeFileSync(filePath, buffer);
        return filePath;
    } catch (err) {
        console.error(`❌ Failed to generate jail avatar for ${user.tag}:`, err.message);
        return null; // fallback if avatar can't be generated
    }
}


const commands = [
    new SlashCommandBuilder().setName('hush').setDescription('Put a user in timeout')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(true))
        .addUserOption(opt => opt.setName('corrector').setDescription('Who corrected them (optional)')),
    new SlashCommandBuilder().setName('reset-hushes').setDescription('Reset all hush offense counts for the day'),
    new SlashCommandBuilder().setName('hush-info').setDescription('Check hush offense count')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true)),
    new SlashCommandBuilder().setName('custom-comeback').setDescription('Manage comeback messages')
        .addSubcommand(sub => sub.setName('add').setDescription('Add a message')
            .addStringOption(opt => opt.setName('message').setDescription('Use {user} for name').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove by index')
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
    const announcementChannel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

    if (commandName === 'hush') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
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

        const embed = new EmbedBuilder()
            .setTitle(success ? `🔇 ${target.tag} has been hushed!` : `⚠️ Tried to hush ${target.tag}`)
            .setDescription(`**Reason:** ${reason}\n${corrector ? `**Corrected by:** ${corrector}\n` : ''}${success ? `**Time Remaining:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n` : '*Could not apply timeout due to role hierarchy.*\n'}**Offense Count Today:** ${offenses}`)
            .setColor(success ? 'Blue' : 'Orange')
            .setTimestamp();

        const filePath = await generateJailAvatar(member.user);
        if (announcementChannel) {
    if (filePath) {
        await announcementChannel.send({ embeds: [embed], files: [filePath] });
    } else {
        await announcementChannel.send({ embeds: [embed] });
    }
}

        interaction.reply({ content: `✅ Hushed ${target.tag} for ${duration / 60000} mins.`, ephemeral: true });

        let timeLeft = duration / 1000;
        const comebackMessages = [
            "🧙 {user} has returned from the Forbidden Section of chat.",
            "💬 {user} can speak again. The silence was nice.",
            "🛏️ {user} has left the timeout dimension.",
            "🎮 {user} has re-entered the game.",
            "🔔 {user} has been released. Try to behave... maybe."
        ].concat(loadCustomComebacks());

        const interval = setInterval(async () => {
            timeLeft -= 60;
            if (timeLeft <= 0) {
                clearInterval(interval);
                const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)].replace('{user}', `<@${target.id}>`);
                if (announcementChannel) await announcementChannel.send(msg);
            }
        }, 60000);
    }

    if (commandName === 'reset-hushes') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
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
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }
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

            const filePath = await generateJailAvatar(member.user);
            if (announcementChannel) {
                if (filePath) {
                    await announcementChannel.send({ embeds: [embed], files: [filePath] });
                } else {
                    await announcementChannel.send({ embeds: [embed] });
                }
            }

            message.reply({ content: `🚨 Spelling mistake: \`${word}\` → \`${correction}\``, ephemeral: true });

            // 👇 Live timer + comeback message
            let timeLeft = duration / 1000;
            const comebackMessages = [
                "🧙 {user} has returned from the Forbidden Section of chat.",
                "💬 {user} can speak again. The silence was nice.",
                "🛏️ {user} has left the timeout dimension.",
                "🎮 {user} has re-entered the game.",
                "🔔 {user} has been released. Try to behave... maybe."
            ].concat(loadCustomComebacks());

            const interval = setInterval(async () => {
                timeLeft -= 60;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    const msg = comebackMessages[Math.floor(Math.random() * comebackMessages.length)].replace('{user}', `<@${message.author.id}>`);
                    if (announcementChannel) await announcementChannel.send(msg);
                }
            }, 60000);

            break; // only hush once per message
        }
    }
});


client.once('ready', () => {
    console.log(`🤖 The Husher is online as ${client.user.tag}`);
});

client.login(TOKEN);
