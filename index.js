// index.js
import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes } from 'discord.js';
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
const timeoutIntervals = {};
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
        .setName('unhush')
        .setDescription('Release a user early from timeout')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true))
        .addBooleanOption(opt => opt.setName('reduce_offense').setDescription('Remove one offense count?')),
    new SlashCommandBuilder()
        .setName('reset-hushes')
        .setDescription('Reset all hush offense counts for the day'),
    new SlashCommandBuilder()
        .setName('hush-info')
        .setDescription('Check hush offense count')
        .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true)),
    new SlashCommandBuilder()
        .setName('remove-offense')
        .setDescription('Manually remove an offense from a user')
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

client.once('ready', () => {
    console.log(`🤖 The Husher is online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    const announcementChannel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');

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

        const embed = new EmbedBuilder()
            .setTitle(success ? `🔇 ${target.tag} has been hushed!` : `⚠️ Tried to hush ${target.tag}`)
            .setDescription(
                `**Reason:** ${reason}` +
                (corrector ? `\n**Corrected by:** ${corrector}` : '') +
                (success ? `\n**Time Remaining:** <t:${Math.floor((Date.now() + duration) / 1000)}:R>` : '*Could not apply timeout.*') +
                `\n**Offense Count Today:** ${offenses}`
            )
            .setColor(success ? 'Blue' : 'Orange')
            .setTimestamp();

        if (announcementChannel) await announcementChannel.send({ embeds: [embed] });

        await interaction.reply({ content: `✅ Hushed ${target.tag} for ${duration / 60000} mins.`, ephemeral: true });

        if (announcementChannel) {
            let timeLeft = duration / 1000;
            const comebackMessages = loadCustomComebacks();
            const timerMessage = await announcementChannel.send(`⏳ <@${target.id}> is in timeout for ${formatTime(timeLeft)}`);
            timeoutIntervals[target.id] = setInterval(async () => {
                timeLeft--;
                if (timeLeft > 0) {
                    await timerMessage.edit(`⏳ <@${target.id}> has ${formatTime(timeLeft)} remaining...`);
                } else {
                    clearInterval(timeoutIntervals[target.id]);
                    delete timeoutIntervals[target.id];
                    await timerMessage.delete();
                    const msg = (comebackMessages[Math.floor(Math.random() * comebackMessages.length)] || "<@{user}> is free!").replace('{user}', `<@${target.id}>`);
                    await announcementChannel.send(msg);
                }
            }, 1000);
        }
    }

    if (commandName === 'unhush') {
        const target = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(target.id);
        const reduce = interaction.options.getBoolean('reduce_offense');
        try {
            await member.timeout(null);
        } catch {}
        if (timeoutIntervals[target.id]) {
            clearInterval(timeoutIntervals[target.id]);
            delete timeoutIntervals[target.id];
        }
        if (reduce && userTimeouts[target.id] > 0) userTimeouts[target.id]--;
        if (announcementChannel) {
            const msg = (loadCustomComebacks()[Math.floor(Math.random() * loadCustomComebacks().length)] || "<@{user}> is free!").replace('{user}', `<@${target.id}>`);
            await announcementChannel.send(msg);
        }
        await interaction.reply({ content: `✅ ${target.tag} released${reduce ? ' and offense count reduced.' : '.'}`, ephemeral: true });
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

    if (commandName === 'remove-offense') {
        const target = interaction.options.getUser('target');
        if (userTimeouts[target.id] && userTimeouts[target.id] > 0) {
            userTimeouts[target.id]--;
        }
        interaction.reply({ content: `🧹 Removed 1 offense from ${target.tag}.`, ephemeral: true });
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

client.login(TOKEN);
