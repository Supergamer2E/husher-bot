// ===========================
// Updated index.js
// ===========================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import process from 'process';
import handlePlead from './commands/plead.js';

import {
  getRecentOffenses,
  addOffenseToLog
} from './helpers/offenseLogger.js';

// --- Global Variables ---
global.courtActive = false;
global.courtData = null;


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

async function applyTimeout(member, durationMs) {
    const timeoutRole = member.guild.roles.cache.find(r => r.name === 'In Timeout');
    if (!timeoutRole) throw new Error('Timeout role not found.');
    
    await member.roles.add(timeoutRole);
    
    const untimeoutTime = Date.now() + durationMs;
    userTimeouts[member.id] = { end: untimeoutTime };

    // Timer for automatic removal
    const timeoutDurationSeconds = Math.floor(durationMs / 1000);
    const timer = setTimeout(async () => {
        try {
            await removeTimeout(member);
        } catch (e) {
            console.error('Failed to auto-remove timeout:', e);
        }
    }, durationMs);
    activeTimers.set(member.id, timer);
}

async function removeTimeout(member) {
    const timeoutRole = member.guild.roles.cache.find(r => r.name === 'In Timeout');
    if (!timeoutRole) throw new Error('Timeout role not found.');
    
    await member.roles.remove(timeoutRole);
    
    delete userTimeouts[member.id];
    
    if (activeTimers.has(member.id)) {
        clearTimeout(activeTimers.get(member.id));
        activeTimers.delete(member.id);
    }
}

const userTimeouts = {};
const activeTimers = new Map();

Date.prototype.getWeek = function () {
  const onejan = new Date(this.getFullYear(), 0, 1);
  return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
};

let currentWeek = new Date().getWeek();

const whitelist = ['lol', 'tbh', 'idk', 'discord', 'minecraft', 'kai', 'keaton', 'dylan', 'mrmeatlug', 'supergamer2e', 'chillpixl'];

const loadCustomComebacks = () => JSON.parse(fs.readFileSync('./comebacks.json', 'utf8'));
const saveCustomComebacks = list => fs.writeFileSync('./comebacks.json', JSON.stringify(list, null, 2));

function getTimeoutDuration(userId, double = false) {
  const todayWeek = new Date().getWeek();
  if (todayWeek !== currentWeek) {
    currentWeek = todayWeek;
    for (const key in userTimeouts) delete userTimeouts[key];
  }
  if (!userTimeouts[userId]) userTimeouts[userId] = 0;
  const baseOffenses = userTimeouts[userId];
  const group = Math.ceil(baseOffenses / 3);
  let timeout = group * 5 * 60 * 1000;
  return double ? timeout * 2 : timeout;
}

const commands = [
    new SlashCommandBuilder()
      .setName('hush')
      .setDescription('Put a user in timeout')
      .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true)),
  
    new SlashCommandBuilder()
      .setName('add-offense')
      .setDescription('Add offenses without timeout')
      .addUserOption(opt => opt.setName('target').setDescription('Target user').setRequired(true))
      .addIntegerOption(opt => opt.setName('count').setDescription('How many offenses to add').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for offense').setRequired(true))
      .addUserOption(opt => opt.setName('corrector').setDescription('Who corrected them (optional)')),

  
    new SlashCommandBuilder()
      .setName('plead')
      .setDescription('Plead your case in court')
  ];
  

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

// ============ HANDLE INTERACTIONS ==============
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  if (commandName === 'hush') {
    await handleHush(interaction);
  } else if (commandName === 'add-offense') {
    await handleAddOffense(interaction);
  } else if (commandName === 'plead') {
    await handlePlead(interaction);
  }
});

// ============ COMMAND HANDLERS ==================
async function handleHush(interaction) {
    const target = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(target.id);
  
    const duration = getTimeoutDuration(target.id);
  
    const reasons = [
      '⚖️ To pay for their crimes.',
      '🔨 Justice has been served.',
      '💥 Caught in 4K.',
      '🧹 Swept away to the timeout realm.',
      '🪓 Banned to the shadow realm (temporarily).',
      '⛏️ Mining their consequences in Minecraft.',
      '💎 Trying to steal diamonds... caught!',
      '🚪 Sent to the Nether.',
      '🐲 Failing to defeat the Ender Dragon.',
      '⚡ Expelled from Hogwarts for bad spells.',
      '🪄 Misusing a magic wand.',
      '📚 Cursed by the Book of Spells.',
      '🎩 Turned into a frog at the repo.',
      '📦 Failed the Repo Test.',
      '📜 Signed a cursed contract at the repo.',
      '👻 Haunted by repo ghosts.',
      '🚫 Banned from the server... briefly.',
      '👮‍♂️ Caught by the grammar police.',
      '🚓 Ticketed for speeding in chat.',
      '🎭 Guilty in the court of memes.',
      '🍕 Ate the last slice without asking.',
      '🎮 Rage-quitting Minecraft server.',
      '🧹 Swept into exile by the janitor bot.',
      '🧟‍♂️ Bitten by a timeout zombie.',
      '🛡️ Banished for bad behavior.'
    ];
  
    const randomReason = reasons[Math.floor(Math.random() * reasons.length)];
  
    let success = true;
    try {
      await applyTimeout(member, duration);
    } catch (err) {
      success = false;
    }
  
    const announcementChannel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');
    if (success && announcementChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`🔇 ${target.tag} has been hushed!`)
        .setDescription(`Reason: ${randomReason}`)
        .setColor('Blue')
        .setTimestamp();
      await announcementChannel.send({ embeds: [embed] });
    }
  
    await interaction.reply({ content: success ? `✅ Hushed ${target.tag}.` : `⚠️ Could not hush ${target.tag}.`, ephemeral: true });
  }
  

async function handleAddOffense(interaction) {
  const target = interaction.options.getUser('target');
  const count = interaction.options.getInteger('count');

  if (!userTimeouts[target.id]) userTimeouts[target.id] = 0;
  userTimeouts[target.id] += count;

  await interaction.reply({ content: `✅ Added ${count} offense(s) to ${target.tag}.`, ephemeral: true });
}


client.login(TOKEN);